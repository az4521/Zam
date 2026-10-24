<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import { Lock, Send, X } from "lucide-svelte";
    import {
        createDirectMessage,
        fetchUserProfile,
        getRoom,
        hasExistingDirectMessage,
        retryRoomFollowUp,
    } from "$lib/matrix/client";
    import { sendEventContent } from "$lib/matrix/pluginHost";
    import { isRoomEncrypted } from "$lib/matrix/crypto";
    import {
        roomsState,
        setActiveRoom,
        closeDraftDm,
    } from "$lib/stores/rooms.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import {
        applyContentTransforms,
        applyTextTransforms,
    } from "$lib/plugins/outgoingTransforms";
    import { buildDraftDmContent } from "$lib/utils/draftDmMessage";
    import type { RoomFollowUp } from "$lib/utils/roomCreationOutcome";
    import {
        shouldWarnPlaintextDmReuse,
        PLAINTEXT_DM_REUSE_WARNING,
    } from "$lib/utils/roomEncryption";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";
    import Avatar from "$lib/components/ui/Avatar.svelte";

    interface Props {
        userId: string;
        encrypt: boolean;
        isMobile?: boolean;
        onMenuOpen?: () => void;
    }

    let { userId, encrypt, isMobile = false, onMenuOpen }: Props = $props();

    let text = $state("");
    let sending = $state(false);
    let error = $state("");
    let profile = $state<{
        displayName: string | null;
        avatarUrl: string | null;
    }>({ displayName: null, avatarUrl: null });
    let textareaEl = $state<HTMLTextAreaElement>();

    const name = $derived(profile.displayName || userId);

    // The pane is not remounted when the draft is retargeted to someone else,
    // so the profile, the typed text and any error all belong to one userId.
    $effect(() => {
        const target = userId;
        untrack(() => {
            profile = { displayName: null, avatarUrl: null };
            text = "";
            error = "";
        });
        let stale = false;
        void fetchUserProfile(target).then((p) => {
            if (!stale) profile = p;
        });
        textareaEl?.focus();
        return () => {
            stale = true;
        };
    });

    // A DM with this person can appear while the draft is open: they messaged
    // first, or another session of this account opened one. Move onto it
    // rather than leave a draft that would create a second room.
    $effect(() => {
        void roomsState.roomsTick;
        const target = userId;
        untrack(() => {
            if (!sending && hasExistingDirectMessage(target))
                void openExisting(target);
        });
    });

    async function openExisting(target: string) {
        try {
            const { roomId } = await createDirectMessage(target, encrypt);
            if (roomsState.draftDm?.userId === target) setActiveRoom(roomId);
        } catch {
            /* the draft stays usable; sending retries the same lookup */
        }
    }

    // Same recovery the other DM entry points offer: the room is real, so only
    // the failed m.direct write is retried (TX-01).
    function surfaceFollowUp(followUp: RoomFollowUp) {
        if (followUp.status === "none" || followUp.status === "ok") return;
        const task = followUp.task;
        showErrorToast(followUp.message, {
            label: t("common.retry"),
            run: () => void retryRoomFollowUp(task).then(surfaceFollowUp),
        });
    }

    async function send() {
        if (sending) return;
        const target = userId;
        const typed = text;
        if (!buildDraftDmContent(typed, target)) return;
        sending = true;
        error = "";
        try {
            // The room, and the invite, only come into being here.
            const { roomId, followUp } = await createDirectMessage(
                target,
                encrypt,
            );
            surfaceFollowUp(followUp);
            if (
                shouldWarnPlaintextDmReuse({
                    followUpStatus: followUp.status,
                    wantEncrypted: encrypt,
                    roomEncrypted: isRoomEncrypted(getRoom(roomId)),
                })
            ) {
                showErrorToast(PLAINTEXT_DM_REUSE_WARNING);
            }
            // Plugin transforms need the room id, so they run once it exists.
            const outgoing = applyTextTransforms(
                typed,
                pluginRegistry.outgoingTextTransforms.map((e) => e.value),
                { roomId },
            );
            const base = buildDraftDmContent(outgoing, target);
            // Navigate first: the SDK's local echo lands in the timeline the
            // user is about to see, with its own retry affordance on failure.
            // Someone who moved on mid-create still gets their message sent;
            // they just are not pulled back to it.
            if (roomsState.draftDm?.userId === target) setActiveRoom(roomId);
            if (base) {
                const content = applyContentTransforms(
                    base,
                    pluginRegistry.outgoingContentTransforms.map(
                        (e) => e.value,
                    ),
                    { roomId },
                );
                sendEventContent(roomId, content).catch((err) =>
                    console.warn("[draftDm] first message failed", err),
                );
            }
        } catch (e) {
            // Nothing was created, so the text stays for another try.
            error = matrixErrorMessage(e, t("draftDm.couldNotStart"));
        } finally {
            sending = false;
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key !== "Enter" || e.isComposing) return;
        // Mobile keyboards have no Shift: Enter is a newline there and the
        // send button sends, matching the room composer.
        if (e.shiftKey || isMobile) return;
        e.preventDefault();
        void send();
    }
</script>

<div class="flex-1 flex flex-col min-w-0 overflow-hidden" data-chat-area>
    <div
        class="h-12 px-4 flex items-center gap-3 border-b border-discord-divider shadow-sm flex-shrink-0"
    >
        {#if isMobile}
            <button
                onclick={onMenuOpen}
                class="p-1.5 -ms-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                title={t("common.openRoomList")}
                aria-label={t("common.openRoomList")}
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                </svg>
            </button>
        {/if}
        <Avatar src={profile.avatarUrl} {name} id={userId} size={24} />
        <h2
            class="font-semibold text-discord-textPrimary truncate"
            title={name}
        >
            {@html renderPlainTextWithTwemoji(name)}
        </h2>
        {#if encrypt}
            <span
                class="text-discord-textMuted flex-shrink-0"
                title={t("draftDm.encrypted")}
                aria-label={t("draftDm.encrypted")}
            >
                <Lock size={16} />
            </span>
        {/if}
        <button
            onclick={closeDraftDm}
            class="ms-auto p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
            title={t("draftDm.discard")}
            aria-label={t("draftDm.discard")}
        >
            <X size={18} />
        </button>
    </div>

    <div class="flex-1 overflow-y-auto flex flex-col justify-end px-4 pb-4">
        <div class="max-w-xl">
            <Avatar src={profile.avatarUrl} {name} id={userId} size={80} />
            <h3
                class="mt-3 text-2xl font-bold text-discord-textPrimary break-words"
            >
                {@html renderPlainTextWithTwemoji(name)}
            </h3>
            {#if profile.displayName}
                <p class="text-discord-textMuted text-sm break-all">{userId}</p>
            {/if}
            <p class="mt-3 text-discord-textSecondary">
                {t("draftDm.intro", { name })}
            </p>
            <p class="mt-1 text-sm text-discord-textMuted">
                {t("draftDm.lazyNote", { name })}
            </p>
        </div>
    </div>

    <div class="px-4 pb-4 flex-shrink-0">
        {#if error}
            <p role="alert" class="mb-2 text-sm text-discord-danger">{error}</p>
        {/if}
        <div
            class="flex items-end gap-2 bg-discord-backgroundSecondary rounded-lg px-2.5 py-2.5"
        >
            <textarea
                bind:this={textareaEl}
                bind:value={text}
                onkeydown={onKeydown}
                rows="1"
                dir="auto"
                autocapitalize="sentences"
                spellcheck="true"
                disabled={sending}
                placeholder={t("draftDm.placeholder", { name })}
                aria-label={t("draftDm.placeholder", { name })}
                style="field-sizing: content;"
                class="flex-1 min-w-0 resize-none bg-transparent text-discord-textPrimary outline-none text-[16px] leading-relaxed py-[3px] max-h-48 placeholder:text-discord-textMuted disabled:opacity-60"
            ></textarea>
            <button
                onclick={() => void send()}
                disabled={sending || !text.trim()}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary disabled:opacity-40 disabled:hover:text-discord-textMuted transition-colors flex-shrink-0"
                title={sending ? t("draftDm.starting") : t("draftDm.send")}
                aria-label={sending ? t("draftDm.starting") : t("draftDm.send")}
            >
                {#if sending}
                    <div
                        aria-hidden="true"
                        class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                    ></div>
                {:else}
                    <Send size={20} />
                {/if}
            </button>
        </div>
    </div>
</div>
