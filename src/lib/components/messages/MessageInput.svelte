<script lang="ts">
    import { tick } from "svelte";
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
        getCustomEmojis,
        mxcToHttp,
        sendTyping,
        onTypingEvent,
        getOwnUserId,
        type CustomEmoji,
        type CustomSticker,
    } from "$lib/matrix/client";
    import { parseMarkdown } from "$lib/utils/markdown";
    import { ALL_EMOJIS } from "$lib/data/emojis";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import StickerPicker from "$lib/components/ui/StickerPicker.svelte";
    import GifPicker from "$lib/components/ui/GifPicker.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        interfaceState,
        closeModal,
        openComposerPicker,
    } from "$lib/stores/interface.svelte";

    interface Props {
        roomId: string;
        roomName: string;
        room?: Room;
        disabled?: boolean;
        replyToEvent?: MatrixEvent | null;
        onCancelReply?: () => void;
        onRequestEditLast?: () => void;
        scrollEl?: HTMLElement;
    }

    let {
        roomId,
        roomName,
        room,
        disabled = false,
        replyToEvent = null,
        onCancelReply,
        onRequestEditLast,
        scrollEl,
    }: Props = $props();

    interface QueuedFile {
        file: File;
        name: string;
        previewUrl: string | null; // object URL for images, null otherwise
    }

    let text = $state("");
    let isSending = $state(false);
    let fileQueue = $state<QueuedFile[]>([]);
    let textareaEl: HTMLDivElement | undefined = $state();
    let renderingComposer = false;

    // Expose a focus hook so the global "type to focus" shortcut (+page) can
    // focus this composer.
    $effect(() => {
        interfaceState.focusComposer = () => textareaEl?.focus();
        return () => {
            if (interfaceState.focusComposer)
                interfaceState.focusComposer = null;
        };
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

    const mentionCandidates = $derived.by(() => {
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
        return textareaEl?.innerText.replace(/\u00a0/g, " ") ?? "";
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
        const after = text.slice(
            mentionStart + 1 + (mentionQuery?.length ?? 0),
        );
        const before = text.slice(0, mentionStart);
        // Insert pill: "@" + label + trailing space
        text = before + "@" + label + " " + after.replace(/^\S*/, "");
        // Record keyed by the full inserted token (incl. "@") so distinct users
        // who happen to share a display name map to distinct, unambiguous keys.
        pendingMentions = new Map([
            ...pendingMentions,
            ["@" + label, member.userId],
        ]);
        mentionQuery = null;
        tick().then(() => {
            const newPos = mentionStart + 1 + label.length + 1;
            renderComposer(newPos);
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
    const showEmojiPicker = $derived(
        composerPickerOpen && interfaceState.composerPicker === "emoji",
    );
    const showStickerPicker = $derived(
        composerPickerOpen && interfaceState.composerPicker === "sticker",
    );
    const showGifPicker = $derived(
        composerPickerOpen && interfaceState.composerPicker === "gif",
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
        openComposerPicker(which);
    }

    function closePicker(
        _which: "emoji" | "sticker" | "gif",
        refocus: boolean,
    ) {
        closeModal();
        if (refocus && textareaFocusedBeforePicker) textareaEl?.focus();
    }

    const replyTargetName = $derived(
        replyToEvent
            ? getMemberName(
                  { getMember: () => null } as never,
                  replyToEvent.getSender() ?? "",
              )
            : null,
    );
    const composerPlaceholder = $derived(
        disabled
            ? "Select a room to start chatting"
            : replyToEvent
              ? `Reply to ${replyToEvent.getSender()}...`
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
        // Apply markdown formatting
        const { formattedBody, hasFormatting } = parseMarkdown(plain);
        let html = formattedBody;
        let changed = hasFormatting;

        // Apply custom emoji shortcode substitution
        const shortcodes = [...plain.matchAll(/:(\w+):/g)].map((m) => m[1]);
        if (shortcodes.length > 0) {
            const available = getCustomEmojis(room, roomsState.activeSpaceId);
            const lookup = new Map(
                available.map((e) => [e.shortcode, e.mxcUrl]),
            );
            for (const shortcode of shortcodes) {
                const mxcUrl = lookup.get(shortcode);
                if (mxcUrl) {
                    const tag = `<img data-mx-emoticon src="${mxcUrl}" alt=":${shortcode}:" title=":${shortcode}:" />`;
                    html = html.replaceAll(`:${shortcode}:`, tag);
                    changed = true;
                }
            }
        }

        // Replace @-mention tokens with Matrix mention links. Keys already
        // include the leading "@". The negative lookahead matches whole tokens
        // only, so "@alice" doesn't match inside "@alice:hs" or "@alicia".
        const mentionedUserIds: string[] = [];
        for (const [token, userId] of pendingMentions) {
            const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = `${escaped}(?![\\w:.-])`;
            if (new RegExp(pattern).test(plain)) {
                const link = `<a href="https://matrix.to/#/${userId}">${token}</a>`;
                html = html.replace(new RegExp(pattern, "g"), link);
                if (!mentionedUserIds.includes(userId))
                    mentionedUserIds.push(userId);
                changed = true;
            }
        }

        return { html: changed ? html : null, mentionedUserIds };
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

    async function send() {
        const trimmed = text.trim();
        if ((!trimmed && fileQueue.length === 0) || isSending || disabled)
            return;

        if (typingStopTimer) {
            clearTimeout(typingStopTimer);
            typingStopTimer = null;
        }
        if (room) sendTyping(room.roomId, false);

        isSending = true;
        const filesToSend = fileQueue.slice();
        // Resolve mentions before clearing the composer below (buildFormattedBody
        // reads pendingMentions, which we reset up front).
        const formatted = trimmed ? buildFormattedBody(trimmed) : null;

        // The SDK creates the local echo synchronously, so a text message shows
        // in the timeline the moment we send it — with a retry/delete affordance
        // there if it fails (see MessageItem). Clear the composer up front so the
        // message isn't shown in two places and can't be sent twice by accident.
        if (trimmed) {
            text = "";
            mentionQuery = null;
            emojiQuery = null;
            pendingMentions = new Map();
            renderComposer(0);
        }

        try {
            if (trimmed && formatted) {
                const { html, mentionedUserIds } = formatted;
                const mentions =
                    mentionedUserIds.length > 0
                        ? { user_ids: mentionedUserIds }
                        : undefined;
                if (replyToEvent) {
                    await sendReply(
                        roomId,
                        trimmed,
                        replyToEvent,
                        html ?? undefined,
                        mentions,
                    );
                    onCancelReply?.();
                } else if (html) {
                    await sendFormattedMessage(roomId, trimmed, html, mentions);
                } else {
                    await sendTextMessage(roomId, trimmed);
                }
            }
            for (const item of filesToSend) {
                await sendFile(roomId, item.file);
            }
            // Files sent: revoke object URLs and clear the queue.
            for (const item of filesToSend) {
                if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            }
            fileQueue = [];
            // Snap scroll to bottom after input shrinks — prevents content from drifting up
            await tick();
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        } catch (err) {
            console.error("Failed to send:", err);
        } finally {
            isSending = false;
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
                behavior: "smooth",
            });
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
            await sendSticker(roomId, sticker);
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
        fileQueue = [...fileQueue, { file, name, previewUrl }];
        textareaEl?.focus();
    }

    function removeFromQueue(index: number) {
        const item = fileQueue[index];
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        fileQueue = fileQueue.filter((_, i) => i !== index);
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
        const start = getCaretOffset();
        const selection = window.getSelection();
        const selected = selection?.rangeCount
            ? selection.getRangeAt(0).toString().length
            : 0;
        const next =
            text.slice(0, start) + pastedText + text.slice(start + selected);
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

        if (room) {
            const now = Date.now();
            if (now - lastTypingSentAt >= 5000) {
                lastTypingSentAt = now;
                sendTyping(room.roomId, true);
            }
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

<div class="px-4 pb-6 pt-2 flex-shrink-0 relative">
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
                    Replying to {replyToEvent.getSender()}
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

    <!-- File queue preview -->
    {#if fileQueue.length > 0}
        <div class="flex gap-2 mb-2 overflow-x-auto pb-1">
            {#each fileQueue as item, i}
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
                        onclick={() => removeFromQueue(i)}
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

    <div
        class="input-box flex items-center gap-2 bg-discord-backgroundSecondary rounded-lg px-2.5 py-2.5 border border-transparent transition-colors"
        class:rounded-tl-none={!!replyToEvent}
    >
        <!-- Attach file button -->
        <button
            onclick={() => fileInputEl?.click()}
            {disabled}
            class="flex-shrink-0 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach file"
        >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2z" />
            </svg>
        </button>

        <div
            bind:this={textareaEl}
            role="textbox"
            aria-multiline="true"
            aria-label={composerPlaceholder}
            onkeydown={onKeydown}
            oninput={onInput}
            onpaste={onPaste}
            onclick={() => {
                detectMentionQuery();
                detectEmojiQuery();
            }}
            placeholder={composerPlaceholder}
            contenteditable={!disabled}
            tabindex={disabled ? -1 : 0}
            class="composer-editor flex-1 min-w-0 bg-transparent text-discord-textPrimary outline-none focus-visible:outline-none text-[16px] leading-relaxed max-h-48 overflow-y-auto disabled:cursor-not-allowed"
        ></div>

        <!-- GIF picker button -->
        <div class="relative flex-shrink-0">
            <button
                onclick={() => openPicker("gif")}
                {disabled}
                class="{interfaceState.isTouchscreen
                    ? 'hidden'
                    : ''} p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Favourite GIFs"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm5 5.5v9l6-4.5-6-4.5z"
                    />
                </svg>
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
        <div class="relative flex-shrink-0">
            <button
                onclick={() => openPicker("sticker")}
                class="{interfaceState.isTouchscreen
                    ? 'hidden'
                    : ''} p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                title="Stickers"
                {disabled}
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h18v12l-4 4H3V3z" opacity=".87" /><path
                        d="M17 15v4l4-4h-4z"
                    />
                </svg>
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
        <div class="relative flex-shrink-0">
            <button
                onclick={() => openPicker("emoji")}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                title="Emoji"
                {disabled}
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        fill-rule="evenodd"
                        d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM8.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM15.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6.89 13.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5s-4.31-1.46-5.11-3.5z"
                    />
                </svg>
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
            class="flex-shrink-0 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Send message"
        >
            {#if isSending}
                <div
                    class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                ></div>
            {:else}
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
            {/if}
        </button>
    </div>
    <div class="relative mt-1 px-1 h-4">
        {#if typingUsers.length > 0}
            <p
                class="absolute inset-0 text-xs text-discord-textMuted bg-discord-background/90"
            >
                {typingText()}
            </p>
        {:else if !interfaceState.isTouchscreen}
            <p class="text-xs text-discord-textMuted">
                <kbd class="font-mono">Enter</kbd> to send &middot;
                <kbd class="font-mono">Shift+Enter</kbd> for new line
                {#if replyToEvent}&middot; <kbd class="font-mono">Esc</kbd> to cancel
                    reply{/if}
            </p>
        {/if}
    </div>
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
