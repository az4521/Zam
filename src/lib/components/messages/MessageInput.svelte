<script lang="ts">
    import { tick, untrack } from "svelte";
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import {
        sendTextMessage,
        sendFormattedMessage,
        sendReply,
        sendSticker,
        sendFile,
        getMemberName,
        getMemberAvatar,
        getRoomMembers,
        loadRoomMembersIfNeeded,
        getCustomEmojis,
        mxcToHttp,
        sendTyping,
        onTypingEvent,
        getOwnUserId,
        sendEmote,
        joinRoomByAlias,
        leaveRoom,
        inviteUser,
        setRoomTopic,
        kickUser,
        banUser,
        setOwnDisplayName,
        setUserPowerLevel,
        getOwnServerName,
        getMyPowerLevel,
        getRoomPowerLevels,
        sendThreadReply,
        type CustomEmoji,
        type CustomSticker,
    } from "$lib/matrix/client";
    import { composerThreadKey } from "$lib/utils/threadContent";
    import { buildFormattedBody as buildBody } from "$lib/utils/messageBody";
    import { buildReplyContent } from "$lib/utils/replyContent";
    import {
        buildTextContent,
        buildFormattedContent,
    } from "$lib/utils/messageContent";
    import { shouldQueueSend } from "$lib/utils/sendGating";
    import { queueMessage } from "$lib/stores/outbox.svelte";
    import { ALL_EMOJIS } from "$lib/data/emojis";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import StickerPicker from "$lib/components/ui/StickerPicker.svelte";
    import GifPicker from "$lib/components/ui/GifPicker.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
        openComposerPicker,
    } from "$lib/stores/interface.svelte";
    import ComposerActionsMenu from "$lib/components/messages/ComposerActionsMenu.svelte";
    import VoiceRecorder from "$lib/components/messages/VoiceRecorder.svelte";
    import OutboxStrip from "$lib/components/messages/OutboxStrip.svelte";
    import { pickAudioMimeType } from "$lib/utils/voiceMessage";
    import { openCreatePollDialog } from "$lib/stores/pollDialog.svelte";
    import { openShareLocationDialog } from "$lib/stores/locationDialog.svelte";
    import {
        getDraft,
        setDraft,
        clearDraft,
    } from "$lib/stores/composerDrafts.svelte";
    import {
        getFileQueue,
        addQueuedFile,
        removeQueuedFile,
        clearFileQueue,
    } from "$lib/stores/composerFileQueue.svelte";
    import { sendQueuedFilesInOrder } from "$lib/utils/queuedFileSend";
    import { filesToRestoreAfterSend } from "$lib/utils/composerFileRestore";
    import {
        shouldClearComposerAfterSend,
        shouldClearStoredDraft,
    } from "$lib/utils/composerClear";
    import { insertMention } from "$lib/utils/mentionInsert";
    import {
        parseSlashCommand,
        matchSlashCommands,
        usageFor,
        parseNickArg,
        parseOpArg,
        parseDeopArg,
        resolveMentionTokens,
        type SlashCommand,
    } from "$lib/utils/slashCommands";
    import { resolveUserArg } from "$lib/utils/userSearch";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { scrollBehavior } from "$lib/utils/motionPreference";
    import {
        Loader2,
        Plus,
        ImagePlay,
        Sticker,
        Smile,
        SendHorizontal,
    } from "lucide-svelte";

    interface Props {
        roomId: string;
        roomName: string;
        room?: Room;
        disabled?: boolean;
        replyToEvent?: MatrixEvent | null;
        onCancelReply?: () => void;
        onRequestEditLast?: () => void;
        /** "Create thread" (+ menu): the next sent message becomes a thread
         *  root and this fires with its event id so the caller can open it. */
        onThreadCreated?: (rootEventId: string) => void;
        scrollEl?: HTMLElement;
        threadRootId?: string | null;
        composerKey?: string;
        /** Bound out to the parent: true while a mention/emoji/slash suggestion
         *  list is showing, so it can hide the "jump to present" pill under it
         *  (Discord-style). */
        autocompleteOpen?: boolean;
    }

    let {
        roomId,
        roomName,
        room,
        disabled = false,
        replyToEvent = null,
        onCancelReply,
        onRequestEditLast,
        onThreadCreated,
        scrollEl,
        threadRootId = null,
        composerKey,
        autocompleteOpen = $bindable(false),
    }: Props = $props();

    const effComposerKey = $derived(composerKey ?? roomId);
    const isThread = $derived(threadRootId != null);

    let text = $state("");
    let isSending = $state(false);
    // In-flight attachment send, scoped to the room the send targeted so a
    // room switch mid-upload doesn't show room A's "sending" note in room B.
    let sendingFileCount = $state(0);
    let sendingRoomId = $state<string | null>(null);
    // Queued attachments live in a per-room store, not here: this component
    // stays mounted across room switches, so a local queue followed the user
    // into the next room and Send posted the file there (audit UX-01).
    const fileQueue = $derived(getFileQueue(effComposerKey));
    let textareaEl: HTMLDivElement | undefined = $state();
    let renderingComposer = false;

    // Voice messages: only offer the recorder when the browser can actually
    // record audio (feature-detected once — codec support doesn't change).
    const voiceSupported = pickAudioMimeType() !== "";
    let voiceRecorderOpen = $state(false);

    // "+ → Create thread": armed until the next plain message is sent, which
    // becomes the thread root (a Matrix thread needs a root event, so
    // "create" means "start a thread on what I'm about to say").
    let createThreadArmed = $state(false);

    // Expose a focus hook so the global "type to focus" shortcut (+page) can
    // focus this composer. Only the main composer claims the global hook.
    $effect(() => {
        if (!isThread) {
            interfaceState.focusComposer = () => textareaEl?.focus();
            return () => {
                if (interfaceState.focusComposer)
                    interfaceState.focusComposer = null;
            };
        }
    });
    let fileInputEl: HTMLInputElement | undefined = $state();
    let typingUsers = $state<string[]>([]);
    let typingStopTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTypingSentAt = 0;

    // Mention autocomplete
    let mentionQuery = $state<string | null>(null); // null = picker closed
    let mentionStart = $state(0); // index of the @ in `text`
    let mentionSelectedIdx = $state(0);
    // Map of displayName → userId for mentions inserted in the current message
    let pendingMentions = $state(new Map<string, string>());
    // Bumped once the room's full member list is loaded so the autocomplete can
    // re-derive with it. With lazy-loaded members, getRoomMembers only returns
    // members already seen in sync (e.g. anyone who has spoken) — so a bridge
    // ghost or quiet member is missing from @-autocomplete until we ask the SDK
    // to load the rest. Idempotent: loadMembersIfNeeded no-ops once loaded.
    let memberTick = $state(0);
    $effect(() => {
        if (mentionQuery === null || !room) return;
        const r = room;
        loadRoomMembersIfNeeded(r)
            .then(() => untrack(() => memberTick++))
            .catch(() => {});
    });

    const mentionCandidates = $derived.by(() => {
        void memberTick;
        if (mentionQuery === null || !room) return [];
        const q = mentionQuery.toLowerCase();
        const ownId = getOwnUserId();
        return getRoomMembers(room)
            .filter((m) => m.userId !== ownId)
            .filter(
                (m) =>
                    m.userId.toLowerCase().includes(q) ||
                    (m.rawDisplayName ?? "").toLowerCase().includes(q),
            )
            .slice(0, 8);
    });

    $effect(() => {
        // Clamp selection when candidate list changes
        if (mentionSelectedIdx >= mentionCandidates.length)
            mentionSelectedIdx = 0;
    });

    function getComposerText(): string {
        const raw = textareaEl?.innerText.replace(/\u00a0/g, " ") ?? "";
        // The canonical DOM keeps a placeholder <br> after a trailing line
        // break (and browsers keep one in an emptied contenteditable), which
        // innerText reports as one extra newline — drop exactly one.
        return raw.replace(/\n$/, "");
    }

    /**
     * Length of a node's content in composer-model characters: text length
     * plus one per <br>. The model (`text`, from innerText) represents line
     * breaks as "\n", but Range.toString() and text-node walks don't see
     * <br> elements at all \u2014 using them uncorrected desyncs every caret
     * offset by one per line break above it, scrambling edits and pastes in
     * multiline messages.
     */
    function modelLength(root: Node): number {
        let length = 0;
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        );
        let node = walker.nextNode();
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                length += node.textContent?.length ?? 0;
            } else if ((node as Element).tagName === "BR") {
                length += 1;
            }
            node = walker.nextNode();
        }
        return length;
    }

    function getCaretOffset(): number {
        if (!textareaEl) return text.length;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return text.length;
        const range = selection.getRangeAt(0);
        if (!textareaEl.contains(range.endContainer)) return text.length;

        const preCaret = range.cloneRange();
        preCaret.selectNodeContents(textareaEl);
        preCaret.setEnd(range.endContainer, range.endOffset);
        return modelLength(preCaret.cloneContents());
    }

    function setCaretOffset(offset: number): void {
        if (!textareaEl) return;
        // Creating a selection inside an unfocused contenteditable can make
        // mobile browsers focus it and reopen the soft keyboard. An unfocused
        // mobile composer does not need a programmatic caret; the user's next
        // tap will place it naturally.
        if (interfaceState.isMobile && document.activeElement !== textareaEl)
            return;
        const target = Math.max(0, Math.min(offset, getComposerText().length));
        const walker = document.createTreeWalker(
            textareaEl,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        );
        let remaining = target;
        let node = walker.nextNode();
        while (node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const len = node.textContent?.length ?? 0;
                if (remaining <= len) {
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.setStart(node, remaining);
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                    return;
                }
                remaining -= len;
            } else if ((node as Element).tagName === "BR") {
                if (remaining === 0) {
                    const range = document.createRange();
                    const selection = window.getSelection();
                    range.setStartBefore(node);
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);
                    return;
                }
                remaining -= 1;
            }
            node = walker.nextNode();
        }

        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(textareaEl);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    function detectMentionQuery() {
        const pos = getCaretOffset();
        const before = text.slice(0, pos);
        const match = before.match(/@(\S*)$/);
        if (match) {
            mentionQuery = match[1];
            mentionStart = pos - match[0].length;
        } else {
            mentionQuery = null;
        }
    }

    // The text shown after "@" for a mention. Normally the display name, but if
    // another member in the room shares that display name (e.g. same username on
    // a different homeserver) it's ambiguous, so fall back to the full Matrix ID
    // — that way the inserted "@<token>" uniquely identifies the right person.
    function mentionLabelFor(member: {
        userId: string;
        rawDisplayName?: string;
    }): string {
        const name = member.rawDisplayName?.trim();
        if (name && room) {
            const sharing = getRoomMembers(room).filter(
                (m) =>
                    (m.rawDisplayName ?? "").trim().toLowerCase() ===
                    name.toLowerCase(),
            );
            if (sharing.length <= 1) return name;
        } else if (name) {
            return name;
        }
        // Ambiguous (or no display name): use the MXID without its leading "@",
        // since the caller prepends one.
        return member.userId.replace(/^@/, "");
    }

    function commitMention(member: {
        userId: string;
        rawDisplayName?: string;
    }) {
        const label = mentionLabelFor(member);
        // Splice the pill in, consuming the partly-typed name and keeping exactly
        // one space before any following text (no double space mid-sentence).
        const inserted = insertMention({
            text,
            mentionStart,
            queryLength: mentionQuery?.length ?? 0,
            label,
        });
        text = inserted.text;
        // Record keyed by the full inserted token (incl. "@") so distinct users
        // who happen to share a display name map to distinct, unambiguous keys.
        pendingMentions = new Map([
            ...pendingMentions,
            ["@" + label, member.userId],
        ]);
        mentionQuery = null;
        tick().then(() => {
            renderComposer(inserted.caret);
            textareaEl?.focus();
        });
    }

    // Emoji autocomplete
    type EmojiCandidate =
        | { kind: "unicode"; emoji: string; name: string }
        | { kind: "custom"; shortcode: string; url: string };

    let emojiQuery = $state<string | null>(null);
    let emojiStart = $state(0);
    let emojiSelectedIdx = $state(0);

    const emojiCandidates = $derived.by((): EmojiCandidate[] => {
        if (emojiQuery === null || emojiQuery.length < 2) return [];
        const q = emojiQuery.toLowerCase();
        const custom = getCustomEmojis(room, roomsState.activeSpaceId)
            .filter((e) => e.shortcode.toLowerCase().includes(q))
            .slice(0, 5)
            .map(
                (e): EmojiCandidate => ({
                    kind: "custom",
                    shortcode: e.shortcode,
                    url: e.url,
                }),
            );
        const unicode = ALL_EMOJIS.filter((e) =>
            e.name.toLowerCase().includes(q),
        )
            .slice(0, 8 - custom.length)
            .map(
                (e): EmojiCandidate => ({
                    kind: "unicode",
                    emoji: e.emoji,
                    name: e.name,
                }),
            );
        return [...custom, ...unicode];
    });

    $effect(() => {
        if (emojiSelectedIdx >= emojiCandidates.length) emojiSelectedIdx = 0;
    });

    // Slash-command autocomplete
    let slashQuery = $state<string | null>(null); // null = popup closed
    let slashSelectedIdx = $state(0);

    const slashCandidates = $derived.by((): SlashCommand[] =>
        slashQuery === null ? [] : matchSlashCommands(slashQuery),
    );

    $effect(() => {
        if (slashSelectedIdx >= slashCandidates.length) slashSelectedIdx = 0;
    });

    // True while any suggestion list (mention/emoji/slash) is actually showing.
    // Bound out so the parent hides the "jump to present" pill under it.
    const anyAutocompleteOpen = $derived(
        (mentionQuery !== null && mentionCandidates.length > 0) ||
            (emojiQuery !== null && emojiCandidates.length > 0) ||
            (slashQuery !== null && slashCandidates.length > 0),
    );
    $effect(() => {
        autocompleteOpen = anyAutocompleteOpen;
    });

    function detectSlashQuery() {
        // The popup shows only while the whole composer is one "/word" token (the
        // command name, no space yet) and nothing is queued — never for a
        // mid-message slash or a pending caption.
        if (fileQueue.length > 0) {
            slashQuery = null;
            return;
        }
        const match = text.match(/^\/(\w*)$/);
        slashQuery = match ? match[1] : null;
    }

    function commitSlashCommand(command: SlashCommand) {
        setComposerText(`/${command.name} `);
        slashQuery = null;
        textareaEl?.focus();
    }

    function detectEmojiQuery() {
        const pos = getCaretOffset();
        const before = text.slice(0, pos);
        // Match :word with no closing colon yet (at least 1 char after :)
        const match = before.match(/:(\w+)$/);
        if (match) {
            emojiQuery = match[1];
            emojiStart = pos - match[0].length;
        } else {
            emojiQuery = null;
        }
    }

    function commitEmoji(candidate: EmojiCandidate) {
        const queryLen = emojiQuery?.length ?? 0;
        const before = text.slice(0, emojiStart);
        const after = text.slice(emojiStart + 1 + queryLen);
        if (candidate.kind === "unicode") {
            text = before + candidate.emoji + " " + after.replace(/^\S*/, "");
            const newPos = emojiStart + candidate.emoji.length + 1;
            tick().then(() => {
                renderComposer(newPos);
                textareaEl?.focus();
            });
        } else {
            const insertion = `:${candidate.shortcode}: `;
            text = before + insertion + after.replace(/^\S*/, "");
            const newPos = emojiStart + insertion.length;
            tick().then(() => {
                renderComposer(newPos);
                textareaEl?.focus();
            });
        }
        emojiQuery = null;
    }

    // Subscribe to typing events for the current room
    $effect(() => {
        if (!room) return;
        const currentRoom = room;
        typingUsers = [];
        return onTypingEvent(currentRoom, (userIds) => {
            typingUsers = userIds;
        });
    });

    // Stop broadcasting our own typing when the composer unmounts or the room
    // switches. With the 25s server timeout a missed stop leaves a stale "…is
    // typing" indicator lingering for other users, so this is required. The
    // stop is sent from the effect teardown (untracked context), so it can't
    // form a reactive loop.
    $effect(() => {
        const currentRoom = room;
        if (!currentRoom) return;
        return () => {
            if (typingStopTimer) {
                clearTimeout(typingStopTimer);
                typingStopTimer = null;
            }
            lastTypingSentAt = 0;
            sendTyping(currentRoom.roomId, false);
        };
    });

    function typingText(): string {
        if (!room || typingUsers.length === 0) return "";
        const names = typingUsers
            .slice(0, 3)
            .map((id) => getMemberName(room!, id));
        if (typingUsers.length === 1) return `${names[0]} is typing…`;
        if (typingUsers.length === 2)
            return `${names[0]} and ${names[1]} are typing…`;
        if (typingUsers.length === 3)
            return `${names[0]}, ${names[1]}, and ${names[2]} are typing…`;
        return "Several people are typing…";
    }

    export function focus() {
        textareaEl?.focus();
    }

    export function addFiles(files: File[]) {
        for (const file of files) enqueueFile(file);
    }
    // Composer pickers share the single interfaceState.modal "composer-picker"
    // slot; pickerKind says which one is shown.
    const composerPickerOpen = $derived(
        interfaceState.modal === "composer-picker",
    );
    const showActionsMenu = $derived(
        interfaceState.modal === "composer-actions",
    );
    const showEmojiPicker = $derived(
        composerPickerOpen &&
            interfaceState.composerPicker === "emoji" &&
            interfaceState.composerPickerOwner === effComposerKey,
    );
    const showStickerPicker = $derived(
        composerPickerOpen &&
            interfaceState.composerPicker === "sticker" &&
            interfaceState.composerPickerOwner === effComposerKey,
    );
    const showGifPicker = $derived(
        composerPickerOpen &&
            interfaceState.composerPicker === "gif" &&
            interfaceState.composerPickerOwner === effComposerKey,
    );
    // Mirrors the send button's own disabled condition so the button can go
    // accent-coloured the moment the message becomes sendable.
    const canSend = $derived(
        (text.trim().length > 0 || fileQueue.length > 0) &&
            !isSending &&
            !disabled,
    );
    let textareaFocusedBeforePicker = false;

    // Track keyboard height on mobile so pickers stay above it
    let keyboardOffset = $state(0);
    $effect(() => {
        if (!interfaceState.isTouchscreen) {
            keyboardOffset = 0;
            return;
        }
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => {
            keyboardOffset = Math.max(
                0,
                window.innerHeight - vv.height - vv.offsetTop,
            );
        };
        vv.addEventListener("resize", update);
        vv.addEventListener("scroll", update);
        update();
        return () => {
            vv.removeEventListener("resize", update);
            vv.removeEventListener("scroll", update);
        };
    });

    function anyPickerOpen() {
        return composerPickerOpen;
    }

    function openPicker(which: "emoji" | "sticker" | "gif") {
        if (!anyPickerOpen()) {
            textareaFocusedBeforePicker = document.activeElement === textareaEl;
        }
        openComposerPicker(which, effComposerKey);
    }

    function closePicker(
        _which: "emoji" | "sticker" | "gif",
        refocus: boolean,
    ) {
        closeModal();
        if (refocus && textareaFocusedBeforePicker) textareaEl?.focus();
    }

    const replyTargetName = $derived.by(() => {
        // roomsTick so a late member load / display-name change re-resolves the
        // name — a live Room mutation in place won't otherwise re-run this and
        // the preview would be stuck on the raw @mxid.
        void roomsState.roomsTick;
        if (!replyToEvent) return null;
        const sender = replyToEvent.getSender() ?? "";
        return room ? getMemberName(room, sender) : sender;
    });
    const composerPlaceholder = $derived(
        disabled
            ? "Select a room to start chatting"
            : isThread
              ? "Reply in thread..."
              : replyToEvent
                ? `Reply to ${replyTargetName}...`
                : `Message #${roomName}`,
    );

    // Focus textarea when reply is set
    $effect(() => {
        if (replyToEvent) {
            textareaEl?.focus();
        }
    });

    function buildFormattedBody(plain: string): {
        html: string | null;
        mentionedUserIds: string[];
    } {
        return buildBody(plain, {
            mentions: pendingMentions,
            customEmojis: getCustomEmojis(room, roomsState.activeSpaceId),
            memberIds: room
                ? new Set(getRoomMembers(room).map((m) => m.userId))
                : undefined,
        });
    }

    function escapeHtml(plain: string): string {
        return plain
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function renderCustomEmojiToken(token: string): string | null {
        const shortcode = token.slice(1, -1);
        const emoji = getCustomEmojis(room, roomsState.activeSpaceId).find(
            (e) => e.shortcode === shortcode,
        );
        const src = emoji ? mxcToHttp(emoji.mxcUrl) : null;
        if (!src) return null;
        return `<span class="composer-custom-emoji"><img src="${escapeHtml(src)}" alt="" draggable="false" contenteditable="false" />${escapeHtml(token)}</span>`;
    }

    function isMentionToken(token: string): boolean {
        if (!token.startsWith("@") || token.length < 2) return false;
        // Keys include the leading "@" (e.g. "@alice" or "@alice:hs").
        if (pendingMentions.has(token)) return true;
        const name = token.slice(1).replace(/[.,!?;:]$/, "");
        if (!room) return false;
        return getRoomMembers(room).some(
            (m) =>
                m.userId === token ||
                m.userId.toLowerCase().includes(name.toLowerCase()) ||
                (m.rawDisplayName ?? "").toLowerCase() === name.toLowerCase(),
        );
    }

    function decorateInline(plain: string): string {
        const tokenRe =
            /(https?:\/\/[^\s<>)"']+|@[^\s<]+|`[^`\n]+`|\*\*\*[^*\n][\s\S]*?\*\*\*|\*\*[^*\n][\s\S]*?\*\*|(?<![\w])__[^_\n][\s\S]*?__(?![\w])|\*[^*\n]+\*|(?<![\w])_[^_\n]+_(?![\w])|~~[^~\n]+~~|\|\|[^|\n]+\|\||:[a-zA-Z0-9_+-]+:)/g;
        let html = "";
        let pos = 0;
        for (const match of plain.matchAll(tokenRe)) {
            const token = match[0];
            const index = match.index ?? 0;
            html += escapeHtml(plain.slice(pos, index));

            const customEmoji = renderCustomEmojiToken(token);
            if (customEmoji) {
                html += customEmoji;
            } else if (token.startsWith("@") && isMentionToken(token)) {
                html += `<span class="composer-mention">${escapeHtml(token)}</span>`;
            } else if (
                token.startsWith("http://") ||
                token.startsWith("https://")
            ) {
                html += `<span class="composer-link">${escapeHtml(token)}</span>`;
            } else if (token.startsWith("`")) {
                html += `<code>${escapeHtml(token)}</code>`;
            } else if (token.startsWith("||")) {
                html += `<span class="composer-spoiler">${escapeHtml(token)}</span>`;
            } else if (token.startsWith("~~")) {
                html += `<del>${escapeHtml(token)}</del>`;
            } else if (token.startsWith("***")) {
                html += `<strong><em>${escapeHtml(token)}</em></strong>`;
            } else if (token.startsWith("**")) {
                html += `<strong>${escapeHtml(token)}</strong>`;
            } else if (token.startsWith("__")) {
                html += `<u>${escapeHtml(token)}</u>`;
            } else if (token.startsWith("*") || token.startsWith("_")) {
                html += `<em>${escapeHtml(token)}</em>`;
            } else {
                html += escapeHtml(token);
            }
            pos = index + token.length;
        }
        html += escapeHtml(plain.slice(pos));
        let out = html.replace(/\n/g, "<br>");
        // A trailing <br> renders as nothing in a contenteditable (and drops
        // out of innerText), so a message ending in a newline needs a
        // placeholder <br> to keep the empty line visible and round-trippable.
        if (plain.endsWith("\n")) out += "<br>";
        return out;
    }

    function renderComposer(caretOffset = getCaretOffset()): void {
        if (!textareaEl) return;
        renderingComposer = true;
        textareaEl.innerHTML = decorateInline(text);
        renderingComposer = false;
        setCaretOffset(caretOffset);
    }

    function setComposerText(next: string, caretOffset = next.length): void {
        text = next;
        tick().then(() => renderComposer(caretOffset));
    }

    // Per-room draft. Keyed on effComposerKey so it re-runs both when the room switches
    // (this component stays mounted) and when it unmounts/remounts (flipping to
    // the call view unmounts MessageArea), AND when switching between main/thread.
    // The body loads the incoming composer instance's draft; the cleanup saves the
    // outgoing instance's draft (Svelte runs cleanup before the re-run, so leaving
    // A saves A before B loads, and destroy saves the current instance).
    // untrack() keeps the effect tracking only effComposerKey — never `text` or
    // the drafts store — so it never reloads what the user is typing.
    $effect(() => {
        const key = effComposerKey;
        // A channel switch should close the mobile keyboard. The same
        // contenteditable stays mounted across rooms, so otherwise it can
        // retain focus while the incoming room's draft is restored.
        if (untrack(() => interfaceState.isMobile)) textareaEl?.blur();
        // Close any open voice recorder when the room changes — this component
        // stays mounted across room switches, so an open recorder would otherwise
        // persist and send its audio to the newly-selected room.
        voiceRecorderOpen = false;
        // An armed "create thread" must not carry over to another room either.
        createThreadArmed = false;
        untrack(() => {
            const draft = getDraft(key);
            text = draft?.text ?? "";
            pendingMentions = new Map(draft?.mentions ?? []);
            tick().then(() => renderComposer(text.length));
        });
        return () => setDraft(key, text, pendingMentions);
    });

    function splitUserAndReason(arg: string): {
        user: string;
        reason?: string;
    } {
        const trimmed = arg.trim();
        const idx = trimmed.search(/\s/);
        if (idx === -1) return { user: trimmed };
        return {
            user: trimmed.slice(0, idx),
            reason: trimmed.slice(idx + 1).trim() || undefined,
        };
    }

    // A user token from a slash command: a full mxid, a mention pill's
    // display name (unique members only), or a localpart for our homeserver.
    function resolveUserOrThrow(token: string): string {
        const userId = resolveUserArg(
            token,
            getOwnServerName(),
            room ? getRoomMembers(room) : [],
        );
        if (!userId) throw new Error(`"${token}" is not a valid user`);
        return userId;
    }

    async function applyPowerLevel(token: string, level: number) {
        if (!room) throw new Error("No room selected");
        const userId = resolveUserOrThrow(token);
        if (!room.getMember(userId))
            throw new Error(`${userId} is not in this room`);
        const pl = getRoomPowerLevels(room);
        const required = pl.events["m.room.power_levels"] ?? pl.state_default;
        if (getMyPowerLevel(room) < required)
            throw new Error(
                "You don't have permission to change power levels in this room",
            );
        await setUserPowerLevel(room, userId, level);
    }

    async function runSlashAction(command: SlashCommand, arg: string) {
        switch (command.name) {
            case "join":
                await joinRoomByAlias(arg.trim());
                break;
            case "part":
                await leaveRoom(roomId);
                break;
            case "invite":
                await inviteUser(roomId, resolveUserOrThrow(arg.trim()));
                break;
            case "topic":
                await setRoomTopic(roomId, arg);
                break;
            case "kick": {
                const { user, reason } = splitUserAndReason(arg);
                await kickUser(roomId, resolveUserOrThrow(user), reason);
                break;
            }
            case "ban": {
                const { user, reason } = splitUserAndReason(arg);
                await banUser(roomId, resolveUserOrThrow(user), reason);
                break;
            }
            case "nick": {
                const r = parseNickArg(arg);
                if ("error" in r) throw new Error(r.error);
                await setOwnDisplayName(r.name);
                break;
            }
            case "op": {
                const r = parseOpArg(arg);
                if ("error" in r) throw new Error(r.error);
                await applyPowerLevel(r.user, r.level);
                break;
            }
            case "deop": {
                const r = parseDeopArg(arg);
                if ("error" in r) throw new Error(r.error);
                await applyPowerLevel(r.user, 0);
                break;
            }
            default:
                throw new Error(`Unhandled command: /${command.name}`);
        }
    }

    async function dispatchSlashCommand(command: SlashCommand, arg: string) {
        if (command.requiresArg && !arg) {
            showErrorToast(usageFor(command));
            return;
        }

        // Mention pills put display names in the text ("@Ann"), not mxids —
        // swap them back before a user-arg command parses its argument.
        if (command.argKind === "user")
            arg = resolveMentionTokens(arg, pendingMentions);

        // Stop our typing indicator — send() does this too, but command dispatch
        // returns before reaching that point.
        if (typingStopTimer) {
            clearTimeout(typingStopTimer);
            typingStopTimer = null;
        }
        if (room) sendTyping(room.roomId, false);
        // Reset the refresh gate so the next keystroke re-broadcasts typing
        // immediately rather than waiting out the 20s window.
        lastTypingSentAt = 0;

        // Action commands call a client.ts wrapper; they aren't messages, so no
        // local echo. Clear the composer only on success.
        if (command.kind === "action") {
            isSending = true;
            try {
                await runSlashAction(command, arg);
                text = "";
                slashQuery = null;
                mentionQuery = null;
                pendingMentions = new Map();
                clearDraft(effComposerKey);
                renderComposer(0);
            } catch (err) {
                showErrorToast(matrixErrorMessage(err, "Command failed"));
            } finally {
                isSending = false;
                textareaEl?.focus();
            }
            return;
        }

        // Dialog commands open a modal instead of sending anything; clear the
        // "/poll" text out of the composer first.
        if (command.kind === "dialog") {
            text = "";
            slashQuery = null;
            clearDraft(effComposerKey);
            renderComposer(0);
            if (command.name === "poll") openCreatePollDialog(roomId);
            else if (command.name === "location")
                openShareLocationDialog(roomId);
            textareaEl?.focus();
            return;
        }

        // emote + text-transform both produce a message body sent like a normal
        // message (markdown + mentions), except /plain which bypasses markdown.
        const body = command.kind === "emote" ? arg : command.transform!(arg);
        const usePlain = command.kind === "text-transform" && !!command.plain;
        // Resolve formatting before clearing the composer (buildFormattedBody
        // reads pendingMentions, reset below).
        const formatted = usePlain ? null : buildFormattedBody(body);
        const replyTarget = replyToEvent;

        isSending = true;
        text = "";
        mentionQuery = null;
        emojiQuery = null;
        slashQuery = null;
        pendingMentions = new Map();
        clearDraft(effComposerKey);
        renderComposer(0);

        try {
            const mentions =
                formatted && formatted.mentionedUserIds.length > 0
                    ? { user_ids: formatted.mentionedUserIds }
                    : undefined;
            if (command.kind === "emote") {
                await sendEmote(
                    roomId,
                    body,
                    formatted?.html ?? undefined,
                    mentions,
                    isThread ? { rootEventId: threadRootId! } : undefined,
                );
            } else if (isThread) {
                // In a thread, every message-producing slash command must land
                // in the thread — otherwise /plain, /shrug, /spoiler etc. would
                // silently escape to the main timeline. usePlain bypasses
                // markdown (no formatted body).
                await sendThreadReply(
                    roomId,
                    threadRootId!,
                    body,
                    mentions,
                    usePlain ? undefined : (formatted?.html ?? undefined),
                );
            } else if (usePlain) {
                await sendTextMessage(roomId, body);
            } else if (formatted?.html) {
                await sendFormattedMessage(
                    roomId,
                    body,
                    formatted.html,
                    mentions,
                );
            } else {
                await sendTextMessage(roomId, body);
            }
            // A slash message-command is not a reply — clear any in-progress
            // reply so the banner doesn't leak onto the user's next message.
            if (replyTarget) onCancelReply?.();
            await tick();
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        } catch (err) {
            console.error("Slash command failed:", err);
            showErrorToast(matrixErrorMessage(err, "Failed to send"));
        } finally {
            isSending = false;
            textareaEl?.focus();
        }
    }

    /** Clear the composer after a send lands. `forRoomId` is the room the send
     *  targeted and `textAtSend` is the text it captured at entry — a caption
     *  resolves when its upload finishes, which can be long after Send with the
     *  composer still editable in the meantime.
     *
     *  Both halves are conditional, for the same reason: neither the stored
     *  draft nor the visible buffer is ours to wipe once the user has moved on
     *  from the text we sent. See shouldClearStoredDraft and
     *  shouldClearComposerAfterSend. */
    function clearComposerAfterSend(forKey: string, textAtSend: string) {
        // `forKey` is the composer INSTANCE key (roomId for the main composer,
        // the thread key for a thread composer): drafts are stored per instance,
        // and the "did the user move on" identity check compares the current
        // instance key against the one the send captured. For the main composer
        // effComposerKey === roomId, so this is identical to keying on roomId.
        if (
            shouldClearStoredDraft({
                storedText: getDraft(forKey)?.text ?? null,
                textAtSend,
            })
        )
            clearDraft(forKey);
        if (
            !shouldClearComposerAfterSend({
                currentRoomId: effComposerKey,
                targetRoomId: forKey,
                currentText: text,
                textAtSend,
            })
        )
            return;
        text = "";
        mentionQuery = null;
        emojiQuery = null;
        pendingMentions = new Map();
        renderComposer(0);
    }

    async function send() {
        // Slash-command dispatch — only when no files are queued (with files the
        // text is a caption, not a command).
        if (!isSending && !disabled && fileQueue.length === 0) {
            const parsed = parseSlashCommand(text);
            if (parsed && "unknown" in parsed) {
                showErrorToast(`Unknown command: /${parsed.unknown}`);
                return;
            }
            if (parsed && "command" in parsed) {
                await dispatchSlashCommand(parsed.command, parsed.arg);
                return;
            }
            // A bare "/" (popup dismissed, no command name typed) is not a
            // message — don't post a literal slash via the send button.
            if (/^\s*\/\s*$/.test(text)) return;
            // "//text" escape → strip one leading slash and send as a literal
            // message that starts with a single slash.
            if (/^\s*\/\//.test(text)) {
                text = text.replace("/", "");
            }
        }

        const trimmed = text.trim();
        if ((!trimmed && fileQueue.length === 0) || isSending || disabled)
            return;

        if (typingStopTimer) {
            clearTimeout(typingStopTimer);
            typingStopTimer = null;
        }
        if (room) sendTyping(room.roomId, false);
        // Reset the refresh gate so the next keystroke re-broadcasts typing
        // immediately rather than waiting out the 20s window.
        lastTypingSentAt = 0;

        isSending = true;
        // Everything below targets the room the user pressed Send in — a room
        // or thread switch mid-upload must not retarget a send, a queue removal,
        // or a draft write.
        const targetRoomId = roomId;
        const targetComposerKey = effComposerKey;
        // Snapshot the composer text too, before anything can mutate it: a
        // caption commit that lands after the user typed on must not wipe the
        // new sentence (nor yank the caret back to 0).
        const textAtSend = text;
        const filesToSend = fileQueue.slice();
        // Clear the drawer up front so in-flight attachments don't look
        // attached to the next message the user starts composing. The files
        // are already snapshotted in filesToSend; a failure restores only the
        // unsent ones below. clearFileQueue revokes the preview URLs it owns —
        // restore recreates fresh ones.
        if (filesToSend.length > 0) {
            // Key on the COMPOSER (thread or room), matching getFileQueue above —
            // a thread send must clear the thread's drawer, not the room's.
            clearFileQueue(targetComposerKey);
            sendingRoomId = targetRoomId;
            sendingFileCount = filesToSend.length;
        }
        // Resolve mentions before clearing the composer below (buildFormattedBody
        // reads pendingMentions, which we reset up front).
        const formatted = trimmed ? buildFormattedBody(trimmed) : null;

        // When files are queued alongside text (and we're not replying), attach
        // the text to the first file as a caption (MSC2530) rather than sending
        // it as a separate message.
        const useCaption =
            !!trimmed && !!formatted && filesToSend.length > 0 && !replyToEvent;

        // The SDK creates the local echo synchronously, so a text message shows
        // in the timeline the moment we send it — with a retry/delete affordance
        // there if it fails (see MessageItem). Clear the composer up front so the
        // message isn't shown in two places and can't be sent twice by accident.
        // A caption has no local echo until its upload finishes, so that case
        // clears on success instead (below) and the text survives a failure.
        if (trimmed && !useCaption)
            clearComposerAfterSend(targetComposerKey, textAtSend);

        const sentIds = new Set<string>();

        // Offline: queue the text message in the app-level outbox instead of
        // letting the SDK create a room-blocking NOT_SENT echo. Non-thread,
        // no-attachment text/reply only (threads + files keep their existing
        // paths). The composer was already cleared up front (above), matching a
        // normal send's UX.
        if (
            trimmed &&
            formatted &&
            !useCaption &&
            filesToSend.length === 0 &&
            !isThread &&
            shouldQueueSend({
                syncState: auth.syncState,
                online: navigator.onLine,
            })
        ) {
            const { html, mentionedUserIds } = formatted;
            const mentions =
                mentionedUserIds.length > 0
                    ? { user_ids: mentionedUserIds }
                    : undefined;
            const content: Record<string, unknown> = replyToEvent
                ? (buildReplyContent({
                      replyEventId: replyToEvent.getId()!,
                      text: trimmed,
                      formattedText: html ?? undefined,
                      mentions,
                  }) as unknown as Record<string, unknown>)
                : html
                  ? buildFormattedContent(trimmed, html, mentions)
                  : buildTextContent(trimmed);
            queueMessage(targetRoomId, content);
            if (replyToEvent) onCancelReply?.();
            createThreadArmed = false;
            isSending = false;
            textareaEl?.focus();
            return;
        }

        try {
            if (trimmed && formatted && !useCaption) {
                const { html, mentionedUserIds } = formatted;
                const mentions =
                    mentionedUserIds.length > 0
                        ? { user_ids: mentionedUserIds }
                        : undefined;
                let sentEventId: string;
                if (isThread) {
                    // Thread replies always route via sendThreadReply (no reply-to-
                    // within-thread in v1 — replyToEvent is not passed in thread mode).
                    await sendThreadReply(
                        targetRoomId,
                        threadRootId!,
                        trimmed,
                        mentions,
                        html ?? undefined,
                    );
                } else {
                    if (replyToEvent) {
                        sentEventId = await sendReply(
                            targetRoomId,
                            trimmed,
                            replyToEvent,
                            html ?? undefined,
                            mentions,
                        );
                        onCancelReply?.();
                    } else if (html) {
                        sentEventId = await sendFormattedMessage(
                            targetRoomId,
                            trimmed,
                            html,
                            mentions,
                        );
                    } else {
                        sentEventId = await sendTextMessage(
                            targetRoomId,
                            trimmed,
                        );
                    }
                    if (createThreadArmed) {
                        createThreadArmed = false;
                        onThreadCreated?.(sentEventId);
                    }
                }
            }
            // Commit each file as it lands: a failure halfway must leave the
            // unsent files queued so a retry sends only those (audit MEDIA-03).
            await sendQueuedFilesInOrder(
                filesToSend,
                (item, i) => {
                    if (useCaption && i === 0 && formatted) {
                        const { html, mentionedUserIds } = formatted;
                        return sendFile(
                            targetRoomId,
                            item.file,
                            {
                                body: trimmed,
                                formattedBody: html ?? undefined,
                                mentions:
                                    mentionedUserIds.length > 0
                                        ? { user_ids: mentionedUserIds }
                                        : undefined,
                            },
                            isThread
                                ? { rootEventId: threadRootId! }
                                : undefined,
                        );
                    }
                    return sendFile(
                        targetRoomId,
                        item.file,
                        undefined,
                        isThread ? { rootEventId: threadRootId! } : undefined,
                    );
                },
                (item, i) => {
                    // The drawer was already cleared optimistically; just record
                    // the success so a later failure won't restore this file.
                    sentIds.add(item.id);
                    // The caption rode on the first file — it's only safely
                    // sent once that file is.
                    if (useCaption && i === 0)
                        clearComposerAfterSend(targetComposerKey, textAtSend);
                },
            );
            // Snap scroll to bottom after input shrinks — prevents content from drifting up
            await tick();
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        } catch (err) {
            console.error("Failed to send:", err);
            showErrorToast(matrixErrorMessage(err, "Failed to send"));
            // Restore ONLY the files that were not successfully sent — an
            // already-sent file must never come back (would duplicate on the
            // next send: audit MEDIA-03). The optimistic clear revoked the
            // originals' preview URLs, so recreate them the same way enqueueFile
            // does. Restore targets the COMPOSER the send was for (thread or
            // room), not the one the user may have switched to.
            const toRestore = filesToRestoreAfterSend(filesToSend, sentIds);
            for (const item of toRestore) {
                const previewUrl = item.file.type.startsWith("image/")
                    ? URL.createObjectURL(item.file)
                    : null;
                addQueuedFile(
                    targetComposerKey,
                    item.file,
                    item.name,
                    previewUrl,
                );
            }
        } finally {
            isSending = false;
            sendingFileCount = 0;
            sendingRoomId = null;
            textareaEl?.focus();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if ((e.key === "PageUp" || e.key === "PageDown") && scrollEl) {
            e.preventDefault();
            scrollEl.scrollBy({
                top:
                    e.key === "PageUp"
                        ? -scrollEl.clientHeight * 0.85
                        : scrollEl.clientHeight * 0.85,
                behavior: scrollBehavior(),
            });
        }

        // Slash-command picker navigation
        if (slashQuery !== null && slashCandidates.length > 0) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                slashSelectedIdx =
                    (slashSelectedIdx - 1 + slashCandidates.length) %
                    slashCandidates.length;
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                slashSelectedIdx =
                    (slashSelectedIdx + 1) % slashCandidates.length;
                return;
            }
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const command = slashCandidates[slashSelectedIdx];
                if (command) commitSlashCommand(command);
                return;
            }
            if (e.key === "Escape") {
                slashQuery = null;
                return;
            }
        }

        // Mention picker navigation
        if (mentionQuery !== null && mentionCandidates.length > 0) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                mentionSelectedIdx =
                    (mentionSelectedIdx - 1 + mentionCandidates.length) %
                    mentionCandidates.length;
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                mentionSelectedIdx =
                    (mentionSelectedIdx + 1) % mentionCandidates.length;
                return;
            }
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const member = mentionCandidates[mentionSelectedIdx];
                if (member) commitMention(member);
                return;
            }
            if (e.key === "Escape") {
                mentionQuery = null;
                return;
            }
        }

        // Emoji picker navigation
        if (emojiQuery !== null && emojiCandidates.length > 0) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                emojiSelectedIdx =
                    (emojiSelectedIdx - 1 + emojiCandidates.length) %
                    emojiCandidates.length;
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                emojiSelectedIdx =
                    (emojiSelectedIdx + 1) % emojiCandidates.length;
                return;
            }
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const candidate = emojiCandidates[emojiSelectedIdx];
                if (candidate) commitEmoji(candidate);
                return;
            }
            if (e.key === "Escape") {
                emojiQuery = null;
                return;
            }
        }

        // Insert line breaks through the model rather than letting the
        // browser mutate the contenteditable: the browser's own <br>
        // insertions (and their placeholder quirks) drift out of sync with
        // the canonical form renderComposer produces.
        if (e.key === "Enter" && e.shiftKey && !e.isComposing) {
            e.preventDefault();
            insertLineBreakAtCaret();
            return;
        }

        // Send on a *physical* Enter. Virtual/soft keyboards (Android) and IME
        // composition report keyCode 229 / isComposing — treat those as a
        // newline. Phones always treat Enter as newline (use the send button).
        const physicalEnter =
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.isComposing &&
            (e as KeyboardEvent & { keyCode: number }).keyCode !== 229;
        if (physicalEnter && !interfaceState.isMobile) {
            e.preventDefault();
            send();
        }
        // Picker dismissal is handled centrally (+page Escape/back). Here we
        // only cancel an in-progress reply, and only when nothing else is open.
        if (
            e.key === "Escape" &&
            !interfaceState.modal &&
            !interfaceState.sidebar &&
            replyToEvent
        ) {
            onCancelReply?.();
        }
        // Ctrl+E / Ctrl+S / Ctrl+G (open pickers) are global shortcuts handled
        // centrally in +page.svelte.
        if (e.key === "ArrowUp" && !text) {
            e.preventDefault();
            onRequestEditLast?.();
        }
    }

    function insertGif(url: string) {
        const next = text ? text + " " + url : url;
        setComposerText(next);
        closeModal();
        textareaEl?.focus();
    }

    function insertEmoji(emoji: string) {
        setComposerText(text + emoji);
        closeModal();
        textareaEl?.focus();
    }

    function insertCustomEmoji(emoji: CustomEmoji) {
        setComposerText(text + `:${emoji.shortcode}:`);
        closeModal();
        textareaEl?.focus();
    }

    async function sendStickerMessage(sticker: CustomSticker) {
        if (isSending || disabled) return;
        isSending = true;
        try {
            await sendSticker(
                roomId,
                sticker,
                isThread ? { rootEventId: threadRootId! } : undefined,
            );
        } catch (err) {
            console.error("Failed to send sticker:", err);
        } finally {
            isSending = false;
            textareaEl?.focus();
        }
    }

    function enqueueFile(file: File, defaultName?: string) {
        const name = file.name || defaultName || "file";
        const previewUrl = file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : null;
        addQueuedFile(effComposerKey, file, name, previewUrl);
        textareaEl?.focus();
    }

    function removeFromQueue(id: string) {
        removeQueuedFile(effComposerKey, id);
    }

    /** Model length of the current selection ("" when collapsed). */
    function getSelectedLength(): number {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return 0;
        const range = selection.getRangeAt(0);
        if (!textareaEl?.contains(range.endContainer)) return 0;
        return modelLength(range.cloneContents());
    }

    function insertLineBreakAtCaret(): void {
        const end = getCaretOffset();
        const selected = getSelectedLength();
        const start = end - selected;
        const next = text.slice(0, start) + "\n" + text.slice(end);
        setComposerText(next, start + 1);
    }

    // Soft keyboards and IMEs insert newlines via input events, not an Enter
    // keydown — route those through the model too.
    function onBeforeInput(e: InputEvent) {
        if (
            e.inputType === "insertLineBreak" ||
            e.inputType === "insertParagraph"
        ) {
            e.preventDefault();
            insertLineBreakAtCaret();
        }
    }

    function onPaste(e: ClipboardEvent) {
        const file = [...(e.clipboardData?.items ?? [])]
            .find(
                (item) =>
                    item.kind === "file" && item.type.startsWith("image/"),
            )
            ?.getAsFile();
        if (file) {
            e.preventDefault();
            const ts = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            enqueueFile(file, `pasted-image-${ts}.png`);
            return;
        }

        // Always take over the paste so raw clipboard HTML is never inserted
        // into the contenteditable. If only text/html is available, project it
        // down to plain text via textContent (parsing does not execute scripts).
        e.preventDefault();
        let pastedText = e.clipboardData?.getData("text/plain") ?? "";
        if (!pastedText) {
            const html = e.clipboardData?.getData("text/html");
            if (html) {
                pastedText =
                    new DOMParser().parseFromString(html, "text/html").body
                        .textContent ?? "";
            }
        }
        if (!pastedText) return;
        const end = getCaretOffset();
        const selected = getSelectedLength();
        const start = end - selected;
        const next = text.slice(0, start) + pastedText + text.slice(end);
        setComposerText(next, start + pastedText.length);
    }

    function onFileSelected(e: Event) {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        for (const file of files) enqueueFile(file);
        if (fileInputEl) fileInputEl.value = "";
    }

    function onInput() {
        if (!textareaEl || renderingComposer) return;
        const caret = getCaretOffset();
        text = getComposerText();
        renderComposer(caret);
        detectMentionQuery();
        detectEmojiQuery();
        detectSlashQuery();

        if (room) {
            const now = Date.now();
            // Refresh the typing notification 5s before the 25s server timeout
            // (see sendTyping in client.ts) so the indicator never flickers off
            // between keystrokes.
            if (now - lastTypingSentAt >= 20_000) {
                lastTypingSentAt = now;
                sendTyping(room.roomId, true);
            }
            // Idle-stop timer (UX): stop showing typing ~5s after the user
            // pauses. Separate from the wire timeout above.
            if (typingStopTimer) clearTimeout(typingStopTimer);
            typingStopTimer = setTimeout(() => {
                if (room) sendTyping(room.roomId, false);
                lastTypingSentAt = 0;
            }, 5000);
        }
    }

    function getReplyPreview(): string {
        if (!replyToEvent) return "";
        const content = replyToEvent.getContent();
        const body: string = content?.body ?? "";
        // Strip nested fallback quote prefix if present
        const parts = body.split("\n\n");
        const actual =
            parts.length >= 2 && parts[0].startsWith(">")
                ? parts.slice(1).join("\n\n")
                : body;
        return actual.length > 80 ? actual.slice(0, 80) + "…" : actual;
    }
</script>

<div
    class="px-4 pt-2 pb-[calc(1rem_+_env(safe-area-inset-bottom,0px))] md:pb-[calc(0.5rem_+_env(safe-area-inset-bottom,0px))] flex-shrink-0 relative"
>
    <!-- Typing indicator: a reserved (fixed-height) row ABOVE the input, in
         flow within the composer's own space, so it never overlays the last
         message and never shifts the timeline when it appears or clears. -->
    <div class="h-4 mb-1 px-1">
        {#if typingUsers.length > 0}
            <p class="truncate text-xs leading-4 text-discord-textMuted">
                {typingText()}
            </p>
        {/if}
    </div>
    <!-- Reply preview bar -->
    {#if replyToEvent}
        <div
            class="flex items-center gap-2 mb-1 px-3 py-1.5 bg-discord-backgroundTertiary rounded-t-lg border-l-2 border-discord-accent"
        >
            <svg
                class="w-4 h-4 text-discord-accent flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"
                />
            </svg>
            <div class="flex-1 min-w-0 text-xs">
                <span class="text-discord-accent font-semibold">
                    Replying to {replyTargetName}
                </span>
                <span class="text-discord-textMuted ml-2 truncate"
                    >{getReplyPreview()}</span
                >
            </div>
            <button
                onclick={onCancelReply}
                class="flex-shrink-0 p-0.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                title="Cancel reply (Esc)"
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>
    {/if}

    <input
        bind:this={fileInputEl}
        type="file"
        multiple
        class="hidden"
        onchange={onFileSelected}
    />

    <!-- In-flight attachment send indicator (drawer was cleared optimistically) -->
    {#if sendingRoomId === roomId && sendingFileCount > 0}
        <div
            class="flex items-center gap-2 mb-2 text-xs text-discord-textMuted"
        >
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            <span
                >Sending {sendingFileCount} attachment{sendingFileCount === 1
                    ? ""
                    : "s"}…</span
            >
        </div>
    {/if}
    <!-- Outbox strip -->
    <OutboxStrip {roomId} />
    <!-- File queue preview -->
    {#if fileQueue.length > 0}
        <div class="flex gap-2 mb-2 overflow-x-auto pb-1">
            {#each fileQueue as item (item.id)}
                <div
                    class="relative flex-shrink-0 flex flex-col items-center gap-1 w-20 p-2"
                >
                    <!-- Thumbnail or file icon -->
                    <div
                        class="w-20 h-20 rounded-lg bg-discord-backgroundTertiary flex items-center justify-center overflow-hidden border border-discord-divider"
                    >
                        {#if item.previewUrl}
                            <img
                                src={item.previewUrl}
                                alt={item.name}
                                class="w-full h-full object-cover"
                            />
                        {:else}
                            <svg
                                class="w-8 h-8 text-discord-textMuted"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
                                />
                            </svg>
                        {/if}
                    </div>
                    <!-- Filename -->
                    <span
                        class="text-[10px] text-discord-textMuted text-center leading-tight w-full truncate px-0.5"
                        title={item.name}>{item.name}</span
                    >
                    <!-- Remove button -->
                    <button
                        onclick={() => removeFromQueue(item.id)}
                        class="absolute -top-0 -right-1.5 w-5 h-5 rounded-full bg-discord-backgroundSecondary border border-discord-divider text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover flex items-center justify-center transition-colors"
                        title="Remove"
                    >
                        <svg
                            class="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                            />
                        </svg>
                    </button>
                </div>
            {/each}
        </div>
    {/if}
    <!-- Emoji autocomplete picker -->
    {#if emojiQuery !== null && emojiCandidates.length > 0}
        <div
            class="mb-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg"
        >
            {#each emojiCandidates as candidate, i}
                <button
                    onpointerdown={(e) => {
                        e.preventDefault();
                        commitEmoji(candidate);
                    }}
                    onpointerenter={() => (emojiSelectedIdx = i)}
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                    class:bg-discord-messageHover={i === emojiSelectedIdx}
                >
                    {#if candidate.kind === "unicode"}
                        <span class="text-xl w-6 text-center flex-shrink-0"
                            >{candidate.emoji}</span
                        >
                        <span class="text-sm text-discord-textPrimary truncate"
                            >:{candidate.name.replace(/ /g, "_")}:</span
                        >
                        <span class="text-xs text-discord-textMuted"
                            >{candidate.emoji}</span
                        >
                    {:else}
                        <img
                            src={candidate.url}
                            alt={candidate.shortcode}
                            class="w-6 h-6 object-contain flex-shrink-0"
                        />
                        <span class="text-sm text-discord-textPrimary truncate"
                            >:{candidate.shortcode}:</span
                        >
                        <span class="text-xs text-discord-textMuted"
                            >custom</span
                        >
                    {/if}
                </button>
            {/each}
        </div>
    {/if}

    <!-- Mention autocomplete picker -->
    {#if mentionQuery !== null && mentionCandidates.length > 0}
        <div
            class="mb-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg"
        >
            {#each mentionCandidates as member, i}
                <button
                    onpointerdown={(e) => {
                        e.preventDefault();
                        commitMention(member);
                    }}
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                    class:bg-discord-messageHover={i === mentionSelectedIdx}
                    onpointerenter={() => (mentionSelectedIdx = i)}
                >
                    <Avatar
                        src={getMemberAvatar(room!, member.userId)}
                        name={member.rawDisplayName || member.userId}
                        id={member.userId}
                        size={24}
                    />
                    <span
                        class="text-sm text-discord-textPrimary font-medium truncate"
                    >
                        {member.rawDisplayName || member.userId}
                    </span>
                    <span class="text-xs text-discord-textMuted truncate">
                        {member.userId}
                    </span>
                </button>
            {/each}
        </div>
    {/if}

    <!-- Slash-command autocomplete picker -->
    {#if slashQuery !== null && slashCandidates.length > 0}
        <div
            class="mb-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg"
        >
            {#each slashCandidates as command, i}
                <button
                    onpointerdown={(e) => {
                        e.preventDefault();
                        commitSlashCommand(command);
                    }}
                    onpointerenter={() => (slashSelectedIdx = i)}
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                    class:bg-discord-messageHover={i === slashSelectedIdx}
                >
                    <span
                        class="text-sm font-mono text-discord-textPrimary flex-shrink-0"
                        >/{command.name}</span
                    >
                    {#if command.argHint}
                        <span
                            class="text-xs text-discord-textMuted font-mono flex-shrink-0"
                            >{command.argHint}</span
                        >
                    {/if}
                    <span
                        class="text-xs text-discord-textMuted truncate ml-auto"
                        >{command.description}</span
                    >
                </button>
            {/each}
        </div>
    {/if}

    <!-- Armed "create thread" banner: mirrors the reply banner pattern -->
    {#if createThreadArmed && !isThread}
        <div
            class="flex items-center justify-between gap-2 px-3 py-1.5 bg-discord-backgroundSecondary rounded-t-lg text-xs text-discord-textMuted"
        >
            <span>Your next message will start a <b>thread</b></span>
            <button
                onclick={() => (createThreadArmed = false)}
                class="p-0.5 rounded hover:text-discord-textPrimary transition-colors"
                title="Cancel thread creation"
            >
                <svg
                    class="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>
    {/if}

    {#if voiceRecorderOpen}
        <VoiceRecorder {roomId} onClose={() => (voiceRecorderOpen = false)} />
    {:else}
        <div
            class="input-box relative flex items-end gap-2 bg-discord-backgroundSecondary rounded-lg px-2.5 py-2.5 border border-transparent transition-colors"
            class:rounded-tl-none={!!replyToEvent}
        >
            <!-- "+" actions menu -->
            <div class="flex-shrink-0 relative">
                <button
                    onclick={() =>
                        showActionsMenu
                            ? closeModal()
                            : openModal("composer-actions", () => {})}
                    {disabled}
                    class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Add"
                >
                    <Plus size={20} />
                </button>
                {#if showActionsMenu}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="fixed inset-0 z-40" onclick={closeModal}></div>
                    {#if interfaceState.isTouchscreen}
                        <div
                            class="fixed left-2 z-50"
                            style="bottom: {keyboardOffset + 8}px;"
                        >
                            <ComposerActionsMenu
                                onClose={closeModal}
                                onUpload={() => fileInputEl?.click()}
                                onCreatePoll={() =>
                                    openCreatePollDialog(roomId)}
                                onRecordVoice={voiceSupported && !isThread
                                    ? () => {
                                          closeModal();
                                          voiceRecorderOpen = true;
                                      }
                                    : undefined}
                                onShareLocation={() =>
                                    openShareLocationDialog(roomId)}
                                onCreateThread={onThreadCreated && !isThread
                                    ? () => (createThreadArmed = true)
                                    : undefined}
                            />
                        </div>
                    {:else}
                        <div class="absolute bottom-full left-0 mb-2 z-50">
                            <ComposerActionsMenu
                                onClose={closeModal}
                                onUpload={() => fileInputEl?.click()}
                                onCreatePoll={() =>
                                    openCreatePollDialog(roomId)}
                                onRecordVoice={voiceSupported && !isThread
                                    ? () => {
                                          closeModal();
                                          voiceRecorderOpen = true;
                                      }
                                    : undefined}
                                onShareLocation={() =>
                                    openShareLocationDialog(roomId)}
                                onCreateThread={onThreadCreated && !isThread
                                    ? () => (createThreadArmed = true)
                                    : undefined}
                            />
                        </div>
                    {/if}
                {/if}
            </div>

            <div
                bind:this={textareaEl}
                role="textbox"
                aria-multiline="true"
                aria-label={composerPlaceholder}
                onkeydown={onKeydown}
                oninput={onInput}
                onbeforeinput={onBeforeInput}
                onpaste={onPaste}
                onclick={() => {
                    detectMentionQuery();
                    detectEmojiQuery();
                    detectSlashQuery();
                }}
                placeholder={composerPlaceholder}
                contenteditable={!disabled}
                tabindex={disabled ? -1 : 0}
                class="composer-editor flex-1 min-w-0 bg-transparent text-discord-textPrimary outline-none focus-visible:outline-none text-[16px] leading-relaxed py-[3px] max-h-48 overflow-y-auto disabled:cursor-not-allowed"
            ></div>

            <!-- GIF picker button -->
            <!-- `hidden` goes on the WRAPPER too: hiding only the button leaves
                 an empty flex item behind, and the row's gap-2 then reserves 8px
                 of dead space on touchscreens. Gated on the picker being CLOSED
                 because the GIF picker is also reachable on touch via another
                 picker's tab strip (onSwitchToGif), and display:none on the
                 wrapper would hide that picker's subtree with it. The button
                 keeps its own `hidden` so it never becomes visible on touch. -->
            <div
                class="flex-shrink-0 {interfaceState.isTouchscreen &&
                !showGifPicker
                    ? 'hidden'
                    : ''}"
            >
                <button
                    onclick={() => openPicker("gif")}
                    {disabled}
                    class="{interfaceState.isTouchscreen
                        ? 'hidden'
                        : ''} p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Favourite GIFs"
                >
                    <ImagePlay size={20} />
                </button>
                {#if showGifPicker}
                    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                    <div
                        class="fixed inset-0 z-40"
                        onclick={closeModal}
                        onkeydown={closeModal}
                    ></div>
                    {#if interfaceState.isTouchscreen}
                        <div
                            class="fixed left-0 right-0 z-50"
                            style="bottom: {keyboardOffset}px;"
                        >
                            <GifPicker
                                onSelect={insertGif}
                                onClose={() => closePicker("gif", true)}
                                onSwitchToEmoji={() => openPicker("emoji")}
                                onSwitchToSticker={() => openPicker("sticker")}
                            />
                        </div>
                    {:else}
                        <div class="absolute bottom-full right-0 mb-2 z-50">
                            <GifPicker
                                onSelect={insertGif}
                                onClose={() => closePicker("gif", true)}
                                onSwitchToEmoji={() => openPicker("emoji")}
                                onSwitchToSticker={() => openPicker("sticker")}
                            />
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Sticker button -->
            <!-- Same wrapper treatment as the GIF button above. -->
            <div
                class="flex-shrink-0 {interfaceState.isTouchscreen &&
                !showStickerPicker
                    ? 'hidden'
                    : ''}"
            >
                <button
                    onclick={() => openPicker("sticker")}
                    class="{interfaceState.isTouchscreen
                        ? 'hidden'
                        : ''} p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Stickers"
                    {disabled}
                >
                    <Sticker size={20} />
                </button>
                {#if showStickerPicker}
                    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
                    <div
                        class="fixed inset-0 z-40"
                        onclick={closeModal}
                        onkeydown={closeModal}
                    ></div>
                    {#if interfaceState.isTouchscreen}
                        <div
                            class="fixed left-0 right-0 z-50"
                            style="bottom: {keyboardOffset}px;"
                        >
                            <StickerPicker
                                {room}
                                onSelect={sendStickerMessage}
                                onClose={() => closePicker("sticker", true)}
                                onSwitchToEmoji={() => openPicker("emoji")}
                                onSwitchToGif={() => openPicker("gif")}
                            />
                        </div>
                    {:else}
                        <div class="absolute bottom-full right-0 mb-2 z-50">
                            <StickerPicker
                                {room}
                                onSelect={sendStickerMessage}
                                onClose={() => closePicker("sticker", true)}
                                onSwitchToEmoji={() => openPicker("emoji")}
                                onSwitchToGif={() => openPicker("gif")}
                            />
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Emoji button -->
            <div class="flex-shrink-0">
                <button
                    onclick={() => openPicker("emoji")}
                    class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Emoji"
                    {disabled}
                >
                    <Smile size={20} />
                </button>
                {#if showEmojiPicker}
                    <!-- Backdrop to close picker on outside click -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="fixed inset-0 z-40" onclick={closeModal}></div>
                    {#if interfaceState.isTouchscreen}
                        <div
                            class="fixed left-0 right-0 z-50"
                            style="bottom: {keyboardOffset}px;"
                        >
                            <EmojiPicker
                                {room}
                                onSelect={insertEmoji}
                                onSelectCustom={insertCustomEmoji}
                                onClose={() => closePicker("emoji", true)}
                                onSwitchToSticker={() => openPicker("sticker")}
                                onSwitchToGif={() => openPicker("gif")}
                            />
                        </div>
                    {:else}
                        <div class="absolute bottom-full right-0 mb-2 z-50">
                            <EmojiPicker
                                {room}
                                onSelect={insertEmoji}
                                onSelectCustom={insertCustomEmoji}
                                onClose={() => closePicker("emoji", true)}
                                onSwitchToSticker={() => openPicker("sticker")}
                                onSwitchToGif={() => openPicker("gif")}
                            />
                        </div>
                    {/if}
                {/if}
            </div>

            <button
                onclick={send}
                onpointerdown={(e) => e.preventDefault()}
                disabled={(!text.trim() && fileQueue.length === 0) ||
                    isSending ||
                    disabled}
                class="flex-shrink-0 p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed {canSend
                    ? 'text-discord-accent hover:text-discord-accentHover hover:bg-discord-messageHover'
                    : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                title="Send message"
            >
                {#if isSending}
                    <div
                        class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                    ></div>
                {:else}
                    <SendHorizontal size={20} />
                {/if}
            </button>
        </div>
    {/if}
    <!-- Typing indicator now floats ABOVE the input (see the overlay at the top
         of this container); the "Enter to send" hint was dropped for a cleaner,
         flush composer. -->
</div>

<style>
    .input-box:focus-within {
        outline: none;
        border-color: rgb(var(--discord-accent-rgb) / 0.3);
    }

    .composer-editor {
        min-height: 1.625rem;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
    }

    .composer-editor:empty::before {
        content: attr(placeholder);
        color: var(--discord-text-muted);
        pointer-events: none;
    }

    .composer-editor :global(.composer-mention) {
        padding: 0 0.2rem;
        border-radius: 3px;
        color: rgb(var(--discord-accent-rgb));
        background-color: rgb(var(--discord-accent-rgb) / 0.18);
        font-weight: 500;
    }

    .composer-editor :global(.composer-custom-emoji) {
        color: var(--discord-text-primary);
    }

    .composer-editor :global(.composer-link) {
        color: rgb(var(--discord-accent-rgb));
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .composer-editor :global(.composer-custom-emoji img) {
        display: inline-block;
        width: auto;
        height: 1.25em;
        margin-right: 0.15rem;
        vertical-align: -0.25em;
        object-fit: contain;
    }

    .composer-editor :global(.composer-spoiler) {
        padding: 0 3px;
        border-radius: 3px;
        color: transparent;
        background-color: var(--discord-spoiler-bg);
        text-shadow: none;
    }

    .composer-editor :global(code) {
        padding: 0.05rem 0.25rem;
        border-radius: 3px;
        background-color: var(--discord-bg-tertiary);
        font-family:
            ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
        font-size: 0.875em;
    }

    .composer-editor :global(a) {
        color: rgb(var(--discord-accent-rgb));
        text-decoration: none;
    }
</style>
