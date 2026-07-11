<script lang="ts">
    import { EventStatus } from "matrix-js-sdk";
    import type { MatrixEvent, Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import EmojiPicker from "$lib/components/ui/EmojiPicker.svelte";
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
    } from "$lib/matrix/client";
    import { parseMarkdown } from "$lib/utils/markdown";

    import {
        messagesState,
        bumpReactionTick,
    } from "$lib/stores/messages.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { tick } from "svelte";
    import { format } from "date-fns";
    import { renderHtml } from "$lib/utils/twemoji";
    import { sanitizeMatrixHtml } from "$lib/utils/sanitizeHtml";
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
    } from "$lib/stores/interface.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";

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
        loudHighlight?: boolean;
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
        loudHighlight = false,
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

    function openReactionPicker() {
        showEmojiPicker = true;
        openModal("reaction-picker", () => {
            showEmojiPicker = false;
            interfaceState.selectedMessageId = null;
        });
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
        }
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
        return event.getContent();
    });
    const eventType = $derived(event.getType());
    const msgtype = $derived(content?.msgtype ?? "");

    // Strip the Matrix reply fallback prefix ("> quoted text\n\n") from body
    const body = $derived(() => {
        const raw: string = content?.body ?? "";
        const inReplyTo = content?.["m.relates_to"]?.["m.in_reply_to"];
        if (!inReplyTo) return raw;
        // Fallback quote lines start with "> ", followed by a blank line before the real reply
        const parts = raw.split("\n\n");
        if (parts.length >= 2 && parts[0].startsWith(">")) {
            return parts.slice(1).join("\n\n");
        }
        return raw;
    });

    // Strip <mx-reply>...</mx-reply> from formatted_body so we don't double-render the quote
    const formattedBody = $derived(() => {
        const raw = content?.formatted_body as string | undefined;
        if (!raw) return undefined;
        return raw.replace(/<mx-reply>[\s\S]*?<\/mx-reply>/i, "").trim();
    });

    // Replied-to event, if this is a reply
    const inReplyToId = $derived.by(() => {
        const fromContent =
            content?.["m.relates_to"]?.["m.in_reply_to"]?.event_id;
        if (fromContent) return fromContent as string;
        // Edits send m.new_content without m.relates_to, so after an m.replace
        // getContent() drops the reply relation. Fall back to the original
        // event content so edited replies still render their quoted message.
        const original = event.getOriginalContent();
        return original?.["m.relates_to"]?.["m.in_reply_to"]?.event_id as
            | string
            | undefined;
    });
    const replyTarget = $derived(
        (void messagesState.timelineTick,
        inReplyToId ? findEventById(room, inReplyToId) : null),
    );
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
                body().toLowerCase().endsWith(".gif")),
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

    // Video: lazy-load blob only after thumbnail is clicked
    let videoClicked = $state(false);
    let videoBlobUrl = $state<string | null>(null);
    let videoLoading = $state(false);
    let videoThumbFailed = $state(false);
    const videoThumbnailUrl = $derived(
        msgtype === "m.video"
            ? (mxcToHttp((content?.info as any)?.thumbnail_url as string) ??
                  mxcToHttp(content?.url as string, 640, 480, "scale"))
            : null,
    );

    $effect(() => {
        if (!videoClicked || msgtype !== "m.video") return;
        const httpUrl = mxcToHttp(content?.url as string);
        if (!httpUrl) return;
        videoLoading = true;
        let objectUrl: string | null = null;
        fetchAttachmentBlob(httpUrl)
            .then((url) => {
                objectUrl = url;
                videoBlobUrl = url;
                videoLoading = false;
            })
            .catch(() => {
                videoLoading = false;
            });
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            videoBlobUrl = null;
        };
    });

    // Audio: lazy-load blob only after play is clicked
    let audioClicked = $state(false);
    let audioBlobUrl = $state<string | null>(null);
    let audioLoading = $state(false);

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

    // Whether this message is a thread reply
    const isThreadReply = $derived(
        content?.["m.relates_to"]?.rel_type === "m.thread",
    );
    // Root of the thread to open for this message: the reply's own thread root
    // if it's a thread reply, otherwise this message starts a new thread.
    const threadRootId = $derived(
        isThreadReply
            ? ((content?.["m.relates_to"]?.event_id as string) ?? eventId)
            : eventId,
    );

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
        return renderHtml(html, "twemoji");
    }

    function formatTime(ts: number, timeOnly = false): string {
        const d = new Date(ts);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString() || timeOnly)
            return format(d, "h:mm a");
        if (d.toDateString() === yesterday.toDateString())
            return "Yesterday at " + format(d, "h:mm a");
        return format(d, "yyyy/MM/dd h:mm a");
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
        tick().then(() =>
            rootEl?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        );
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
            await sendEdit(
                room.roomId,
                realEventId,
                trimmed,
                hasFormatting ? formattedBody : undefined,
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
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\|\|(.+?)\|\|/gs, "<span data-mx-spoiler>$1</span>")
            .replace(/\n/g, "<br>");
    }

    // Svelte action: make [data-mx-spoiler] spans toggle-reveal on click
    function spoilers(node: HTMLElement) {
        function setup() {
            node.querySelectorAll<HTMLElement>("[data-mx-spoiler]").forEach(
                (el) => {
                    if (el.dataset.spoilerReady) return;
                    el.dataset.spoilerReady = "1";
                    el.addEventListener("click", () =>
                        el.classList.toggle("revealed"),
                    );
                },
            );
        }
        setup();
        const observer = new MutationObserver(setup);
        observer.observe(node, { childList: true, subtree: true });
        return {
            destroy() {
                observer.disconnect();
            },
        };
    }

    function sanitize(html: string): string {
        return sanitizeMatrixHtml(html, { resolveMxc: mxcToHttp });
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
<div
    bind:this={rootEl}
    class="{interfaceState.isTouchscreen
        ? ''
        : 'group hover:bg-discord-messageHover'} relative flex gap-3 px-4 py-0.5 rounded transition-colors {loudHighlight
        ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
        : ''}"
    class:pt-3={showHeader}
    class:bg-discord-messageHover={mobileSelected}
    onmouseleave={() => {
        if (!confirmingDelete) return;
    }}
    onclick={() => {
        if (interfaceState.isTouchscreen)
            interfaceState.selectedMessageId = mobileSelected ? null : eventId;
    }}
    data-event-id={eventId}
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
            <div class="flex items-baseline gap-2 mb-0.5">
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        openProfileCard(senderId, e.currentTarget);
                    }}
                    class="font-semibold text-sm text-discord-textPrimary hover:underline cursor-pointer"
                >
                    {displayName}
                </button>
                <span class="text-xs text-discord-textMuted"
                    >{formatTime(timestamp)}</span
                >
            </div>
        {/if}

        <!-- Reply quote block -->
        {#if replyTarget && replyTargetSender && replyTargetBody()}
            <div
                class="flex items-start gap-1 mb-1 cursor-default cursor-pointer"
                onclick={(e) => {
                    e.preventDefault();
                    jumpToReply(replyTarget.getId()!);
                }}
            >
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
            </div>
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
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
                class="flex items-start gap-1 mb-1 cursor-pointer opacity-60 hover:opacity-80 transition-opacity"
                onclick={(e) => {
                    e.preventDefault();
                    jumpToReply(inReplyToId);
                }}
            >
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
                        <span class="text-xs text-discord-textMuted italic"
                            >Original message not loaded</span
                        >
                    {/if}
                </div>
            </div>
        {/if}

        <!-- Message body -->
        {#if eventType === "m.sticker"}
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
            {#if body()}
                <div
                    class="message-body text-sm text-discord-textPrimary leading-relaxed break-words"
                >
                    {@html withTwemoji(plainToHtml(body()))}
                </div>
            {/if}
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
                            alt={body()}
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
                        alt={body()}
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
            {#if videoBlobUrl}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                    src={videoBlobUrl}
                    controls
                    autoplay
                    class="max-w-sm w-full max-h-72 rounded-lg mt-1 block"
                ></video>
            {:else}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                    class="relative max-w-sm w-full mt-1 rounded-lg overflow-hidden cursor-pointer group bg-black"
                    style={videoThumbnailUrl && !videoThumbFailed
                        ? `aspect-ratio: ${(content?.info as any)?.w && (content?.info as any)?.h ? `${(content.info as any).w}/${(content.info as any).h}` : "16/9"}; max-height: 18rem;`
                        : ""}
                    onclick={() => {
                        videoClicked = true;
                    }}
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
                            {#if videoLoading}
                                <div
                                    class="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin"
                                ></div>
                            {:else}
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
                            {/if}
                            <p
                                class="mt-2 text-xs text-white font-medium drop-shadow px-2 py-1 text-center line-clamp-1 rounded-full bg-black/60"
                            >
                                {content?.body ?? ""}
                            </p>
                        </div>
                    {:else}
                        <div
                            class="flex items-center gap-3 px-4 py-3 bg-discord-backgroundTertiary group-hover:bg-discord-messageHover transition-colors rounded-lg"
                        >
                            <div
                                class="w-10 h-10 rounded-full bg-discord-accent flex items-center justify-center flex-shrink-0"
                            >
                                {#if videoLoading}
                                    <div
                                        class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    ></div>
                                {:else}
                                    <svg
                                        class="w-5 h-5 text-white ml-0.5"
                                        fill="currentColor"
                                        viewBox="0 0 24 24"
                                        ><path d="M8 5v14l11-7z" /></svg
                                    >
                                {/if}
                            </div>
                            <div class="min-w-0">
                                <p
                                    class="text-sm font-medium text-discord-textPrimary truncate"
                                >
                                    {content?.body ?? "Video"}
                                </p>
                                <p class="text-xs text-discord-textMuted">
                                    {videoLoading
                                        ? "Loading…"
                                        : "Click to play"}
                                </p>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        {:else if msgtype === "m.audio"}
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
                            viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
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
                        {content?.body ?? "Audio"}
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
        {:else if msgtype === "m.file"}
            {@const fileUrl = mxcToHttp(content?.url as string)}
            {@const fileSize = (content?.info as any)?.size}
            {@const fileName = body()}
            {@const isSwf = fileName.toLowerCase().endsWith(".swf")}
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
                class="message-body text-sm text-discord-textPrimary leading-relaxed break-words"
                class:emoji-only={emojiOnly}
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
            {#each linkedUrls as url (url)}
                <LinkPreview {url} />
            {/each}
        {/if}

        <!-- Thread badge -->
        {#if isThreadReply}
            <button
                onclick={() => onOpenThread?.(threadRootId)}
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
                Thread
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
                {formatTime(timestamp, true)}
            </span>
        {/if}
    </div>

    <!-- Hover action bar: always visible when emoji picker is open, otherwise on group-hover -->
    <div
        class="{showEmojiPicker || confirmingDelete || mobileSelected
            ? 'flex'
            : 'hidden group-hover:flex'} absolute right-4 top-0 -translate-y-1/2 items-center gap-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg px-1 py-0.5 shadow-md z-20"
    >
        {#if isOwnMessage && eventType === "m.room.message" && msgtype === "m.text"}
            <button
                onclick={startEdit}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title="Edit message"
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
                <button
                    bind:this={deleteYesEl}
                    onclick={() => resolveDelete(true)}
                    onkeydown={onDeleteKeydown}
                    class="px-2 py-1 rounded text-xs font-semibold text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors focus:outline-none focus:ring-2 focus:ring-discord-danger"
                    >Yes</button
                >
                <button
                    bind:this={deleteNoEl}
                    onclick={() => resolveDelete(false)}
                    onkeydown={onDeleteKeydown}
                    class="px-2 py-1 rounded text-xs font-semibold text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors focus:outline-none focus:ring-2 focus:ring-discord-accent"
                    >No</button
                >
            {:else}
                <button
                    onclick={() => (confirmingDelete = true)}
                    class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
                    title="Delete message"
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
                onclick={() =>
                    isPinned
                        ? unpinMessage(room, eventId)
                        : pinMessage(room, eventId)}
                class="p-1.5 rounded hover:bg-discord-messageHover transition-colors {isPinned
                    ? 'text-discord-accent'
                    : 'text-discord-textMuted hover:text-discord-textPrimary'}"
                title={isPinned ? "Unpin message" : "Pin message"}
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
            onclick={() => onReply(event)}
            class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            title="Reply"
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"
                />
            </svg>
        </button>
        {#if onOpenThread}
            <button
                onclick={() => onOpenThread(threadRootId)}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title={isThreadReply ? "Open thread" : "Reply in thread"}
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 14H6v-2h2v2zm0-3H6V9h2v2zm0-3H6V6h2v2zm7 6h-5v-2h5v2zm3-3h-8V9h8v2zm0-3h-8V6h8v2z"
                    />
                </svg>
            </button>
        {/if}
    </div>
</div>

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
    }
    :global(.message-body table) {
        display: block;
        overflow-x: auto;
        max-width: 100%;
    }
</style>
