<script lang="ts">
    import { t } from "$lib/i18n";
    import { keybindsState, pickerForKey } from "$lib/stores/keybinds.svelte";
    import { tick, untrack } from "svelte";
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import {
        sendTextMessage,
        sendFormattedMessage,
        sendSticker,
        sendFile,
        getMediaUploadSizeLimit,
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
        canSendMessages,
        getMyPowerLevel,
        getRoomPowerLevels,
        sendThreadReply,
        type CustomEmoji,
        type CustomSticker,
    } from "$lib/matrix/client";
    import { sendEventContent } from "$lib/matrix/pluginHost";
    import { composerThreadKey } from "$lib/utils/threadContent";
    import {
        buildFormattedBody as buildBody,
        mentionsFromFormatted,
    } from "$lib/utils/messageBody";
    import { buildReplyContent } from "$lib/utils/replyContent";
    import {
        buildTextContent,
        buildFormattedContent,
    } from "$lib/utils/messageContent";
    import { composerInsertText } from "$lib/utils/composerInsert";
    import {
        applyTextTransforms,
        applyContentTransforms,
    } from "$lib/plugins/outgoingTransforms";
    import { hostBridge } from "$lib/plugins/hostBridge";
    import { shouldQueueSend } from "$lib/utils/sendGating";
    import { queueMessage } from "$lib/stores/outbox.svelte";
    import { textSymbolPresentation } from "$lib/utils/twemoji";
    import {
        convertTrailingShortcode,
        replaceEmojiShortcodes,
    } from "$lib/data/emojiShortcodes";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import EmojiSuggestions from "$lib/components/messages/EmojiSuggestions.svelte";
    import {
        caretOffset,
        editorText,
        pastedPlainText,
        selectedLength,
        setCaretOffset as setCaretOffsetIn,
    } from "$lib/utils/composerDom";
    import { decorateComposerText } from "$lib/utils/composerDecorate";
    import { TextUndoHistory, diffCaret, undoKind } from "$lib/utils/textUndo";
    import {
        applyEmojiCandidate,
        findEmojiQuery,
        rankEmojiCandidates,
        type EmojiCandidate,
    } from "$lib/utils/emojiAutocomplete";
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
        openComposerActions,
        releaseComposerActions,
    } from "$lib/stores/interface.svelte";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import ComposerActionsMenu from "$lib/components/messages/ComposerActionsMenu.svelte";
    import RenameAttachmentDialog from "$lib/components/messages/RenameAttachmentDialog.svelte";
    import VoiceRecorder from "$lib/components/messages/VoiceRecorder.svelte";
    import OutboxStrip from "$lib/components/messages/OutboxStrip.svelte";
    import { pickAudioMimeType } from "$lib/utils/voiceMessage";
    import { openCreatePollDialog } from "$lib/stores/pollDialog.svelte";
    import { openShareLocationDialog } from "$lib/stores/locationDialog.svelte";
    import {
        getDraft,
        setDraft,
        clearDraft,
        registerLiveComposer,
        registerDraftFlusher,
    } from "$lib/stores/composerDrafts.svelte";
    import {
        getFileQueue,
        addQueuedFile,
        removeQueuedFile,
        renameQueuedFile,
        markQueuedFilesDirect,
        setQueuedFileDirect,
        dropQueuedFilePreview,
        previewUrlFor,
        clearFileQueue,
        type QueuedFile,
    } from "$lib/stores/composerFileQueue.svelte";
    import { sendQueuedFiles } from "$lib/utils/queuedFileSend";
    import { filesToRestoreAfterSend } from "$lib/utils/composerFileRestore";
    import {
        shouldClearComposerAfterSend,
        shouldClearStoredDraft,
    } from "$lib/utils/composerClear";
    import { insertMention, appendMention } from "$lib/utils/mentionInsert";
    import {
        parseSlashCommand,
        matchSlashCommands,
        usageFor,
        parseNickArg,
        parseOpArg,
        parseDeopArg,
        resolveMentionTokens,
        pluginCommandToSlash,
        type SlashCommand,
    } from "$lib/utils/slashCommands";
    import { parseSedCommand, type SedCommand } from "$lib/utils/sedEdit";
    import type { SedEditResult } from "$lib/matrix/editMessage";
    import { pluginComposerButtons } from "$lib/utils/pluginComposer";
    import { resolveUserArg } from "$lib/utils/userSearch";
    import { showErrorToast, showToast } from "$lib/stores/toasts.svelte";
    import { offerFile } from "$lib/matrix/fileTransfer";
    import { isFileTooLargeError } from "$lib/utils/uploadLimits";
    import { discardRoomSession } from "$lib/matrix/crypto";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { scrollBehavior } from "$lib/utils/motionPreference";
    import { suppressNextClick } from "$lib/utils/suppressNextClick";
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
        /** `s/old/new/`: apply it to the user's last message here (the
         *  caller knows which messages that means). */
        onSedEdit?: (cmd: SedCommand) => Promise<SedEditResult>;
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
        disabled: disabledProp = false,
        replyToEvent = null,
        onCancelReply,
        onRequestEditLast,
        onSedEdit,
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
    // Percent of the batch's bytes sent; null before the first progress event.
    // Shows whether a slow send is the upload or what follows. Files upload in
    // parallel, so this sums every file, each counted at its own size until
    // its upload reports a real total.
    let uploadPercent = $state<number | null>(null);
    let uploadLoaded: number[] = [];
    let uploadTotal: number[] = [];
    const onUploadProgress = (i: number) => (loaded: number, total: number) => {
        if (total <= 0) return;
        uploadLoaded[i] = loaded;
        uploadTotal[i] = total;
        const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
        const all = sum(uploadTotal);
        if (all > 0)
            uploadPercent = Math.floor((sum(uploadLoaded) / all) * 100);
    };
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
            interfaceState.composerUpload = () => fileInputEl?.click();
            return () => {
                if (interfaceState.focusComposer)
                    interfaceState.focusComposer = null;
                interfaceState.composerUpload = null;
            };
        }
    });

    // Background text restores (a failed notification quick reply) reach the
    // composer that is open for this draft key, main or thread. Same shape as
    // the insertText hook below: `text` is read inside the callback, so the
    // effect depends only on the key.
    $effect(() => {
        const key = effComposerKey;
        return registerLiveComposer(key, (t) =>
            setComposerText(composerInsertText(text, t)),
        );
    });

    // Lets a reload the app triggers itself keep what's typed here
    // (backgroundRelease.ts). `text` is read when flushed, not now.
    $effect(() => {
        const key = effComposerKey;
        return registerDraftFlusher(key, () =>
            setDraft(key, text, pendingMentions),
        );
    });

    // Images committed by the Android keyboard (Gboard stickers, Emoji
    // Kitchen) arrive through AppShell's __matrixKeyboardContent bridge. Only
    // the composer that has focus takes them.
    $effect(() => {
        const onKeyboardContent = (e: Event) => {
            if (!textareaEl || document.activeElement !== textareaEl) return;
            enqueueFile((e as CustomEvent<File>).detail);
        };
        window.addEventListener("matrix-keyboard-content", onKeyboardContent);
        return () => {
            window.removeEventListener(
                "matrix-keyboard-content",
                onKeyboardContent,
            );
            if (textareaEl && document.activeElement === textareaEl)
                setKeyboardImageTarget(false);
        };
    });

    // Tell ComposerWebView (Android) whether the keyboard may insert images:
    // only while a composer has focus.
    function setKeyboardImageTarget(focused: boolean) {
        (window as any).MatrixKeyboard?.setComposerFocused(focused);
    }

    // Plugin composer.insertText → append to THIS (main) composer's text.
    // Only the main composer claims the global slot (mirrors focusComposer).
    // roomId-guarded so a stale handler from a previous room drops silently.
    // `text` is read inside the handler (a user-action callback), NOT the
    // effect body, so the effect depends only on roomId — no re-register per
    // keystroke, no effect_update_depth issues.
    $effect(() => {
        if (isThread) return;
        const rid = roomId;
        const handler = (ctx: { roomId: string; text: string }) => {
            if (ctx.roomId !== rid) return false;
            setComposerText(composerInsertText(text, ctx.text));
            textareaEl?.focus();
            return true;
        };
        hostBridge.insertText = handler;
        return () => {
            if (hostBridge.insertText === handler) hostBridge.insertText = null;
        };
    });

    // Plugin/call-menu insertMention → append an @mention to THIS (main) composer.
    // Same structure as insertText: main composer only, roomId-guarded, no effect
    // deps on `text`/`pendingMentions` — the handler reads+writes them, but those
    // reads are inside the handler callback (not the effect body) so they don't
    // become reactive dependencies. The mount-time drain is wrapped in untrack()
    // to ensure reading pendingMention and writing text/pendingMentions inside the
    // handler does not trigger effect_update_depth_exceeded.
    $effect(() => {
        if (isThread) return;
        const rid = roomId;
        const handler = (ctx: { roomId: string; userId: string }) => {
            if (ctx.roomId !== rid) return;
            const member = (room &&
                getRoomMembers(room).find((m) => m.userId === ctx.userId)) || {
                userId: ctx.userId,
                rawDisplayName: undefined,
            };
            const label = mentionLabelFor(member);
            const inserted = appendMention(text, label);
            text = inserted.text;
            pendingMentions = new Map([
                ...pendingMentions,
                ["@" + label, ctx.userId],
            ]);
            if (
                hostBridge.pendingMention &&
                hostBridge.pendingMention.roomId === ctx.roomId &&
                hostBridge.pendingMention.userId === ctx.userId
            ) {
                hostBridge.pendingMention = null;
            }
            tick().then(() => {
                renderComposer(inserted.caret);
                textareaEl?.focus();
            });
        };
        hostBridge.insertMention = handler;
        // Drain a mention queued before this composer mounted (call→chat flip).
        // Deferred one tick so it runs AFTER the per-room draft-restore effect's
        // synchronous body (which sets `text = draft.text`) — otherwise draft
        // restore clobbers the just-inserted mention. Re-checked at drain time
        // so it stays idempotent (the direct-call path may have cleared it).
        untrack(() => {
            const q = hostBridge.pendingMention;
            if (q && q.roomId === rid) {
                void tick().then(() => {
                    const q2 = hostBridge.pendingMention;
                    if (q2 && q2.roomId === rid && q2.userId === q.userId) {
                        handler(q2);
                    }
                });
            }
        });
        return () => {
            if (hostBridge.insertMention === handler)
                hostBridge.insertMention = null;
        };
    });

    let fileInputEl: HTMLInputElement | undefined = $state();
    let directFileInputEl: HTMLInputElement | undefined = $state();
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
        return textareaEl ? editorText(textareaEl) : "";
    }

    function getCaretOffset(): number {
        return textareaEl ? caretOffset(textareaEl, text.length) : text.length;
    }

    function setCaretOffset(offset: number): void {
        if (!textareaEl) return;
        // Creating a selection inside an unfocused contenteditable can make
        // mobile browsers focus it and reopen the soft keyboard. An unfocused
        // mobile composer does not need a programmatic caret; the user's next
        // tap will place it naturally.
        if (interfaceState.isMobile && document.activeElement !== textareaEl)
            return;
        setCaretOffsetIn(textareaEl, offset);
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
    let emojiQuery = $state<string | null>(null);
    let emojiStart = $state(0);
    let emojiSelectedIdx = $state(0);

    const emojiCandidates = $derived.by((): EmojiCandidate[] =>
        emojiQuery === null
            ? []
            : rankEmojiCandidates(
                  emojiQuery,
                  getCustomEmojis(room, roomsState.activeSpaceId),
              ),
    );

    $effect(() => {
        if (emojiSelectedIdx >= emojiCandidates.length) emojiSelectedIdx = 0;
    });

    // Slash-command autocomplete
    let slashQuery = $state<string | null>(null); // null = popup closed
    let slashSelectedIdx = $state(0);

    // Plugin-contributed slash commands, adapted to SlashCommand and re-derived
    // whenever the registry mutates (enable/disable). void the tick so the
    // $derived tracks registry changes (see plugins.svelte.ts reactivity note).
    const pluginSlashCommands = $derived.by((): SlashCommand[] => {
        void pluginRegistry.tick;
        return pluginRegistry.commands.map((e) =>
            pluginCommandToSlash(e.value, e.pluginId),
        );
    });

    const pluginComposerButtonViews = $derived.by(() => {
        void pluginRegistry.tick;
        return pluginComposerButtons(
            pluginRegistry.composerButtons,
            roomId,
            isThread ? (threadRootId ?? null) : null,
        );
    });

    const slashCandidates = $derived.by((): SlashCommand[] =>
        slashQuery === null
            ? []
            : matchSlashCommands(slashQuery, pluginSlashCommands),
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
        const q = findEmojiQuery(text, getCaretOffset());
        emojiQuery = q?.query ?? null;
        emojiStart = q?.start ?? 0;
    }

    function commitEmoji(candidate: EmojiCandidate) {
        if (emojiQuery === null) return;
        const next = applyEmojiCandidate(
            text,
            { query: emojiQuery, start: emojiStart },
            candidate,
        );
        text = next.text;
        tick().then(() => {
            renderComposer(next.caret);
            textareaEl?.focus();
        });
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
        if (typingUsers.length === 1)
            return t("messageInput.isTyping", { value: names[0] });
        if (typingUsers.length === 2)
            return t("messageInput.andAreTyping", {
                value: names[0],
                value2: names[1],
            });
        if (typingUsers.length === 3)
            return t("messageInput.andAreTyping2", {
                value: names[0],
                value2: names[1],
                value3: names[2],
            });
        return t("messageInput.severalPeopleAreTyping");
    }

    export function focus() {
        textareaEl?.focus();
    }

    export function addFiles(files: File[]) {
        if (disabled) return;
        for (const file of files) enqueueFile(file);
    }
    // Composer pickers share the single interfaceState.modal "composer-picker"
    // slot; pickerKind says which one is shown.
    const composerPickerOpen = $derived(
        interfaceState.modal === "composer-picker",
    );
    const showActionsMenu = $derived(
        interfaceState.modal === "composer-actions" &&
            interfaceState.composerActionsOwner === effComposerKey,
    );
    // Release our "+" menu when this composer unmounts (thread panel closed)
    // or its key changes (room switch). The teardown is untracked, so the
    // effect depends only on effComposerKey.
    $effect(() => {
        const key = effComposerKey;
        return () => untrack(() => releaseComposerActions(key));
    });
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
    // Read-only room: the user's power level is below what posting needs
    // (announcement channels). Locks the composer like `disabled` does.
    const noSendPermission = $derived(
        !!room && (void roomsState.roomsTick, !canSendMessages(room)),
    );
    const disabled = $derived(disabledProp || noSendPermission);

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
        noSendPermission
            ? t("messageInput.noPermissionToSend")
            : disabled
              ? t("messageInput.selectARoomToStartChatting")
              : isThread
                ? t("messageInput.replyInThread")
                : replyToEvent
                  ? t("messageInput.replyTo", { replyTargetName })
                  : t("messageInput.message", { roomName }),
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
        mentionsRoom: boolean;
    } {
        return buildBody(plain, {
            mentions: pendingMentions,
            customEmojis: getCustomEmojis(room, roomsState.activeSpaceId),
            memberIds: room
                ? new Set(getRoomMembers(room).map((m) => m.userId))
                : undefined,
        });
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
        const emojis = getCustomEmojis(room, roomsState.activeSpaceId);
        return decorateComposerText(plain, {
            emojiSrc: (shortcode) => {
                const emoji = emojis.find((e) => e.shortcode === shortcode);
                return emoji ? mxcToHttp(emoji.mxcUrl) : null;
            },
            isMention: isMentionToken,
        });
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

    // Undo/redo history, driven from the model (see textUndo.ts). A watcher
    // records every change however it happened (typing, paste, picker
    // inserts, mention commits).
    const undo = new TextUndoHistory();
    // inputType of the in-flight native edit (set in onBeforeInput, consumed
    // by the watcher). null → a programmatic change.
    let pendingInputKind: string | null = null;

    function resetUndoHistory(current: string): void {
        undo.reset(current);
    }

    $effect(() => {
        const t = text;
        untrack(() => {
            const kind = pendingInputKind;
            pendingInputKind = null;
            undo.record(t, kind);
        });
    });

    function stepUndo(delta: -1 | 1): void {
        const to = undo.step(delta);
        if (to === null) return;
        const from = text;
        text = to;
        renderComposer(diffCaret(from, to));
        detectMentionQuery();
        detectEmojiQuery();
        detectSlashQuery();
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
            resetUndoHistory(text);
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
        if (!userId)
            throw new Error(t("messageInput.isNotAValidUser", { token }));
        return userId;
    }

    async function applyPowerLevel(token: string, level: number) {
        if (!room) throw new Error(t("messageInput.noRoomSelected"));
        const userId = resolveUserOrThrow(token);
        if (!room.getMember(userId))
            throw new Error(t("messageInput.isNotInThisRoom", { userId }));
        const pl = getRoomPowerLevels(room);
        const required = pl.events["m.room.power_levels"] ?? pl.state_default;
        if (getMyPowerLevel(room) < required)
            throw new Error(t("messageInput.youDonTHavePermissionTo"));
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
            case "discardsession":
                await discardRoomSession(roomId);
                showToast(t("crypto.roomKeyDiscarded"), { tone: "accent" });
                break;
            default:
                throw new Error(
                    t("messageInput.unhandledCommand", { name: command.name }),
                );
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

        // Plugin-provided command: run its handler instead of the core switch.
        // Mirrors the action branch — no local echo, clear on success only.
        if (command.pluginRun) {
            isSending = true;
            try {
                await command.pluginRun({ roomId, arg });
                text = "";
                slashQuery = null;
                mentionQuery = null;
                pendingMentions = new Map();
                clearDraft(effComposerKey);
                renderComposer(0);
            } catch (err) {
                console.error(`Plugin command /${command.name} failed:`, err);
                showErrorToast(
                    matrixErrorMessage(err, t("messageInput.commandFailed")),
                );
            } finally {
                isSending = false;
                textareaEl?.focus();
            }
            return;
        }

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
                showErrorToast(
                    matrixErrorMessage(err, t("messageInput.commandFailed")),
                );
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
        // The transform is pure app code for core commands, but the transform
        // command flavor is public (plugins), so guard a throwing transform.
        let body: string;
        try {
            body = command.kind === "emote" ? arg : command.transform!(arg);
        } catch (err) {
            console.error(`Command /${command.name} transform threw:`, err);
            showErrorToast(
                matrixErrorMessage(err, t("messageInput.commandFailed")),
            );
            return;
        }
        const usePlain = command.kind === "text-transform" && !!command.plain;
        // Resolve formatting before clearing the composer (buildFormattedBody
        // reads pendingMentions, reset below).
        const formatted = usePlain ? null : buildFormattedBody(body);
        const replyTarget = replyToEvent;
        // A text command (/shrug, /tableflip, /plain…) answers the open reply
        // like a normal message would; /me still goes out on its own.
        const replyId =
            command.kind === "emote"
                ? undefined
                : (replyTarget?.getId() ?? undefined);

        isSending = true;
        text = "";
        mentionQuery = null;
        emojiQuery = null;
        slashQuery = null;
        pendingMentions = new Map();
        clearDraft(effComposerKey);
        renderComposer(0);

        try {
            const mentions = formatted
                ? mentionsFromFormatted(formatted)
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
                    undefined,
                    replyId,
                );
            } else if (replyId) {
                await sendEventContent(
                    roomId,
                    buildReplyContent({
                        replyEventId: replyId,
                        text: body,
                        formattedText: usePlain
                            ? undefined
                            : (formatted?.html ?? undefined),
                        mentions,
                    }) as unknown as Record<string, unknown>,
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
            // The reply was used (or, for /me, dropped) — clear it so the
            // banner doesn't leak onto the user's next message.
            if (replyTarget) onCancelReply?.();
            await tick();
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        } catch (err) {
            console.error("Slash command failed:", err);
            showErrorToast(
                matrixErrorMessage(err, t("messageInput.failedToSend")),
            );
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
    async function sendSedEdit(sed: SedCommand) {
        const forKey = effComposerKey;
        const textAtSend = text;
        isSending = true;
        try {
            const result = await onSedEdit!(sed);
            if (result === "edited") clearComposerAfterSend(forKey, textAtSend);
            else if (result === "no-message")
                showErrorToast(t("messageInput.sedNoMessage"));
            else if (result === "no-match")
                showErrorToast(
                    t("messageInput.sedNoMatch", { pattern: sed.pattern }),
                );
            else showErrorToast(t("messageInput.sedEmpty"));
        } catch (err) {
            console.error("Failed to edit message:", err);
            showErrorToast(t("messageInput.sedFailed"));
        } finally {
            isSending = false;
        }
    }

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
        // `s/old/new/` edits the last message instead of sending one. Not with
        // files queued: then the text is a caption.
        if (!isSending && !disabled && fileQueue.length === 0 && onSedEdit) {
            const sed = parseSedCommand(text);
            if (sed) {
                await sendSedEdit(sed);
                return;
            }
        }

        // Slash-command dispatch — only when no files are queued (with files the
        // text is a caption, not a command).
        if (!isSending && !disabled && fileQueue.length === 0) {
            const parsed = parseSlashCommand(text, pluginSlashCommands);
            if (parsed && "unknown" in parsed) {
                showErrorToast(
                    t("messageInput.unknownCommand", {
                        unknown: parsed.unknown,
                    }),
                );
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

        // Sender-side text transforms (plugins, e.g. the text-replacer). Applied
        // to a LOCAL copy so the composer text and the draft-restore snapshot
        // (textAtSend) stay what the user typed; `trimmed` and the formatted body
        // built below both derive from the transformed text.
        // Unicode `:shortcode:`s that weren't converted while typing (pasted,
        // restored drafts) still go out as emoji.
        const outgoingText = applyTextTransforms(
            replaceEmojiShortcodes(text, isCustomShortcode),
            pluginRegistry.outgoingTextTransforms.map((e) => e.value),
            { roomId },
        );
        const trimmed = outgoingText.trim();
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
        // Sender-side content transforms (plugins), run over each fully-built
        // event this send produces: text, reply, thread reply, caption.
        const transformOutgoingContent = (content: Record<string, unknown>) =>
            applyContentTransforms(
                content,
                pluginRegistry.outgoingContentTransforms.map((e) => e.value),
                { roomId: targetRoomId },
            );
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
            uploadPercent = null;
            uploadLoaded = filesToSend.map(() => 0);
            // A direct file reports no upload progress, so it can't count here.
            uploadTotal = filesToSend.map((item) =>
                item.direct ? 0 : item.file.size,
            );
        }
        // Resolve mentions before clearing the composer below (buildFormattedBody
        // reads pendingMentions, which we reset up front).
        const formatted = trimmed ? buildFormattedBody(trimmed) : null;

        // When files are queued alongside text, attach the text to the first
        // file as a caption (MSC2530) rather than sending it as a separate
        // message. A direct file's offer can't carry formatted text, so there
        // it does go as a message, just ahead of the offer.
        const firstIsDirect = filesToSend[0]?.direct ?? false;
        const useCaption =
            !!trimmed &&
            !!formatted &&
            filesToSend.length > 0 &&
            !firstIsDirect;
        // A reply rides on the first file whenever no separate text message
        // carries it (caption, or attachments alone). Snapshotted so a reply
        // picked mid-upload isn't retargeted or cancelled by this send.
        const replyTarget = replyToEvent;
        const fileReplyToId =
            replyTarget &&
            filesToSend.length > 0 &&
            !firstIsDirect &&
            (useCaption || !trimmed)
                ? (replyTarget.getId() ?? undefined)
                : undefined;
        const fileRelation = (i: number) =>
            isThread || (i === 0 && fileReplyToId)
                ? {
                      rootEventId: isThread ? threadRootId! : undefined,
                      replyToEventId: i === 0 ? fileReplyToId : undefined,
                  }
                : undefined;

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
            const { html } = formatted;
            const mentions = mentionsFromFormatted(formatted);
            const baseContent: Record<string, unknown> = replyToEvent
                ? (buildReplyContent({
                      replyEventId: replyToEvent.getId()!,
                      text: trimmed,
                      formattedText: html ?? undefined,
                      mentions,
                  }) as unknown as Record<string, unknown>)
                : html
                  ? buildFormattedContent(trimmed, html, mentions)
                  : buildTextContent(trimmed, mentions);
            const content = transformOutgoingContent(baseContent);
            queueMessage(targetRoomId, content);
            if (replyToEvent) onCancelReply?.();
            createThreadArmed = false;
            isSending = false;
            textareaEl?.focus();
            return;
        }

        // Plain text (no attachments: text + files always goes out as a
        // caption). The SDK puts the local echo in the timeline synchronously,
        // with its own retry/delete affordance on failure, so the composer must
        // NOT wait for the server's ack: on a slow homeserver (matrix.org) or a
        // first send that has to share room keys, that ack takes seconds and
        // blocked the next message behind a spinner. Reported in issue #40.
        if (trimmed && formatted && !useCaption) {
            const { html } = formatted;
            const mentions = mentionsFromFormatted(formatted);
            const replyId = replyToEvent?.getId() ?? undefined;
            const threadArmed = createThreadArmed;
            createThreadArmed = false;
            let sent: Promise<unknown>;
            if (isThread) {
                // Thread replies always route via sendThreadReply; a reply to
                // a specific thread message rides along as its quote target.
                sent = sendThreadReply(
                    targetRoomId,
                    threadRootId!,
                    trimmed,
                    mentions,
                    html ?? undefined,
                    transformOutgoingContent,
                    replyId,
                );
            } else {
                // Build the content in-component (byte-identical to the
                // sendReply/sendFormattedMessage/sendTextMessage wrappers, see
                // utils/messageContent.ts), apply plugin content transforms,
                // then send. Thread replies + captions keep their own send
                // paths, which apply the same transforms.
                const baseContent: Record<string, unknown> = replyId
                    ? (buildReplyContent({
                          replyEventId: replyId,
                          text: trimmed,
                          formattedText: html ?? undefined,
                          mentions,
                      }) as unknown as Record<string, unknown>)
                    : html
                      ? buildFormattedContent(trimmed, html, mentions)
                      : buildTextContent(trimmed, mentions);
                const content = transformOutgoingContent(baseContent);
                sent = sendEventContent(targetRoomId, content).then(
                    (sentEventId) => {
                        if (threadArmed) onThreadCreated?.(sentEventId);
                    },
                );
            }
            if (replyToEvent) onCancelReply?.();
            sent.catch((err) => {
                console.error("Failed to send:", err);
                showErrorToast(
                    matrixErrorMessage(err, t("messageInput.failedToSend")),
                );
            });
            if (filesToSend.length === 0) {
                isSending = false;
                await tick();
                if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
                textareaEl?.focus();
                return;
            }
        }

        try {
            // Upload in parallel, post in queue order, and commit each file as
            // it lands. A failed file doesn't stop the rest (their uploads
            // would be orphaned); only the failed files are restored below,
            // so a retry sends just those (audit MEDIA-03).
            await sendQueuedFiles(
                filesToSend,
                (item, i, ready) => {
                    if (item.direct)
                        return ready().then(() =>
                            offerFile(targetRoomId, item.file),
                        );
                    if (useCaption && i === 0 && formatted) {
                        const { html } = formatted;
                        return sendFile(
                            targetRoomId,
                            item.file,
                            {
                                body: trimmed,
                                formattedBody: html ?? undefined,
                                mentions: mentionsFromFormatted(formatted),
                            },
                            fileRelation(i),
                            transformOutgoingContent,
                            onUploadProgress(i),
                            ready,
                        );
                    }
                    return sendFile(
                        targetRoomId,
                        item.file,
                        undefined,
                        fileRelation(i),
                        undefined,
                        onUploadProgress(i),
                        ready,
                    );
                },
                (item, i) => {
                    // The drawer was already cleared optimistically; just record
                    // the success so a later failure won't restore this file.
                    sentIds.add(item.id);
                    if (
                        i === 0 &&
                        fileReplyToId &&
                        replyToEvent === replyTarget
                    )
                        onCancelReply?.();
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
            showErrorToast(
                matrixErrorMessage(err, t("messageInput.failedToSend")),
                isFileTooLargeError(err) && !isThread
                    ? {
                          label: t("messageInput.sendDirectly"),
                          run: () =>
                              markQueuedFilesDirect(
                                  targetComposerKey,
                                  (q) => q.file.size > err.limit,
                              ),
                      }
                    : undefined,
            );
            // Restore ONLY the files that were not successfully sent — an
            // already-sent file must never come back (would duplicate on the
            // next send: audit MEDIA-03). The optimistic clear revoked the
            // originals' preview URLs, so recreate them the same way enqueueFile
            // does. Restore targets the COMPOSER the send was for (thread or
            // room), not the one the user may have switched to.
            const toRestore = filesToRestoreAfterSend(filesToSend, sentIds);
            for (const item of toRestore) {
                addQueuedFile(
                    targetComposerKey,
                    item.file,
                    item.name,
                    previewUrlFor(item.file),
                    item.direct,
                );
            }
        } finally {
            isSending = false;
            sendingFileCount = 0;
            uploadPercent = null;
            sendingRoomId = null;
            textareaEl?.focus();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        // Ctrl/Cmd chords: undo/redo through the model history, and the
        // picker shortcuts. Handled here (not only in AppShell) so they open
        // THIS composer's picker, e.g. the thread composer's when focused;
        // AppShell skips events already defaultPrevented.
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const k = e.key.toLowerCase();
            if (k === "z" || (k === "y" && !e.shiftKey)) {
                e.preventDefault();
                stepUndo(k === "z" && !e.shiftKey ? -1 : 1);
                return;
            }
        }
        // Picker shortcuts (Settings > Keybinds).
        if (!keybindsState.recording) {
            const picker = pickerForKey(e);
            if (picker) {
                e.preventDefault();
                openPicker(picker);
                return;
            }
        }

        if (
            (e.key === "PageUp" || e.key === "PageDown") &&
            !e.shiftKey &&
            scrollEl
        ) {
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
        // Ctrl+E / Ctrl+S (open pickers) are global shortcuts handled
        // centrally in AppShell.
        if (
            e.key === "ArrowUp" &&
            !text &&
            !e.altKey &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey
        ) {
            e.preventDefault();
            onRequestEditLast?.();
        }
    }

    function insertEmoji(emoji: string) {
        setComposerText(text + textSymbolPresentation(emoji));
        closeModal();
        textareaEl?.focus();
    }

    function insertCustomEmoji(emoji: CustomEmoji) {
        setComposerText(text + `:${emoji.shortcode}:`);
        closeModal();
        textareaEl?.focus();
    }

    function insertGif(url: string) {
        const next = text ? text + " " + url : url;
        setComposerText(next);
        closeModal();
        textareaEl?.focus();
    }

    async function sendStickerMessage(sticker: CustomSticker) {
        if (isSending || disabled) return;
        isSending = true;
        const replyTarget = replyToEvent;
        try {
            await sendSticker(
                roomId,
                sticker,
                isThread ? { rootEventId: threadRootId! } : undefined,
                replyTarget?.getId() ?? undefined,
            );
            if (replyTarget) onCancelReply?.();
        } catch (err) {
            console.error("Failed to send sticker:", err);
        } finally {
            isSending = false;
            textareaEl?.focus();
        }
    }

    function enqueueFile(file: File, defaultName?: string, direct = false) {
        const name = file.name || defaultName || "file";
        addQueuedFile(effComposerKey, file, name, previewUrlFor(file), direct);
        // Look up the upload size limit now, while the user is still writing,
        // so its round trip isn't added to the send (slow links: Tor).
        void getMediaUploadSizeLimit();
        textareaEl?.focus();
    }

    function removeFromQueue(id: string) {
        removeQueuedFile(effComposerKey, id);
    }

    // Tap a queued attachment to rename it before sending.
    let renamingItem = $state<QueuedFile | null>(null);
    function openRename(item: QueuedFile) {
        openModal("rename-attachment", () => (renamingItem = null));
        renamingItem = item;
    }

    /** Model length of the current selection ("" when collapsed). */
    function getSelectedLength(): number {
        return textareaEl ? selectedLength(textareaEl) : 0;
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
        // Undo/Redo from the native context menu (the keyboard path is
        // handled in onKeydown).
        if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {
            e.preventDefault();
            stepUndo(e.inputType === "historyUndo" ? -1 : 1);
            return;
        }
        // Group consecutive typing / deleting into single undo steps.
        pendingInputKind = undoKind(e.inputType);
        if (
            e.inputType === "insertLineBreak" ||
            e.inputType === "insertParagraph"
        ) {
            e.preventDefault();
            pendingInputKind = null;
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
        const pastedText = pastedPlainText(e.clipboardData);
        if (!pastedText) return;
        const end = getCaretOffset();
        const selected = getSelectedLength();
        const start = end - selected;
        const next = text.slice(0, start) + pastedText + text.slice(end);
        setComposerText(next, start + pastedText.length);
    }

    function onDirectFileSelected(e: Event) {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        for (const file of files) enqueueFile(file, undefined, true);
        if (directFileInputEl) directFileInputEl.value = "";
    }

    function onFileSelected(e: Event) {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        for (const file of files) enqueueFile(file);
        if (fileInputEl) fileInputEl.value = "";
    }

    // Custom emotes keep their `:shortcode:` token (sent as an <img>), so a
    // unicode shortcode with the same name must not replace them.
    function isCustomShortcode(code: string): boolean {
        return getCustomEmojis(room, roomsState.activeSpaceId).some(
            (e) => e.shortcode === code,
        );
    }

    function onInput() {
        if (!textareaEl || renderingComposer) return;
        let caret = getCaretOffset();
        text = getComposerText();
        // Typing the closing colon of a unicode shortcode converts it, like
        // Discord (":tm:" → ™️).
        const converted = convertTrailingShortcode(
            text.slice(0, caret),
            isCustomShortcode,
        );
        if (converted !== null) {
            text = converted + text.slice(caret);
            caret = converted.length;
        }
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
            class="flex items-center gap-2 mb-1 px-3 py-1.5 bg-discord-backgroundTertiary rounded-t-lg border-s-2 border-discord-accent"
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
                    {t("messageInput.replyingTo", { replyTargetName })}
                </span>
                <span class="text-discord-textMuted ms-2 truncate"
                    >{getReplyPreview()}</span
                >
            </div>
            <button
                onclick={onCancelReply}
                class="flex-shrink-0 p-0.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                title={t("messageInput.cancelReplyEsc")}
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
    <input
        bind:this={directFileInputEl}
        type="file"
        multiple
        class="hidden"
        onchange={onDirectFileSelected}
    />

    <!-- In-flight attachment send indicator (drawer was cleared optimistically) -->
    {#if sendingRoomId === roomId && sendingFileCount > 0}
        <div
            class="flex items-center gap-2 mb-2 text-xs text-discord-textMuted"
        >
            <Loader2 class="w-3.5 h-3.5 animate-spin" />
            <span
                >{t("messageInput.sendingAttachments", {
                    count: sendingFileCount,
                })}</span
            >
            {#if uploadPercent !== null}
                <span class="tabular-nums">{uploadPercent}%</span>
            {/if}
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
                    <!-- Thumbnail or file icon (tap to rename) -->
                    <button
                        type="button"
                        onclick={() => openRename(item)}
                        title={t("messageInput.editAttachment")}
                        aria-label={t("messageInput.editAttachment2", {
                            name: item.name,
                        })}
                        class="w-20 h-20 rounded-lg bg-discord-backgroundTertiary flex items-center justify-center overflow-hidden border border-discord-divider hover:border-discord-accent transition-colors"
                    >
                        {#if item.previewUrl && item.file.type.startsWith("video/")}
                            <!-- A file with no decodable picture (unsupported
                                 codec, audio-only webm) falls back to the icon.
                                 The #t makes iOS Safari paint the first frame. -->
                            <video
                                src="{item.previewUrl}#t=0.001"
                                preload="metadata"
                                muted
                                playsinline
                                disablepictureinpicture
                                class="w-full h-full object-cover pointer-events-none"
                                onerror={() =>
                                    dropQueuedFilePreview(
                                        effComposerKey,
                                        item.id,
                                    )}
                                onloadedmetadata={(e) => {
                                    if (!e.currentTarget.videoWidth)
                                        dropQueuedFilePreview(
                                            effComposerKey,
                                            item.id,
                                        );
                                }}
                            ></video>
                        {:else if item.previewUrl}
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
                    </button>
                    <!-- Filename -->
                    <button
                        type="button"
                        onclick={() => openRename(item)}
                        class="text-[10px] text-discord-textMuted hover:text-discord-textPrimary text-center leading-tight w-full truncate px-0.5"
                        title={item.name}>{item.name}</button
                    >
                    {#if item.direct}
                        <span
                            class="text-[10px] font-semibold text-discord-accent"
                            title={t("messageInput.directFileHint")}
                            >{t("messageInput.directFile")}</span
                        >
                    {/if}
                    <!-- Remove button -->
                    <button
                        onclick={() => removeFromQueue(item.id)}
                        class="absolute -top-0 -end-1.5 w-5 h-5 rounded-full bg-discord-backgroundSecondary border border-discord-divider text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover flex items-center justify-center transition-colors"
                        title={t("common.remove")}
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
    {#if renamingItem && interfaceState.modal === "rename-attachment"}
        {@const target = renamingItem}
        <RenameAttachmentDialog
            name={target.name}
            previewUrl={target.previewUrl}
            video={target.file.type.startsWith("video/")}
            direct={target.direct}
            onSave={(name) => renameQueuedFile(effComposerKey, target.id, name)}
            onDirectChange={isThread
                ? undefined
                : (direct) =>
                      setQueuedFileDirect(effComposerKey, target.id, direct)}
            onClose={closeModal}
        />
    {/if}
    <!-- Emoji autocomplete picker -->
    {#if emojiQuery !== null && emojiCandidates.length > 0}
        <EmojiSuggestions
            class="mb-1"
            candidates={emojiCandidates}
            bind:selectedIdx={emojiSelectedIdx}
            onPick={commitEmoji}
        />
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
                        // Committing unmounts the picker before pointerup, so
                        // swallow the trailing click or it opens whatever link
                        // is now under the cursor behind the picker.
                        suppressNextClick();
                        commitMention(member);
                    }}
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-start transition-colors"
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
                        // See the mention picker: swallow the trailing click so
                        // it can't open a link behind the unmounted picker.
                        suppressNextClick();
                        commitSlashCommand(command);
                    }}
                    onpointerenter={() => (slashSelectedIdx = i)}
                    class="w-full flex items-center gap-2.5 px-3 py-1.5 text-start transition-colors"
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
                        class="text-xs text-discord-textMuted truncate ms-auto"
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
            <span
                >{t("messageInput.yourNextMessageWillStartA")}
                <b>{t("messageInput.thread")}</b></span
            >
            <button
                onclick={() => (createThreadArmed = false)}
                class="p-0.5 rounded hover:text-discord-textPrimary transition-colors"
                title={t("messageInput.cancelThreadCreation")}
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
        <VoiceRecorder
            {roomId}
            getRelation={() =>
                isThread || replyToEvent
                    ? {
                          rootEventId: isThread ? threadRootId! : undefined,
                          replyToEventId: replyToEvent?.getId() ?? undefined,
                      }
                    : undefined}
            onSent={(relation) => {
                if (
                    relation?.replyToEventId &&
                    replyToEvent?.getId() === relation.replyToEventId
                )
                    onCancelReply?.();
            }}
            onClose={() => (voiceRecorderOpen = false)}
        />
    {:else}
        <div
            class="input-box relative flex items-end gap-2 bg-discord-backgroundSecondary rounded-lg px-2.5 py-2.5 border border-transparent transition-colors"
            class:rounded-ss-none={!!replyToEvent}
        >
            <!-- "+" actions menu -->
            <div class="flex-shrink-0 relative">
                <!-- Double-click: straight to the file picker, as if "Upload a
                     file" had been chosen from the menu the first click
                     opened. The button sits above the menu's backdrop so the
                     second click reaches it. -->
                <button
                    onclick={(e) => {
                        if (e.detail === 2) {
                            if (showActionsMenu) closeModal();
                            fileInputEl?.click();
                        } else if (showActionsMenu) {
                            closeModal();
                        } else {
                            openComposerActions(effComposerKey);
                        }
                    }}
                    {disabled}
                    class="relative p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    class:z-50={showActionsMenu}
                    title={t("common.add")}
                >
                    <Plus size={20} />
                </button>
                {#if showActionsMenu}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="fixed inset-0 z-40" onclick={closeModal}></div>
                    {#if interfaceState.isTouchscreen}
                        <div
                            class="fixed start-2 z-50"
                            style="bottom: {keyboardOffset + 8}px;"
                        >
                            <ComposerActionsMenu
                                {roomId}
                                onClose={closeModal}
                                onUpload={() => fileInputEl?.click()}
                                onSendDirectly={isThread
                                    ? undefined
                                    : () => directFileInputEl?.click()}
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
                        <div class="absolute bottom-full start-0 mb-2 z-50">
                            <ComposerActionsMenu
                                {roomId}
                                onClose={closeModal}
                                onUpload={() => fileInputEl?.click()}
                                onSendDirectly={isThread
                                    ? undefined
                                    : () => directFileInputEl?.click()}
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

            <!-- autocapitalize/spellcheck: Android IMEs (Samsung One UI
                 especially) suppress the suggestion strip on a bare
                 contenteditable that sets neither, so a rich-composer div
                 needs them spelled out to get the word suggestions a plain
                 <textarea> would get for free. -->
            <div
                bind:this={textareaEl}
                role="textbox"
                aria-multiline="true"
                aria-label={composerPlaceholder}
                onkeydown={onKeydown}
                oninput={onInput}
                onbeforeinput={onBeforeInput}
                onpaste={onPaste}
                onfocus={() => setKeyboardImageTarget(true)}
                onblur={() => setKeyboardImageTarget(false)}
                onclick={() => {
                    detectMentionQuery();
                    detectEmojiQuery();
                    detectSlashQuery();
                }}
                placeholder={composerPlaceholder}
                dir="auto"
                contenteditable={!disabled}
                autocapitalize="sentences"
                spellcheck="true"
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
                    title={t("messageInput.favouriteGifs")}
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
                            class="fixed start-0 end-0 z-50"
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
                        <div class="absolute bottom-full end-0 mb-2 z-50">
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
            <!-- Wrapper `hidden` on touch mirrors the button's own `hidden` so no dead flex gap remains. -->
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
                    title={t("common.stickers")}
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
                            class="fixed start-0 end-0 z-50"
                            style="bottom: {keyboardOffset}px;"
                        >
                            <StickerPicker
                                {roomId}
                                onSelect={sendStickerMessage}
                                onClose={() => closePicker("sticker", true)}
                                onSwitchToEmoji={() => openPicker("emoji")}
                                onSwitchToGif={() => openPicker("gif")}
                            />
                        </div>
                    {:else}
                        <div class="absolute bottom-full end-0 mb-2 z-50">
                            <StickerPicker
                                {roomId}
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
                    title={t("common.emoji")}
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
                            class="fixed start-0 end-0 z-50"
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
                        <div class="absolute bottom-full end-0 mb-2 z-50">
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

            <!-- Plugin composer buttons -->
            {#each pluginComposerButtonViews as btn (btn.entryId)}
                <div class="flex-shrink-0">
                    <button
                        onclick={(e) => {
                            try {
                                const r = btn.onClick(e.currentTarget);
                                if (r && typeof r.then === "function")
                                    r.catch((err) =>
                                        console.error(
                                            "[zam] plugin composer button threw",
                                            err,
                                        ),
                                    );
                            } catch (err) {
                                console.error(
                                    "[zam] plugin composer button threw",
                                    err,
                                );
                            }
                        }}
                        {disabled}
                        class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={btn.label}
                        aria-label={btn.label}
                    >
                        {#if btn.icon}
                            <svg
                                class="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"><path d={btn.icon} /></svg
                            >
                        {:else}
                            <span class="text-xs font-semibold"
                                >{btn.label.slice(0, 2)}</span
                            >
                        {/if}
                    </button>
                </div>
            {/each}

            <button
                onclick={send}
                onpointerdown={(e) => e.preventDefault()}
                disabled={(!text.trim() && fileQueue.length === 0) ||
                    isSending ||
                    disabled}
                class="flex-shrink-0 p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed {canSend
                    ? 'text-discord-accent hover:text-discord-accentHover hover:bg-discord-messageHover'
                    : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                title={t("messageInput.sendMessage")}
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
</style>
