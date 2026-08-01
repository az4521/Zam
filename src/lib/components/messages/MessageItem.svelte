<script lang="ts">
    import { EventStatus } from "matrix-js-sdk";
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
    import PollBody from "$lib/components/messages/PollBody.svelte";
    import LocationBody from "$lib/components/messages/LocationBody.svelte";
    import VerificationRequestMessage from "$lib/components/messages/VerificationRequestMessage.svelte";
    import VoiceMessagePlayer from "$lib/components/messages/VoiceMessagePlayer.svelte";
    import ForwardMessageDialog from "$lib/components/messages/ForwardMessageDialog.svelte";
    import MessageReportAction from "$lib/components/messages/MessageReportAction.svelte";
    import EventShield from "./EventShield.svelte";
    import { Forward, Lock } from "lucide-svelte";
    import Reactions from "$lib/components/messages/Reactions.svelte";
    import LinkPreview from "$lib/components/messages/LinkPreview.svelte";
    import Lightbox from "$lib/components/ui/Lightbox.svelte";
    import SwfEmbed from "$lib/components/ui/SwfEmbed.svelte";
    import {
        getMemberName,
        getMemberAvatar,
        mxcToHttp,
        fetchAttachmentBlob,
        findEventById,
        fetchSingleEvent,
        sendReaction,
        sendEdit,
        deleteMessage,
        getMyPowerLevel,
        getRoomPowerLevels,
        getPinnedEventIds,
        pinMessage,
        unpinMessage,
        resendMessage,
        deleteFailedMessage,
        getRoom,
        joinRoom,
        seedRoomStateIfMissing,
        getRoomIdForAlias,
        getThreadSummary,
    } from "$lib/matrix/client";
    import { parseMarkdown } from "$lib/utils/markdown";
    import {
        parseMatrixLink,
        matrixLinkTitle,
        mergeViaServers,
        linkifyPlainText,
        type MatrixLinkTarget,
    } from "$lib/utils/matrixLinks";
    import { isPollStartEventType } from "$lib/utils/pollContent";
    import { isVerificationRequestMessage } from "$lib/utils/verificationMessage";
    import {
        stripBodyFallback,
        stripFormattedFallback,
    } from "$lib/utils/replyFallback";
    import { parseVoiceContent } from "$lib/utils/voiceMessage";
    import {
        videoPosterMxc,
        videoSourceMxc,
        formatMediaDuration,
    } from "$lib/utils/roomMedia";
    import { safeAspectRatio } from "$lib/utils/mediaDimensions";
    import { UTD_PLACEHOLDER_TEXT } from "$lib/utils/encryptionState";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { getEventShield, isRoomEncrypted } from "$lib/matrix/crypto";
    import {
        sameShield,
        shieldRefreshKey,
        shieldViewForEvent,
        type ShieldView,
    } from "$lib/utils/eventShield";
    import {
        sameThreadSummary,
        type ThreadSummary,
    } from "$lib/utils/threadModel";
    import {
        shouldRescanReplyTarget,
        type CachedReplyTarget,
    } from "$lib/utils/replyTargetLookup";

    import {
        messagesState,
        bumpReactionTick,
    } from "$lib/stores/messages.svelte";
    import {
        roomsState,
        navigateToRoom,
        setActiveSpace,
    } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { securityState } from "$lib/stores/security.svelte";
    import { tick, untrack } from "svelte";
    import {
        messageTimestamp,
        timeOnly,
        fullTimestamp,
    } from "$lib/utils/timeFormat";
    import { renderHtml } from "$lib/utils/twemoji";
    import { sanitizeMatrixHtml } from "$lib/utils/sanitizeHtml";
    import {
        highlightCodeBlocks,
        mapOutsideCode,
    } from "$lib/utils/codeHighlight";
    import {
        isFavouriteGif,
        addFavouriteGif,
        removeFavouriteGif,
        favouritesState,
    } from "$lib/stores/favourites.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
        clearModalIfOwner,
    } from "$lib/stores/interface.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        settingsState,
        getDoubleTapReaction,
    } from "$lib/stores/settings.svelte";
    import { isDoubleTap, type TapPoint } from "$lib/utils/doubleTap";
    import { spoilers } from "$lib/actions/spoilers";
    import { rovingToolbar } from "$lib/actions/rovingToolbar";
    import { scrollBehavior } from "$lib/utils/motionPreference";

    import type { ReadReceiptInfo } from "$lib/matrix/client";

    interface Props {
        event: MatrixEvent;
        room: Room;
        showHeader: boolean;
        onReply: (event: MatrixEvent) => void;
        jumpToReply: (eventId: string) => void;
        onOpenThread?: (rootEventId: string) => void;
        editRequested?: boolean;
        onEditDone?: () => void;
        receipts?: ReadReceiptInfo[];
        mentionHighlight?: boolean;
    }

    let {
        event,
        room,
        showHeader,
        onReply,
        jumpToReply,
        onOpenThread,
        editRequested = false,
        onEditDone,
        receipts = [],
        mentionHighlight = false,
    }: Props = $props();

    const canPin = $derived.by(() => {
        const myPl = getMyPowerLevel(room);
        const pl = getRoomPowerLevels(room);
        const pinPl = pl.events?.["m.room.pinned_events"] ?? pl.state_default;
        return myPl >= pinPl;
    });
    const isPinned = $derived.by(() => {
        void roomsState.roomsTick;
        return getPinnedEventIds(room).includes(eventId);
    });

    // Reaction emoji picker. Local boolean drives this instance's render; the
    // shared modal slot ("reaction-picker") provides mutual exclusion across
    // messages plus central Escape/back dismissal.
    let showEmojiPicker = $state(false);
    let emojiPickerEl: HTMLDivElement | undefined = $state();

    // Our claim on the shared modal slot (reaction picker OR forward dialog —
    // one holder is enough, since only the latest claim can still own it).
    // Plain let: read only from teardown, never from markup or a tracked read.
    let slotToken = 0;

    // Release the shared modal slot if this row is destroyed while still
    // owning it (e.g. the room changes under an open picker) — otherwise the
    // slot strands and swallows the next Escape.
    $effect(() => () => clearModalIfOwner(slotToken));

    function openReactionPicker() {
        // Claim first — a same-id handover runs the outgoing close.
        slotToken = openModal("reaction-picker", () => {
            showEmojiPicker = false;
            // Only release the selection if it is still ours: a handover to
            // another message row must not clear that row's selection.
            if (interfaceState.selectedMessageId === eventId)
                interfaceState.selectedMessageId = null;
        });
        showEmojiPicker = true;
    }

    $effect(() => {
        if (showEmojiPicker && !interfaceState.isTouchscreen) {
            const handler = (e: MouseEvent) => {
                if (
                    emojiPickerEl &&
                    !emojiPickerEl.contains(e.target as Node)
                ) {
                    closeModal();
                }
            };
            document.addEventListener("mousedown", handler);
            return () => document.removeEventListener("mousedown", handler);
        }
    });
    let confirmingDelete = $state(false);
    let showForwardDialog = $state(false);
    let previousTap: TapPoint | null = null;

    function openForwardDialog() {
        // Claim first — a same-id handover runs the outgoing close.
        slotToken = openModal("forward-message", () => {
            showForwardDialog = false;
            // Only release the selection if it is still ours.
            if (interfaceState.selectedMessageId === eventId)
                interfaceState.selectedMessageId = null;
        });
        showForwardDialog = true;
    }

    async function runDoubleTapAction() {
        if (isFailed) return;
        interfaceState.selectedMessageId = null;
        const action = isOwnMessage
            ? settingsState.ownDoubleTapAction
            : settingsState.otherDoubleTapAction;
        if (action === "none") return;
        if (action === "reply") {
            onReply(event);
            return;
        }
        if (action === "edit") {
            if (
                isOwnMessage &&
                eventType === "m.room.message" &&
                msgtype === "m.text"
            ) {
                startEdit();
                tick().then(() => editTextareaEl?.focus());
            }
            return;
        }
        try {
            await sendReaction(
                room.roomId,
                eventId,
                getDoubleTapReaction(roomsState.activeSpaceId),
            );
        } catch (err) {
            showErrorToast(
                err instanceof Error ? err.message : "Failed to react",
            );
        }
    }

    function onMessageTouchEnd(e: TouchEvent) {
        if (!interfaceState.isTouchscreen || e.changedTouches.length !== 1)
            return;
        const target = e.target as Element | null;
        if (
            target?.closest(
                "button, a, input, textarea, select, video, audio, [role='button'], [contenteditable='true'], .cursor-pointer",
            )
        ) {
            previousTap = null;
            return;
        }
        if (window.getSelection()?.toString()) {
            previousTap = null;
            return;
        }
        const touch = e.changedTouches[0];
        const current = {
            at: Date.now(),
            x: touch.clientX,
            y: touch.clientY,
        };
        if (isDoubleTap(previousTap, current)) {
            e.preventDefault();
            previousTap = null;
            runDoubleTapAction();
        } else {
            previousTap = current;
        }
    }

    // Mouse equivalent of the touch double-tap. A desktop dblclick would
    // normally select a word; when a double-tap action is configured we run it
    // instead (clearing the incidental selection). "none" leaves word-select.
    function onMessageDblClick(e: MouseEvent) {
        if (interfaceState.isTouchscreen) return;
        const action = isOwnMessage
            ? settingsState.ownDoubleTapAction
            : settingsState.otherDoubleTapAction;
        if (action === "none") return;
        const target = e.target as Element | null;
        if (
            target?.closest(
                "button, a, input, textarea, select, video, audio, [role='button'], [contenteditable='true'], .cursor-pointer",
            )
        )
            return;
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        runDoubleTapAction();
    }

    let showReportDialog = $state(false);

    let keyboardOffset = $state(0);
    // Only track the on-screen keyboard while THIS row actually has a
    // sheet open. These are two GLOBAL listeners per instance, and this
    // component is instantiated once per timeline row — ungated on a
    // touchscreen (which Chrome's device emulation reports) a few hundred rows
    // meant a few hundred pairs of visualViewport listeners, all firing on
    // every scroll and resize. keyboardOffset is consumed by exactly two
    // things: the touch emoji sheet and the report dialog.
    $effect(() => {
        const wanted =
            interfaceState.isTouchscreen &&
            (showEmojiPicker || showReportDialog);
        if (!wanted) {
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

    let deleteConfirmFocus = $state<"yes" | "no">("yes");
    let deleteYesEl = $state<HTMLButtonElement | undefined>();
    let deleteNoEl = $state<HTMLButtonElement | undefined>();
    let deleteRefocus = false;

    $effect(() => {
        if (confirmingDelete) {
            deleteConfirmFocus = "yes";
            setTimeout(() => deleteYesEl?.focus(), 0);
        }
    });

    function resolveDelete(confirmed: boolean) {
        confirmingDelete = false;
        if (confirmed) deleteMessage(room.roomId, eventId);
        if (deleteRefocus) {
            deleteRefocus = false;
            onEditDone?.();
            return;
        }
        // Reached from the action bar, which is only keyboard-reachable as of
        // this branch. Clearing `confirmingDelete` unmounts the Yes/No buttons,
        // so without this `document.activeElement` falls back to <body> and the
        // user is dumped at the top of the document. The row is the natural
        // landing spot: it is the tab stop that owns this bar. After a KEYBOARD
        // resolve the browser's keyboard-modality flag is set, so the
        // programmatic focus still matches `:focus-visible` and the bar stays
        // revealed; after a MOUSE resolve it does not, leaving the row focused
        // but the bar hidden — acceptable, because the pointer is by definition
        // still over the row and `group-hover:flex` covers it.
        void tick().then(() => rootEl?.focus());
    }

    function onDeleteKeydown(e: KeyboardEvent) {
        if (!confirmingDelete) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            deleteConfirmFocus = deleteConfirmFocus === "yes" ? "no" : "yes";
            (deleteConfirmFocus === "yes" ? deleteYesEl : deleteNoEl)?.focus();
        } else if (e.key === "Enter") {
            e.preventDefault();
            resolveDelete(deleteConfirmFocus === "yes");
        } else if (e.key === "Escape") {
            resolveDelete(false);
        }
    }
    let imageLightboxOpen = $state(false);
    let emojiPickerBelow = $state(false);
    let reactionBtnEl: HTMLButtonElement | undefined = $state();
    let isEditing = $state(false);
    let editFromKeyboard = false;
    let editText = $state("");
    let isSavingEdit = $state(false);
    let rootEl: HTMLElement | undefined = $state();
    let editTextareaEl: HTMLTextAreaElement | undefined = $state();

    const reactionTick = $derived(messagesState.reactionTick);
    const eventId = $derived(event.getId() ?? "");
    const mobileSelected = $derived(
        interfaceState.isTouchscreen &&
            interfaceState.selectedMessageId === eventId,
    );
    const isOwnMessage = $derived(event.getSender() === auth.userId);
    const isEdited = $derived.by(() => {
        reactionTick;
        return !!event.replacingEvent();
    });

    // A failed (NOT_SENT) local echo: the send errored and the SDK is blocking
    // further sends in this room until it's retried or removed.
    const isFailed = $derived.by(() => {
        void messagesState.timelineTick;
        return event.status === EventStatus.NOT_SENT;
    });
    let isResending = $state(false);

    async function retrySend() {
        if (isResending) return;
        isResending = true;
        try {
            await resendMessage(event);
        } catch (err) {
            console.error("Failed to resend:", err);
        } finally {
            isResending = false;
        }
    }

    const senderId = $derived(event.getSender() ?? "");
    const displayName = $derived(getMemberName(room, senderId));
    const avatarSrc = $derived(getMemberAvatar(room, senderId));
    const timestamp = $derived(event.getTs());
    const content = $derived.by(() => {
        reactionTick;
        // A live MatrixEvent mutates IN PLACE when it decrypts (same reference),
        // so depend on timelineTick — bumped on MatrixEventEvent.Decrypted — or
        // the encrypted envelope's (empty) content sticks after decryption.
        void messagesState.timelineTick;
        return event.getContent();
    });
    // Likewise tick-dependent: getType() flips "m.room.encrypted" → the cleartext
    // type on decryption without changing the object reference, so a plain
    // $derived(event.getType()) would keep the UTD placeholder up forever.
    const eventType = $derived(
        (void messagesState.timelineTick, event.getType()),
    );

    // Whether this room has encryption switched on. Tick-bound because the Room
    // mutates in place when the m.room.encryption state event lands.
    const roomEncrypted = $derived(
        (void roomsState.roomsTick, isRoomEncrypted(room)),
    );

    // Per-message E2EE shield. getEncryptionInfoForEvent is ASYNC, so this
    // cannot be a $derived — it's $state written from an $effect. The effect
    // re-runs on timelineTick (an event decrypting late gets a shield it did
    // not have) and on securityTick (verifying a device changes the shield on
    // every message that device sent; crypto.ts drops its memo on the same
    // events). The SDK call is untracked per project law: an SDK call inside a
    // tracked effect can register listener reads as dependencies and blow the
    // effect depth.
    let shield = $state<ShieldView | null>(null);
    // The last shield inputs we actually fetched for. Plain `let`, NOT $state:
    // like `lastThreadSummary` below, a memo cell written from inside a tracked
    // scope must stay invisible to the reactivity graph. Component scope, not
    // module scope — one row's verdict must never leak into another row.
    let lastShieldKey: string | null = null;
    $effect(() => {
        void messagesState.timelineTick;
        const tick = securityState.securityTick;
        const encrypted = roomEncrypted;
        const id = eventId;

        if (!encrypted) {
            // Assigning the same primitive is already a no-op for $state
            // (referential equality), so this costs nothing on repeat ticks —
            // and reading `shield` here would make the effect depend on it.
            shield = null;
            // A room can be switched ON: forget the key so the next encrypted
            // pass refetches rather than trusting a pre-encryption verdict.
            lastShieldKey = null;
            return;
        }

        // timelineTick is bumped for EVERY timeline event and every decryption
        // anywhere in the app, and there is one of these effects per rendered row.
        // getEventShield deliberately does not memoize null results or local
        // echoes, so an unguarded call re-hits the crypto layer per row per event.
        // Skip when nothing that can move THIS row's shield has changed; the tick
        // dependencies above stay exactly as they were.
        const key = shieldRefreshKey({
            eventId: id,
            eventType,
            status: event.status,
            securityTick: tick,
        });
        if (key === lastShieldKey) return;
        lastShieldKey = key;

        let cancelled = false;
        let settled = false;
        untrack(() => {
            void getEventShield(event)
                .then((info) => {
                    settled = true;
                    // A late resolution must not overwrite a newer row's state.
                    if (cancelled || event.getId() !== id) return;
                    const next = shieldViewForEvent({
                        roomEncrypted: true,
                        info,
                    });
                    // shieldViewForEvent mints a fresh object every call, so an
                    // unconditional assign would dirty this row on EVERY
                    // timelineTick — i.e. every row in the timeline re-renders
                    // on every sync. Only write when the value actually moved.
                    if (!sameShield(shield, next)) shield = next;
                })
                .catch(() => {
                    settled = true;
                    if (!cancelled) shield = null;
                    // A failed fetch must be retryable on the next real change.
                    lastShieldKey = null;
                });
        });
        return () => {
            cancelled = true;
            // This teardown runs before every RE-RUN, not just on destroy. A
            // tick landing mid-flight therefore cancels a fetch that was still
            // going to produce this row's verdict — and with the key gate above
            // the re-run would decline to retry, leaving the shield silently
            // absent. Only remember a key whose fetch actually got to settle.
            if (!settled) lastShieldKey = null;
        };
    });

    const msgtype = $derived(content?.msgtype ?? "");
    const isPoll = $derived(isPollStartEventType(eventType));
    // In-room verification requests ride in as m.room.message; their plain-text
    // body claims this client can't do in-chat verification (it can), so they
    // get a card instead of the fallback text.
    const isVerificationRequest = $derived(
        isVerificationRequestMessage(eventType, msgtype),
    );

    // Whether the event's ORIGINAL content declared a reply relation. A rich-
    // reply fallback ("> quoted…" body / <mx-reply> block) can only legally
    // exist on a reply, so we strip it only when this is true. We read the
    // ORIGINAL content (not the edited getContent()) because an edit drops the
    // reply relation from getContent() while the fallback stays in the body.
    const isReply = $derived(
        (void messagesState.timelineTick,
        !!event.getOriginalContent()?.["m.relates_to"]?.["m.in_reply_to"]),
    );

    // Strip the Matrix rich-reply fallback ("> quoted…\n\n") from body via the
    // shared spec-v1.19 algorithm. Spec v1.13 removed the fallback; legacy
    // senders may still include it. We render the quote from the referenced
    // event, so the fallback is always redundant here.
    const body = $derived(() => {
        const raw: string = content?.body ?? "";
        if (!isReply) return raw;
        return stripBodyFallback(raw);
    });

    // The original file name of an uploaded media event. Per MSC2530, when a
    // caption is present the file name lives in `filename` and `body` holds the
    // caption; otherwise `body` is the file name.
    const mediaFilename = $derived(
        (content?.filename as string | undefined) ??
            (content?.body as string | undefined) ??
            "",
    );
    // A media caption exists when `filename` is present and differs from `body`
    // (i.e. `body` is real caption text, not just the file name). We render it as
    // a normal message above the media rather than as a label on the media.
    const hasCaption = $derived(() => {
        const fn = content?.filename as string | undefined;
        const raw = content?.body as string | undefined;
        return !!(fn && raw && fn !== raw);
    });

    // Strip a leading <mx-reply> fallback from formatted_body so we don't
    // double-render the quote (we render it from the referenced event). Uses the
    // shared DOM-based strip — the old regex was evadable via mx-reply attrs.
    const formattedBody = $derived(() => {
        const raw = content?.formatted_body as string | undefined;
        if (!raw) return undefined;
        // Spec: formatted_body is only meaningful when the sender declared the
        // custom-HTML format. Otherwise fall through to the plain-body path.
        if (content?.format !== "org.matrix.custom.html") return undefined;
        return (isReply ? stripFormattedFallback(raw) : raw).trim();
    });

    // Replied-to event, if this is a reply
    const inReplyToId = $derived.by(() => {
        // Thread replies carry an m.in_reply_to that is only a DISPLAY fallback
        // (is_falling_back: true) pointing at the previous thread message, not a
        // genuine reply. Rendering it as a quote duplicates what the thread view
        // already shows, so suppress it. Genuine replies-within-a-thread
        // (is_falling_back false/absent) still get their quote.
        const original = event.getOriginalContent();
        // Per the threads spec, is_falling_back sits on m.relates_to itself
        // (a sibling of m.in_reply_to), NOT inside m.in_reply_to.
        const originalRel = original?.["m.relates_to"] as
            | {
                  rel_type?: string;
                  is_falling_back?: boolean;
                  "m.in_reply_to"?: { event_id?: string };
              }
            | undefined;
        if (
            originalRel?.rel_type === "m.thread" &&
            originalRel?.is_falling_back === true
        )
            return undefined;

        const fromContent =
            content?.["m.relates_to"]?.["m.in_reply_to"]?.event_id;
        if (fromContent) return fromContent as string;
        // Edits send m.new_content without m.relates_to, so after an m.replace
        // getContent() drops the reply relation. Fall back to the original
        // event content so edited replies still render their quoted message.
        return original?.["m.relates_to"]?.["m.in_reply_to"]?.event_id as
            | string
            | undefined;
    });
    // Finding the parent is a linear scan of the loaded timeline chunk, and this
    // derived re-runs on every timelineTick for every reply on screen. A resolved
    // target cannot change (same MatrixEvent reference; edits and redactions mutate
    // it in place), so search only while we do not have one — the same
    // resolve-once shape `fetchedReplyTarget` below already uses. Plain `let`, not
    // $state: a memo cell written inside a $derived must stay out of the graph.
    let cachedReplyTarget: CachedReplyTarget<MatrixEvent> | null = null;
    const timelineReplyTarget = $derived.by(() => {
        void messagesState.timelineTick;
        if (!inReplyToId) return null;
        if (shouldRescanReplyTarget(cachedReplyTarget, inReplyToId)) {
            cachedReplyTarget = {
                id: inReplyToId,
                target: findEventById(room, inReplyToId) ?? null,
            };
        }
        return cachedReplyTarget?.target ?? null;
    });
    // Parents outside the loaded timeline window are fetched individually —
    // modern clients (gomuks & friends) omit the legacy "> quote" fallback,
    // so without this their replies render "Original message not loaded".
    let fetchedReplyTarget = $state<MatrixEvent | null>(null);
    $effect(() => {
        const id = inReplyToId;
        if (!id || timelineReplyTarget) {
            fetchedReplyTarget = null;
            return;
        }
        let cancelled = false;
        fetchSingleEvent(room.roomId, id).then((ev) => {
            if (!cancelled) fetchedReplyTarget = ev;
        });
        return () => {
            cancelled = true;
        };
    });
    const replyTarget = $derived(timelineReplyTarget ?? fetchedReplyTarget);
    const replyTargetSender = $derived(
        replyTarget ? getMemberName(room, replyTarget.getSender() ?? "") : null,
    );
    const replyTargetBody = $derived(() => {
        if (!replyTarget) return null;
        const c = replyTarget.getContent();
        if (replyTarget.getType() === "m.room.message") {
            const b: string = c?.body ?? "";
            // Strip nested reply prefix from the quoted message's own body
            const parts = b.split("\n\n");
            if (parts.length >= 2 && parts[0].startsWith(">"))
                return parts.slice(1).join("\n\n");
            return b;
        }
        return null;
    });

    // Sticker URL
    const stickerHttpUrl = $derived(() => {
        if (eventType !== "m.sticker") return null;
        return mxcToHttp(content?.url as string);
    });

    // Whether this uploaded image is a GIF (eligible for favouriting)
    const isGif = $derived(
        msgtype === "m.image" &&
            ((content?.info as { mimetype?: string } | undefined)?.mimetype ===
                "image/gif" ||
                mediaFilename.toLowerCase().endsWith(".gif")),
    );

    // Image conversion.
    // In chat we show a server-scaled 800x600 thumbnail to save bandwidth; the
    // full-resolution image is only requested when opened in the lightbox.
    const imageFullUrl = $derived(() => {
        if (msgtype !== "m.image") return null;
        return mxcToHttp(content?.url as string);
    });
    const imageThumbUrl = $derived(() => {
        if (msgtype !== "m.image") return null;
        // GIFs are served full-res in chat so they keep animating; the server
        // thumbnail would (depending on homeserver) drop the animation.
        if (isGif) return mxcToHttp(content?.url as string);
        return (
            mxcToHttp(content?.url as string, 800, 600, "scale") ??
            mxcToHttp(content?.url as string)
        );
    });

    // Video: nothing is requested until the user clicks play, and then the
    // <video> element streams the media URL itself rather than us buffering the
    // whole file into a blob first. The service worker (static/sw.js) injects
    // the access token into every element-initiated request under
    // /_matrix/client/v1/media/, which is the same path every <img> in this
    // timeline already depends on, so a bare `src` is authenticated.
    //
    // Buffering first was actively harmful: continuwuity sends neither
    // Content-Length nor Accept-Ranges on a media download, so a blob fetch has
    // no progress to report AND cannot start playback early — a 20 MB clip sat
    // on a bare spinner until every byte had landed, by which point the click's
    // user-activation window had expired, `autoplay` was refused, and the video
    // mounted paused on a black first frame. That reads as "it does not play".
    let videoAttempt = $state(0);
    let videoFailed = $state(false);
    let videoThumbFailed = $state(false);
    // The URL to stream, or null when this event carries nothing playable: an
    // encrypted attachment (`content.file` — no decryption path here) or a
    // malformed url. Null must render an inert "unavailable" card, never a play
    // affordance, or the click silently does nothing forever.
    const videoSrcUrl = $derived(
        msgtype === "m.video" ? mxcToHttp(videoSourceMxc(content)) : null,
    );
    function playVideo() {
        videoFailed = false;
        videoAttempt += 1;
    }
    // Poster for the unplayed video body. ONLY ever the sender's uploaded
    // thumbnail — `videoPosterMxc` hands back null otherwise, and we then render
    // the placeholder card below without requesting anything. Never point this
    // at the video's own mxc: continuwuity answers /media/thumbnail for a video
    // with the original file (200 video/mp4), so the <img> would download the
    // whole video and `onerror` fires far too late to prevent it.
    const videoThumbnailUrl = $derived(
        msgtype === "m.video" ? mxcToHttp(videoPosterMxc(content)) : null,
    );
    const videoDuration = $derived(
        msgtype === "m.video"
            ? formatMediaDuration((content?.info as any)?.duration)
            : "",
    );
    // `info.w`/`info.h` come off the wire, so they are whatever the sender put
    // there — never interpolate them into style text raw (a crafted value
    // closes the declaration and adds its own). safeAspectRatio only ever
    // yields `<int> / <int>`.
    const videoAspectRatio = $derived(
        safeAspectRatio((content?.info as any)?.w, (content?.info as any)?.h),
    );

    // Audio: lazy-load blob only after play is clicked
    let audioClicked = $state(false);
    let audioBlobUrl = $state<string | null>(null);
    let audioLoading = $state(false);
    // Voice message (MSC3245): render a waveform + length instead of a bare
    // audio row. Null for ordinary uploaded audio files.
    const voiceMsg = $derived(
        msgtype === "m.audio" ? parseVoiceContent(content) : null,
    );

    $effect(() => {
        if (!audioClicked || msgtype !== "m.audio") return;
        const httpUrl = mxcToHttp(content?.url as string);
        if (!httpUrl) return;
        audioLoading = true;
        let objectUrl: string | null = null;
        fetchAttachmentBlob(httpUrl)
            .then((url) => {
                objectUrl = url;
                audioBlobUrl = url;
                audioLoading = false;
            })
            .catch(() => {
                audioLoading = false;
            });
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            audioBlobUrl = null;
        };
    });

    // Reactively track whether the current image URL is favourited. The
    // full-resolution URL is the favourite key (so the picker sends full quality).
    const imageIsFavourited = $derived.by(() => {
        favouritesState.gifs; // track
        const src = imageFullUrl();
        return !!src && isFavouriteGif(src);
    });

    function toggleImageFavourite(e: MouseEvent) {
        e.stopPropagation();
        const full = imageFullUrl();
        if (!full) return;
        if (isFavouriteGif(full)) {
            removeFavouriteGif(full);
        } else {
            addFavouriteGif({ url: full, previewUrl: imageThumbUrl() ?? full });
        }
    }

    // Relation shape is read from the ORIGINAL content — never the post-edit
    // getContent(), which folds m.new_content and can misreport the relation on
    // an edited event (mirrors client.ts eventThreadRoot). Tick-guarded like
    // `content` so it re-reads when an encrypted event decrypts in place.
    const originalRelatesTo = $derived(
        (void messagesState.timelineTick,
        event.getOriginalContent()?.["m.relates_to"]),
    );

    // Whether this message is a thread reply
    const isThreadReply = $derived(originalRelatesTo?.rel_type === "m.thread");
    // Root of the thread to open for this message: the reply's own thread root
    // if it's a thread reply, otherwise this message starts a new thread.
    const threadRootId = $derived(
        isThreadReply
            ? ((originalRelatesTo?.event_id as string) ?? eventId)
            : eventId,
    );
    // An event whose ORIGINAL content already carries any m.relates_to.rel_type
    // (edit / annotation / thread) cannot legally become a NEW thread root — the
    // server SHOULD-rejects the reply with an opaque 400. Used to suppress the
    // "Reply in thread" offer on such events (Element greys it out likewise).
    // Thread replies are exempt: for them the affordance reads "Open thread".
    const isRelatedEvent = $derived(!!originalRelatesTo?.rel_type);
    // Root summary: this message is a thread ROOT iff other events reply to it.
    // Keyed off roomsTick so the chip refreshes on sync (a live Thread mutates
    // in place — a bare $derived would not re-run; CLAUDE.md reactivity landmine).
    // getThreadSummary mints a fresh object every call, so returning it unchanged
    // would dirty this row on EVERY sync — one row's chip re-rendering is nothing,
    // but there is one of these per timeline row. Keep the previous reference when
    // the value has not moved (same trick as `shield` above, commit 55a5936).
    // Plain `let`, NOT $state: a memo cell written inside a $derived must stay
    // invisible to the reactivity graph (writing $state there throws).
    let lastThreadSummary: ThreadSummary | null = null;
    const threadSummary = $derived.by(() => {
        void roomsState.roomsTick;
        const next = getThreadSummary(room, eventId);
        if (lastThreadSummary && sameThreadSummary(lastThreadSummary, next))
            return lastThreadSummary;
        lastThreadSummary = next;
        return next;
    });
    const isThreadRoot = $derived(!isThreadReply && threadSummary.count > 0);

    // Extract http/https URLs from the plain body for link previews
    const linkedUrls = $derived.by(() => {
        if (msgtype !== "m.text") return [];
        const matches = body().match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
        return [...new Set(matches)];
    });

    // True if the body text consists entirely of emoji + whitespace (no other characters)
    const emojiOnly = $derived.by(() => {
        const b = body();
        if (!b.trim()) return false;
        // Strip Unicode emoji, variation selectors, ZWJ, whitespace, and :shortcode: patterns
        const stripped = b
            .replace(/:\w+:/g, "") // custom emoji shortcodes
            .replace(
                /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]/gu,
                "",
            );
        return stripped.length === 0;
    });

    function withTwemoji(html: string): string {
        const emojiRendered = mapOutsideCode(html, (fragment) =>
            renderHtml(fragment, "twemoji"),
        );
        return highlightCodeBlocks(emojiRendered);
    }

    $effect(() => {
        if (editRequested) {
            editFromKeyboard = true;
            startEdit();
            tick().then(() => editTextareaEl?.focus());
        }
    });

    function startEdit() {
        editText = body();
        isEditing = true;
        tick().then(() => {
            // `scrollBehavior()` rather than a hardcoded "smooth": item 18 made
            // programmatic scrolling honour prefers-reduced-motion.
            rootEl?.scrollIntoView({
                behavior: scrollBehavior(),
                block: "nearest",
            });
            // The action bar is `display:none` while `isEditing` (it must not
            // stay pinned open for the whole edit session), so activating Edit
            // from the keyboard unmounts the very button that holds focus and
            // the browser resets `document.activeElement` to <body>. Moving
            // focus into the textarea here covers that, and makes all three
            // entry points (this button, ArrowUp-in-composer, double-tap)
            // land in the same place. The other two already focus after their
            // own tick(); focus() on the already-focused element is a no-op.
            editTextareaEl?.focus();
        });
    }

    function cancelEdit() {
        isEditing = false;
        editText = "";
        if (editFromKeyboard) {
            editFromKeyboard = false;
            onEditDone?.();
        }
    }

    async function saveEdit() {
        const trimmed = editText.trim();
        const realEventId = event.getId() ?? "";
        if (!realEventId || isSavingEdit) return;

        if (!trimmed) {
            // Empty edit — cancel without returning focus, then prompt to delete
            isEditing = false;
            editText = "";
            deleteRefocus = editFromKeyboard;
            editFromKeyboard = false;
            confirmingDelete = true;
            return;
        }
        isSavingEdit = true;
        try {
            const { formattedBody, hasFormatting } = parseMarkdown(trimmed);
            // Latest resolved mentions live on the post-replacement content
            // (the SDK folds m.new_content in), so this carries them forward
            // through the edit per the v1.7 mentions module.
            await sendEdit(
                room.roomId,
                realEventId,
                trimmed,
                hasFormatting ? formattedBody : undefined,
                event.getContent()["m.mentions"],
            );
            isEditing = false;
            editText = "";
            bumpReactionTick();
            if (editFromKeyboard) {
                editFromKeyboard = false;
                onEditDone?.();
            }
        } catch (err) {
            console.error("Failed to edit message:", err);
        } finally {
            isSavingEdit = false;
        }
    }

    function onEditKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
        }
    }

    function plainToHtml(text: string): string {
        const escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\|\|(.+?)\|\|/gs, "<span data-mx-spoiler>$1</span>");
        // Escaping above keeps this injection-safe; linkify before <br> so
        // newlines still count as mention boundaries. linkifyPlainText covers
        // http(s) URLs as well as bare mentions — a pasted matrix.to link needs
        // to become an anchor for the matrixLinks action to open it in-app.
        return linkifyPlainText(escaped).replace(/\n/g, "<br>");
    }

    function sanitize(html: string): string {
        return sanitizeMatrixHtml(html, { resolveMxc: mxcToHttp });
    }

    async function navigateToMatrixTarget(
        target: Exclude<MatrixLinkTarget, { kind: "user" }>,
    ): Promise<void> {
        let roomId: string;
        let via: string[];
        if (target.kind === "alias") {
            const resolved = await getRoomIdForAlias(target.alias);
            roomId = resolved.roomId;
            via = mergeViaServers(target.via, resolved.servers);
        } else {
            roomId = target.roomId;
            via = target.via;
        }
        if (getRoom(roomId)?.getMyMembership() !== "join") {
            await joinRoom(roomId, via);
        } else {
            // Already joined, but possibly as a state-less stub (see
            // seedRoomStateIfMissing) — heal before deciding how to open it.
            await seedRoomStateIfMissing(roomId);
        }
        // A space link focuses the space; opening it as a chat room would
        // render an empty timeline with a live composer.
        if (getRoom(roomId)?.isSpaceRoom()) {
            setActiveSpace(roomId);
            return;
        }
        if (roomId === room.roomId) {
            if (target.eventId) jumpToReply(target.eventId);
        } else {
            navigateToRoom(roomId);
        }
    }

    // Svelte action: open Matrix links (matrix.to permalinks, matrix: URIs,
    // mention anchors) in-app — user links open the profile card; room and
    // alias links join if needed, then switch rooms — instead of letting the
    // SPA navigate away to matrix.to.
    //
    // MessageItem is one instance per timeline row, so this used to carry a
    // per-row MutationObserver: it swept the row for anchors on every mutation
    // so that `{@html}` content replaced by an edit or a late decryption got
    // decorated too. That job splits in two without an observer — one sweep
    // covers the anchors present when the action runs, and delegated listeners
    // cover anchors rendered later, resolving their target when the event
    // fires. Clicks are delegated for the same reason.
    function matrixLinks(node: HTMLElement) {
        function onClick(e: MouseEvent) {
            if (e.defaultPrevented) return;
            // Modified/middle clicks keep the browser default (new tab).
            if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
            const anchor = (e.target as Element).closest?.("a[href]");
            if (!anchor || !node.contains(anchor)) return;
            const target = parseMatrixLink(anchor.getAttribute("href") ?? "");
            if (!target) return;
            e.preventDefault();
            if (target.kind === "user") {
                openProfileCard(target.userId, anchor as HTMLElement);
                return;
            }
            navigateToMatrixTarget(target).catch((err) => {
                console.error("Failed to open Matrix link:", err);
                showErrorToast(
                    matrixErrorMessage(err, "Could not open the Matrix link"),
                );
            });
        }
        // Full-id tooltip on user links (the anchor text may be a nickname).
        // `data-matrix-link-ready` keeps the sweep and the delegated path from
        // both writing the same anchor.
        function decorateAnchor(anchor: HTMLElement) {
            if (anchor.dataset.matrixLinkReady) return;
            anchor.dataset.matrixLinkReady = "1";
            const title = matrixLinkTitle(anchor.getAttribute("href"));
            if (title) anchor.title = title;
        }
        // `pointerover` and `focusin` both bubble, so one listener each covers
        // anchors that appear after this runs, at the moment a pointer or focus
        // first reaches them.
        function decorate(e: Event) {
            const anchor = (e.target as Element | null)?.closest?.("a[href]");
            if (!(anchor instanceof HTMLElement) || !node.contains(anchor))
                return;
            decorateAnchor(anchor);
        }
        // The anchors that exist now are decorated eagerly, not on first hover:
        // a screen reader's browse mode walks the accessibility tree without
        // dispatching pointer or focus events, so a title that is only written
        // from those events never reaches it — and a pill mention, whose link
        // text is a nickname, is exactly where the full id has to be announced.
        node.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) =>
            decorateAnchor(a),
        );
        node.addEventListener("click", onClick);
        node.addEventListener("pointerover", decorate);
        node.addEventListener("focusin", decorate);
        return {
            destroy() {
                node.removeEventListener("click", onClick);
                node.removeEventListener("pointerover", decorate);
                node.removeEventListener("focusin", decorate);
            },
        };
    }
</script>

{#if showEmojiPicker}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    {#if interfaceState.isTouchscreen}<div
            class="fixed inset-0 z-40"
            onclick={closeModal}
        ></div>{/if}
    {#if interfaceState.isTouchscreen}
        <div
            class="fixed left-0 right-0 z-50"
            style="bottom: {keyboardOffset}px;"
        >
            <EmojiPicker
                {room}
                onSelect={async (emoji) => {
                    await sendReaction(room.roomId, eventId, emoji);
                    closeModal();
                }}
                onSelectCustom={async (emoji) => {
                    await sendReaction(room.roomId, eventId, emoji.mxcUrl);
                    closeModal();
                }}
                onClose={closeModal}
            />
        </div>
    {/if}
{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!--
    The row is a tab stop so the keyboard can reach the hover action bar (which
    is `display:none` until this row, or something inside it, is focus-visible).
    It is deliberately NOT `role="button"`: it isn't one, and claiming the role
    would promise an Enter/Space activation we don't implement.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    bind:this={rootEl}
    class="group {interfaceState.isTouchscreen
        ? ''
        : 'hover:bg-discord-messageHover'} relative flex gap-3 px-4 py-0.5 rounded transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-discord-accent {mentionHighlight
        ? 'bg-discord-warning/10 border-l-2 border-discord-warning'
        : ''}"
    class:pt-3={showHeader}
    class:bg-discord-messageHover={mobileSelected}
    tabindex="0"
    onmouseleave={() => {
        if (!confirmingDelete) return;
    }}
    onclick={() => {
        if (interfaceState.isTouchscreen)
            interfaceState.selectedMessageId = mobileSelected ? null : eventId;
    }}
    ontouchend={onMessageTouchEnd}
    ondblclick={onMessageDblClick}
    data-event-id={eventId}
    use:rovingToolbar={{
        toolbarSelector: "[data-message-actions]",
        // Explicit marker rather than the action's default `button` selector:
        // the bar also hosts the emoji picker and the report dialog, whose
        // buttons must stay out of the roving set (and keep their own
        // tabindexes and arrow keys).
        itemSelector: "[data-message-action]:not([disabled])",
    }}
>
    <!-- Avatar column -->
    <div class="w-10 flex-shrink-0 mt-0.5">
        {#if showHeader}
            <button
                onclick={(e) => {
                    e.stopPropagation();
                    openProfileCard(senderId, e.currentTarget);
                }}
                class="block rounded-full"
                title="View profile"
            >
                <Avatar
                    src={avatarSrc}
                    name={displayName}
                    id={senderId}
                    size={40}
                />
            </button>
        {/if}
    </div>

    <!-- Content column -->
    <div class="flex-1 min-w-0">
        <!-- Sender + timestamp -->
        {#if showHeader}
            <div class="flex items-baseline gap-2 mb-0.5 min-w-0">
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        openProfileCard(senderId, e.currentTarget);
                    }}
                    title={displayName}
                    class="min-w-0 truncate font-semibold text-sm text-discord-textPrimary hover:underline cursor-pointer"
                >
                    {displayName}
                </button>
                <span
                    class="text-xs text-discord-textMuted whitespace-nowrap flex-shrink-0"
                    title={fullTimestamp(timestamp)}
                    >{messageTimestamp(timestamp)}</span
                >
                {#if shield}
                    <EventShield {shield} />
                {/if}
            </div>
        {:else if shield}
            <!-- Grouped messages have no header row, but a shield must never
                 vanish just because a message follows one from the same sender.
                 This borrows the header row's shape so the badge lands in the
                 same column position it would have had above. -->
            <div class="flex items-baseline gap-2 mb-0.5">
                <EventShield {shield} />
            </div>
        {/if}

        <!-- Reply quote block -->
        {#if replyTarget && replyTargetSender && replyTargetBody()}
            <!--
                A real <button>, not `role="button"`: the quote renders only
                plain-text spans (no {@html}, no link, no nested control), so
                the native element is safe — and it gets Enter/Space activation
                through the SAME onclick instead of a hand-rolled key handler.
                `w-full text-left` restores the <div>'s box, which the UA button
                styles would otherwise shrink-wrap and centre.

                The purpose is an sr-only child, NOT `aria-label`: aria-label
                (accname 2C) beats name-from-content (2F), so labelling the
                button would hide the quoted sender and body from assistive tech
                altogether — the one thing the quote exists to convey. As a
                child it prefixes them instead. `sr-only` is position:absolute,
                so it is out of flow and adds no flex item and no `gap-1` gap.
            -->
            <button
                type="button"
                class="flex w-full text-left items-start gap-1 mb-1 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-discord-accent"
                onclick={(e) => {
                    e.preventDefault();
                    jumpToReply(replyTarget.getId()!);
                }}
            >
                <span class="sr-only">Jump to the replied-to message:</span>
                <div
                    class="w-0.5 bg-discord-textMuted rounded-full self-stretch flex-shrink-0 opacity-60"
                ></div>
                <div class="flex items-center gap-1.5 min-w-0">
                    <span
                        class="text-xs font-semibold text-discord-textSecondary flex-shrink-0"
                    >
                        {replyTargetSender}
                    </span>
                    <span
                        class="text-xs text-discord-textSecondary truncate opacity-80"
                    >
                        {replyTargetBody()}
                    </span>
                </div>
            </button>
        {:else if inReplyToId}
            <!-- Referenced event not in timeline — clickable to load context -->
            {@const fallbackLine = (() => {
                const body: string = content?.body ?? "";
                const line = body.split("\n")[0];
                if (!line.startsWith("> ")) return null;
                // Format: "> <@sender:server> text" or "> * <@sender:server> text"
                const m = line.match(/^> (?:\* )?<(@[^>]+)> ?(.*)/);
                return m ? { sender: m[1], text: m[2] } : null;
            })()}
            <!-- Same <button> choice, and the same sr-only-child labelling, as
                 the resolved quote above, so both previews behave identically
                 from the keyboard and read identically to assistive tech. -->
            <button
                type="button"
                class="flex w-full text-left items-start gap-1 mb-1 rounded cursor-pointer opacity-60 hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-discord-accent"
                onclick={(e) => {
                    e.preventDefault();
                    jumpToReply(inReplyToId);
                }}
            >
                <span class="sr-only">Jump to the replied-to message:</span>
                <div
                    class="w-0.5 bg-discord-textMuted rounded-full self-stretch flex-shrink-0"
                ></div>
                <div class="flex items-center gap-1.5 min-w-0">
                    {#if fallbackLine}
                        <span
                            class="text-xs font-semibold text-discord-textSecondary flex-shrink-0"
                            >{fallbackLine.sender}</span
                        >
                        <span class="text-xs text-discord-textMuted truncate"
                            >{fallbackLine.text || "…"}</span
                        >
                    {:else}
                        <!-- A fetched parent with no previewable content was
                             deleted; otherwise the fetch is pending/failed. -->
                        <span class="text-xs text-discord-textMuted italic"
                            >{replyTarget
                                ? "Original message deleted"
                                : "Original message not loaded"}</span
                        >
                    {/if}
                </div>
            </button>
        {/if}

        <!-- Media caption (MSC2530): rendered as a normal message above the
             media, so an image/video/etc. with a caption reads like a message
             followed by the attachment. -->
        {#snippet mediaCaption()}
            {#if hasCaption()}
                <div
                    use:spoilers
                    use:matrixLinks
                    class="message-body text-sm text-discord-textPrimary leading-relaxed break-words"
                >
                    {#if formattedBody()}
                        {@html withTwemoji(sanitize(formattedBody()!))}
                    {:else}
                        {@html withTwemoji(plainToHtml(body()))}
                    {/if}
                    {#if isEdited}
                        <span class="text-xs text-discord-textMuted ml-1"
                            >(edited)</span
                        >
                    {/if}
                </div>
            {/if}
        {/snippet}

        <!-- Message body -->
        {#if isPoll}
            <PollBody {event} {room} />
        {:else if eventType === "m.room.encrypted"}
            <!-- E2EE UTD (unable-to-decrypt) placeholder. The row chrome
                 (avatar / sender / timestamp) is cleartext; only the body is
                 unavailable. When keys arrive mid-session the decryption tick
                 re-runs this derived timeline and the row swaps to real
                 content automatically. -->
            <div
                class="message-body flex items-center gap-1.5 text-sm italic text-discord-textMuted leading-relaxed"
            >
                <Lock size={14} class="flex-shrink-0" />
                <span>{UTD_PLACEHOLDER_TEXT}</span>
            </div>
        {:else if eventType === "m.sticker"}
            {@const src = stickerHttpUrl()}
            {#if src}
                <img
                    {src}
                    alt={content?.body ?? "sticker"}
                    class="max-w-48 max-h-48 object-contain mt-1"
                    loading="lazy"
                />
            {/if}
        {:else if msgtype === "m.image"}
            {@render mediaCaption()}
            {@const thumb = imageThumbUrl()}
            {@const full = imageFullUrl()}
            {#if thumb}
                <div class="relative inline-block group/img mt-1">
                    <a
                        href={full}
                        target="_blank"
                        rel="noopener noreferrer"
                        onclick={(e) => {
                            e.preventDefault();
                            imageLightboxOpen = true;
                        }}
                    >
                        <img
                            src={thumb}
                            alt={mediaFilename}
                            class="max-w-sm w-full max-h-72 rounded-lg object-contain cursor-pointer block"
                            loading="lazy"
                        />
                    </a>
                    {#if isGif}
                        <button
                            onclick={toggleImageFavourite}
                            title={imageIsFavourited
                                ? "Remove from favourites"
                                : "Add to favourites"}
                            class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/70"
                        >
                            {#if imageIsFavourited}
                                <svg
                                    class="w-4 h-4 text-discord-warning"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                    />
                                </svg>
                            {:else}
                                <svg
                                    class="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                    />
                                </svg>
                            {/if}
                        </button>
                    {/if}
                </div>
                {#if imageLightboxOpen && full}
                    <Lightbox
                        src={full}
                        alt={mediaFilename}
                        favourite={isGif
                            ? { url: full, previewUrl: thumb ?? full }
                            : undefined}
                        onClose={() => (imageLightboxOpen = false)}
                    />
                {/if}
            {:else}
                <span class="text-xs text-discord-textMuted italic"
                    >[Image unavailable]</span
                >
            {/if}
        {:else if msgtype === "m.video"}
            {@render mediaCaption()}
            {#if videoSrcUrl === null}
                <!-- Nothing this client can play: an encrypted attachment (no
                     decryption path here) or a malformed url. Deliberately NOT
                     clickable — a play affordance that can never resolve a
                     source is a dead click, which is exactly how this gets
                     reported as "videos cannot be played at all". -->
                <div
                    class="flex items-center gap-3 px-4 py-3 mt-1 max-w-sm w-full bg-discord-backgroundTertiary rounded-lg"
                >
                    <div
                        class="w-10 h-10 rounded-full bg-discord-backgroundSecondary flex items-center justify-center flex-shrink-0"
                    >
                        <svg
                            class="w-5 h-5 text-discord-textMuted"
                            fill="currentColor"
                            viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
                        >
                    </div>
                    <div class="min-w-0">
                        <p
                            class="text-sm font-medium text-discord-textPrimary truncate"
                        >
                            {mediaFilename || "Video"}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            Can't be played here
                        </p>
                    </div>
                </div>
            {:else if videoAttempt > 0 && !videoFailed}
                <!-- Keyed so a retry after a failure remounts the element: the
                     src is unchanged, so without this Svelte would patch
                     nothing and the browser would never re-attempt the load. -->
                {#key videoAttempt}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video
                        src={videoSrcUrl}
                        controls
                        autoplay
                        playsinline
                        preload="auto"
                        class="max-w-sm w-full max-h-72 rounded-lg mt-1 block"
                        onerror={() => (videoFailed = true)}
                    ></video>
                {/key}
            {:else}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                    class="relative max-w-sm w-full mt-1 rounded-lg overflow-hidden cursor-pointer group bg-black"
                    style={videoThumbnailUrl && !videoThumbFailed
                        ? `aspect-ratio: ${videoAspectRatio}; max-height: 18rem;`
                        : ""}
                    onclick={playVideo}
                >
                    {#if videoThumbnailUrl && !videoThumbFailed}
                        <img
                            src={videoThumbnailUrl}
                            alt=""
                            class="w-full h-full object-cover"
                            onerror={() => (videoThumbFailed = true)}
                        />
                        <div
                            class="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors"
                        >
                            <div
                                class="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center"
                            >
                                <svg
                                    class="w-7 h-7 text-white ml-1"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path d="M8 5v14l11-7z" /></svg
                                >
                            </div>
                            <p
                                class="mt-2 text-xs text-white font-medium drop-shadow px-2 py-1 text-center line-clamp-1 rounded-full bg-black/60"
                            >
                                {mediaFilename}
                            </p>
                        </div>
                    {:else}
                        <!-- No sender-uploaded thumbnail: a deliberate neutral
                             card carrying the play affordance, the filename and
                             the duration when the sender gave one. Nothing is
                             requested from the server until it is clicked —
                             asking /media/thumbnail for the video itself would
                             download the whole file (see videoThumbnailUrl). -->
                        <div
                            class="flex items-center gap-3 px-4 py-3 bg-discord-backgroundTertiary group-hover:bg-discord-messageHover transition-colors rounded-lg"
                        >
                            <div
                                class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 {videoFailed
                                    ? 'bg-discord-danger'
                                    : 'bg-discord-accent'}"
                            >
                                <svg
                                    class="w-5 h-5 text-white ml-0.5"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path d="M8 5v14l11-7z" /></svg
                                >
                            </div>
                            <div class="min-w-0">
                                <p
                                    class="text-sm font-medium text-discord-textPrimary truncate"
                                >
                                    {mediaFilename || "Video"}
                                </p>
                                <!-- A failed load has to SAY so. Silently
                                     dropping back to "Click to play" is
                                     indistinguishable from the click having
                                     done nothing at all. -->
                                <p
                                    class="text-xs {videoFailed
                                        ? 'text-discord-danger'
                                        : 'text-discord-textMuted'}"
                                >
                                    {videoFailed
                                        ? "Playback failed · Click to retry"
                                        : videoDuration
                                          ? `${videoDuration} · Click to play`
                                          : "Click to play"}
                                </p>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        {:else if msgtype === "m.audio"}
            {@render mediaCaption()}
            {#if voiceMsg}
                <VoiceMessagePlayer
                    mxcUrl={content?.url as string}
                    waveform={voiceMsg.waveform}
                    durationMs={voiceMsg.durationMs}
                />
            {:else}
                <div
                    class="flex items-center gap-3 p-3 bg-discord-backgroundTertiary rounded-lg mt-1 max-w-sm w-full"
                >
                    <!-- svelte-ignore a11y_consider_explicit_label -->
                    <button
                        onclick={() => {
                            if (!audioBlobUrl) audioClicked = true;
                        }}
                        class="w-8 h-8 rounded-full bg-discord-accent flex-shrink-0 flex items-center justify-center disabled:opacity-50"
                        disabled={audioLoading}
                    >
                        {#if audioLoading}
                            <div
                                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                            ></div>
                        {:else if !audioBlobUrl}
                            <svg
                                class="w-4 h-4 text-white ml-0.5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                ><path d="M8 5v14l11-7z" /></svg
                            >
                        {:else}
                            <svg
                                class="w-4 h-4 text-white"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                    d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"
                                /></svg
                            >
                        {/if}
                    </button>
                    <div class="flex-1 min-w-0">
                        <p
                            class="text-discord-textPrimary text-xs font-medium truncate mb-1"
                        >
                            {mediaFilename || "Audio"}
                        </p>
                        {#if audioBlobUrl}
                            <!-- svelte-ignore a11y_media_has_caption -->
                            <audio
                                controls
                                autoplay
                                src={audioBlobUrl}
                                class="w-full h-8"
                            ></audio>
                        {:else}
                            <p class="text-discord-textMuted text-xs">
                                {audioLoading ? "Loading…" : "Click to play"}
                            </p>
                        {/if}
                    </div>
                </div>
            {/if}
        {:else if isVerificationRequest}
            <VerificationRequestMessage
                eventId={event.getId() ?? ""}
                senderName={displayName}
                isOwn={isOwnMessage}
            />
        {:else if msgtype === "m.location"}
            <LocationBody
                {content}
                senderName={displayName}
                senderAvatarUrl={avatarSrc}
                isSelf={isOwnMessage}
            />
        {:else if msgtype === "m.file"}
            {@const fileUrl = mxcToHttp(content?.url as string)}
            {@const fileSize = (content?.info as any)?.size}
            {@const fileName = mediaFilename}
            {@const isSwf = fileName.toLowerCase().endsWith(".swf")}
            {@render mediaCaption()}
            {#if isSwf && fileUrl}
                <SwfEmbed getSrc={() => fetchAttachmentBlob(fileUrl)} />
            {/if}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="flex items-center gap-2 p-3 bg-discord-backgroundSecondary rounded-lg mt-1 max-w-sm w-full"
            >
                <svg
                    class="w-8 h-8 text-discord-accent flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
                    />
                </svg>
                <div class="min-w-0 flex-1">
                    <p
                        class="text-discord-textPrimary text-sm font-medium truncate"
                    >
                        {fileName}
                    </p>
                    <p class="text-discord-textMuted text-xs">
                        {#if fileSize}{fileSize / 1024 < 1024
                                ? (fileSize / 1024).toFixed(1) + " KB"
                                : (fileSize / 1048576).toFixed(1) +
                                  " MB"}{:else}File attachment{/if}
                    </p>
                </div>
                {#if fileUrl}
                    <button
                        onclick={async () => {
                            const blobUrl = await fetchAttachmentBlob(fileUrl);
                            const a = document.createElement("a");
                            a.href = blobUrl;
                            a.download = fileName;
                            a.click();
                            setTimeout(
                                () => URL.revokeObjectURL(blobUrl),
                                10000,
                            );
                        }}
                        class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                        title="Download"
                    >
                        <svg
                            class="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"
                            />
                        </svg>
                    </button>
                {/if}
            </div>
        {:else if isEditing}
            <div class="mt-1">
                <textarea
                    bind:this={editTextareaEl}
                    bind:value={editText}
                    onkeydown={onEditKeydown}
                    rows="1"
                    class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-2 py-1.5 outline-none resize-none focus:ring-1 focus:ring-discord-accent/50"
                    style="field-sizing: content; max-height: 200px;"
                ></textarea>
                <p class="text-xs text-discord-textMuted mt-1">
                    <kbd class="font-mono">Enter</kbd> to save &middot;
                    <kbd class="font-mono">Esc</kbd> to cancel
                </p>
                <div class="flex gap-2 mt-1">
                    <button
                        onclick={saveEdit}
                        disabled={isSavingEdit || !editText.trim()}
                        class="px-3 py-1 text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white rounded transition-colors disabled:opacity-50"
                        >Save</button
                    >
                    <button
                        onclick={cancelEdit}
                        class="px-3 py-1 text-xs font-semibold bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary rounded transition-colors"
                        >Cancel</button
                    >
                </div>
            </div>
        {:else}
            <div
                use:spoilers
                use:matrixLinks
                class="message-body text-sm text-discord-textPrimary leading-relaxed break-words"
                class:emoji-only={emojiOnly}
                class:italic={msgtype === "m.emote"}
                class:opacity-70={msgtype === "m.notice"}
            >
                {#if msgtype === "m.emote"}
                    <!-- m.emote: prefix the action with the sender's name so it
                         reads "* Name does something" even in grouped messages
                         where the header is hidden. Uses the same member-name
                         helper as the header (displayName). Rendered as its own
                         span, NEVER concatenated into the {@html} body (that
                         would corrupt the sanitized/escaped output). -->
                    <span>* {displayName}{" "}</span>
                {/if}
                {#if formattedBody()}
                    {@html withTwemoji(sanitize(formattedBody()!))}
                {:else}
                    {@html withTwemoji(plainToHtml(body()))}
                {/if}
                {#if isEdited}
                    <span class="text-xs text-discord-textMuted ml-1"
                        >(edited)</span
                    >
                {/if}
            </div>
            {#each linkedUrls as url (url)}
                <LinkPreview {url} />
            {/each}
        {/if}

        <!-- Thread summary chip (root only, once replies are diverted) -->
        {#if isThreadRoot}
            <button
                onclick={() => onOpenThread?.(eventId)}
                class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs text-discord-textMuted bg-discord-backgroundSecondary border border-discord-divider hover:text-discord-textPrimary hover:border-discord-accent/50 transition-colors"
                title="Open thread"
            >
                <svg
                    class="w-3 h-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
                    />
                </svg>
                {threadSummary.count}
                {threadSummary.count === 1 ? "reply" : "replies"}
                {#if threadSummary.latestTs > 0}
                    <span class="text-discord-textMuted"
                        >&middot; {timeOnly(threadSummary.latestTs)}</span
                    >
                {/if}
            </button>
        {/if}

        <!-- Reactions -->
        <Reactions {eventId} {room} {reactionTick} />

        <!-- Failed-send indicator: retry or delete a NOT_SENT local echo -->
        {#if isFailed}
            <div
                class="flex items-center gap-2 px-4 py-0.5 text-xs text-discord-danger"
            >
                <svg
                    class="w-4 h-4 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Failed to send.</span>
                <button
                    class="font-semibold underline hover:no-underline disabled:opacity-50"
                    disabled={isResending}
                    onclick={retrySend}
                >
                    {isResending ? "Retrying…" : "Retry"}
                </button>
                <span class="text-discord-textMuted">·</span>
                <button
                    class="font-semibold underline hover:no-underline"
                    onclick={() => deleteFailedMessage(event)}
                >
                    Delete
                </button>
            </div>
        {/if}

        <!-- Read receipts -->
        {#if receipts.length > 0}
            <div class="flex items-center gap-0.5 px-4 pb-0.5 justify-end">
                {#each receipts.slice(0, 5) as r (r.userId)}
                    <div title={r.name}>
                        <Avatar
                            src={r.avatarUrl}
                            name={r.name}
                            id={r.userId}
                            size={16}
                        />
                    </div>
                {/each}
                {#if receipts.length > 5}
                    <span class="text-[10px] text-discord-textMuted ml-1"
                        >+{receipts.length - 5}</span
                    >
                {/if}
            </div>
        {/if}

        <!-- Inline timestamp (non-grouped messages, shows on hover) -->
        {#if !showHeader}
            <span
                class="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-discord-textMuted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none"
            >
                {timeOnly(timestamp)}
            </span>
        {/if}
    </div>

    <!--
        Hover action bar: always visible when a picker/dialog is open, otherwise
        on group-hover OR *keyboard* focus. The focus reveal is what makes the
        bar keyboard reachable — the row itself is the already-focusable element
        that triggers it (a `display:none` bar can't reveal itself), and
        `use:rovingToolbar` on the row keeps the whole bar to one tab stop.

        It is `:focus-visible`, NOT `:focus-within`: the row is `tabindex="0"`,
        so a plain click/tap on message text focuses it, and `:focus-within`
        would then leave the bar stuck open with nothing to blur it (two bars
        visible at once on desktop; tap-to-dismiss dead on touch). Both forms
        are needed — `group-focus-visible` for the row itself being focused,
        and `group-has-[:focus-visible]` for a focused button inside the bar,
        because `:has()` only matches descendants.

        The HOVER reveal stays pointer-gated even though `group` no longer is.
        Mobile browsers apply `:hover` on tap and hold it until the next tap
        elsewhere, so an ungated `group-hover:flex` would pin the bar open
        after the tap that clears `selectedMessageId` — tap-to-dismiss dead,
        and a scrolled-away row left wearing a floating bar. Before this branch
        the row carried no `group` at all on touch, which is what kept
        `group-hover:` from ever matching; the class here restores exactly that
        while leaving `group` itself unconditional for the focus reveal.

        The FOCUS reveals are suppressed for the whole inline-edit session.
        `:focus-visible` matches a focused text-entry element whatever the
        modality, so the edit <textarea> (a descendant of this row) otherwise
        keeps `group-has-[:focus-visible]` true from the moment Edit is
        clicked — pinning this row's bar open while the pointer hovers another
        row's, two floating bars at once. Hover is left alone: it follows the
        pointer, so it cannot pin anything.
    -->
    <div
        data-message-actions
        role="toolbar"
        aria-label="Message actions"
        class="{showEmojiPicker ||
        confirmingDelete ||
        showReportDialog ||
        mobileSelected
            ? 'flex'
            : `hidden ${
                  interfaceState.isTouchscreen ? '' : 'group-hover:flex'
              } ${
                  isEditing
                      ? ''
                      : 'group-focus-visible:flex group-has-[:focus-visible]:flex'
              }`} absolute right-4 top-0 -translate-y-1/2 items-center gap-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg px-1 py-0.5 shadow-md z-20"
    >
        {#if isOwnMessage && eventType === "m.room.message" && msgtype === "m.text"}
            <button
                data-message-action
                onclick={startEdit}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title="Edit message"
                aria-label="Edit message"
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                    />
                </svg>
            </button>
        {/if}
        {#if isOwnMessage}
            {#if confirmingDelete}
                <span class="text-xs text-discord-textMuted px-1">Delete?</span>
                <!--
                    Deliberately NOT `data-message-action`: these two run their
                    own ArrowLeft/ArrowRight handler (onDeleteKeydown), and the
                    roving toolbar stops propagation on the keys it owns, which
                    would kill it. Staying out of the roving set leaves them as
                    ordinary tab stops for the life of the confirmation — which
                    is what keeps them reachable if focus wanders off.
                -->
                <button
                    bind:this={deleteYesEl}
                    onclick={() => resolveDelete(true)}
                    onkeydown={onDeleteKeydown}
                    class="px-2 py-1 rounded text-xs font-semibold text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors focus:outline-none focus:ring-2 focus:ring-discord-danger"
                    aria-label="Yes, delete message">Yes</button
                >
                <button
                    bind:this={deleteNoEl}
                    onclick={() => resolveDelete(false)}
                    onkeydown={onDeleteKeydown}
                    class="px-2 py-1 rounded text-xs font-semibold text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors focus:outline-none focus:ring-2 focus:ring-discord-accent"
                    aria-label="No, keep message">No</button
                >
            {:else}
                <button
                    data-message-action
                    onclick={() => (confirmingDelete = true)}
                    class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
                    title="Delete message"
                    aria-label="Delete message"
                >
                    <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                        />
                    </svg>
                </button>
            {/if}
        {/if}
        {#if canPin}
            <button
                data-message-action
                onclick={async () => {
                    const wasPinned = isPinned;
                    try {
                        if (wasPinned) await unpinMessage(room, eventId);
                        else await pinMessage(room, eventId);
                    } catch (e) {
                        console.error("Failed to update pinned messages", e);
                        showErrorToast(
                            wasPinned
                                ? "Failed to unpin message"
                                : "Failed to pin message",
                        );
                    }
                }}
                class="p-1.5 rounded hover:bg-discord-messageHover transition-colors {isPinned
                    ? 'text-discord-accent'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={isPinned ? "Unpin message" : "Pin message"}
                aria-label={isPinned ? "Unpin message" : "Pin message"}
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"
                    ><path
                        d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
                    /></svg
                >
            </button>
        {/if}
        <!-- Add reaction -->
        <div class="relative">
            <button
                data-message-action
                bind:this={reactionBtnEl}
                onclick={() => {
                    if (showEmojiPicker) {
                        closeModal();
                    } else {
                        emojiPickerBelow =
                            (reactionBtnEl?.getBoundingClientRect().top ??
                                400) < 400;
                        openReactionPicker();
                    }
                }}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title="Add reaction"
                aria-label="Add reaction"
                aria-expanded={showEmojiPicker}
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        fill-rule="evenodd"
                        d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zM8.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM15.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM6.89 13.5h10.22c-.8 2.04-2.78 3.5-5.11 3.5s-4.31-1.46-5.11-3.5z"
                    />
                </svg>
            </button>
            {#if showEmojiPicker && !interfaceState.isTouchscreen}
                <div
                    bind:this={emojiPickerEl}
                    class={emojiPickerBelow
                        ? "absolute top-full right-0 mt-1 z-50"
                        : "absolute bottom-full right-0 mb-1 z-50"}
                >
                    <EmojiPicker
                        {room}
                        onSelect={async (emoji) => {
                            await sendReaction(room.roomId, eventId, emoji);
                            closeModal();
                        }}
                        onSelectCustom={async (emoji) => {
                            await sendReaction(
                                room.roomId,
                                eventId,
                                emoji.mxcUrl,
                            );
                            closeModal();
                        }}
                        onClose={closeModal}
                    />
                </div>
            {/if}
        </div>
        <button
            data-message-action
            onclick={() => onReply(event)}
            class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            title="Reply"
            aria-label="Reply"
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"
                />
            </svg>
        </button>
        {#if onOpenThread && (isThreadReply || !isRelatedEvent)}
            <button
                data-message-action
                onclick={() => onOpenThread(threadRootId)}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title={isThreadReply ? "Open thread" : "Reply in thread"}
                aria-label={isThreadReply ? "Open thread" : "Reply in thread"}
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 14H6v-2h2v2zm0-3H6V9h2v2zm0-3H6V6h2v2zm7 6h-5v-2h5v2zm3-3h-8V9h8v2zm0-3h-8V6h8v2z"
                    />
                </svg>
            </button>
        {/if}
        {#if (eventType === "m.room.message" || eventType === "m.sticker") && !isFailed}
            <button
                data-message-action
                onclick={openForwardDialog}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title="Forward message"
                aria-label="Forward message"
            >
                <Forward size={16} />
            </button>
        {/if}
        {#if !isOwnMessage && !isFailed}
            <MessageReportAction
                roomId={room.roomId}
                {eventId}
                {keyboardOffset}
                bind:open={showReportDialog}
            />
        {/if}
    </div>
</div>

{#if showForwardDialog}
    <ForwardMessageDialog {event} />
{/if}

<style>
    /* Spoiler tags */
    :global([data-mx-spoiler]) {
        background-color: var(--discord-spoiler-bg);
        color: transparent;
        border-radius: 3px;
        padding: 0 3px;
        cursor: pointer;
        user-select: none;
        transition:
            color 0.15s,
            background-color 0.15s;
    }
    :global([data-mx-spoiler].revealed) {
        background-color: var(--discord-spoiler-revealed-bg);
        color: inherit;
        user-select: text;
    }

    /* Twemoji images inline in text */
    :global(.twemoji) {
        height: 1.25em;
        width: 1.25em;
        vertical-align: -0.25em;
        display: inline-block;
        object-fit: contain;
    }

    /* Larger emoji when the message is emoji-only */
    :global(.emoji-only .twemoji) {
        height: 36px;
        width: 36px;
        vertical-align: -0.4em;
    }

    /* Custom emoji (data-mx-emoticon) inline size */
    :global([data-mx-emoticon]) {
        height: 1.25em !important;
        width: auto;
        vertical-align: -0.25em;
        display: inline-block;
        object-fit: contain;
    }

    :global(.emoji-only [data-mx-emoticon]) {
        height: 36px !important;
        width: auto;
        vertical-align: -0.4em;
    }

    /* Prevent server-sent HTML content from overflowing on mobile */
    :global(.message-body img) {
        max-width: 100%;
        height: auto;
    }
    :global(.message-body pre) {
        overflow-x: auto;
        max-width: 100%;
        margin: 0.35rem 0;
        border: 1px solid var(--discord-divider);
        border-radius: 6px;
        background: var(--discord-bg-tertiary);
        padding: 0.75rem;
    }
    :global(.message-body pre code) {
        font-family: "Roboto Mono", Consolas, "Liberation Mono", monospace;
        font-size: 0.8125rem;
        line-height: 1.5;
    }
    :global(.message-body .hljs-keyword),
    :global(.message-body .hljs-selector-tag),
    :global(.message-body .hljs-literal) {
        color: var(--syntax-keyword);
    }
    :global(.message-body .hljs-string),
    :global(.message-body .hljs-attr),
    :global(.message-body .hljs-template-tag) {
        color: var(--syntax-string);
    }
    :global(.message-body .hljs-number),
    :global(.message-body .hljs-symbol),
    :global(.message-body .hljs-bullet) {
        color: var(--syntax-number);
    }
    :global(.message-body .hljs-title),
    :global(.message-body .hljs-function),
    :global(.message-body .hljs-section) {
        color: var(--syntax-title);
    }
    :global(.message-body .hljs-comment),
    :global(.message-body .hljs-quote) {
        color: var(--syntax-comment);
        font-style: italic;
    }
    :global(.message-body .hljs-variable),
    :global(.message-body .hljs-params),
    :global(.message-body .hljs-type) {
        color: var(--syntax-variable);
    }
    :global(.message-body table) {
        display: block;
        overflow-x: auto;
        max-width: 100%;
    }
</style>
