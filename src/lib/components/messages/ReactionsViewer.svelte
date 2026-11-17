<script lang="ts">
    // Who reacted to a message, by reaction: a tab per reaction, and for the
    // selected one each reactor with when they reacted (and a remove button on
    // your own). A centred dialog on desktop, a bottom sheet on mobile. The
    // caller claims the "reactions-viewer" modal slot; Escape/back dismiss
    // through it.
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { X } from "lucide-svelte";
    import {
        getReactions,
        getReactionDetails,
        getCustomEmojis,
        removeReaction,
        mxcToHttp,
        getMemberName,
        getMemberAvatar,
    } from "$lib/matrix/client";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { messagesState } from "$lib/stores/messages.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { renderEmoji, isEmojiOnly } from "$lib/utils/twemoji";
    import { reactionDisplayName } from "$lib/utils/reactionLabel";
    import { initialReactionKey } from "$lib/utils/reactionDetails";
    import { compactDateTime, fullTimestamp } from "$lib/utils/timeFormat";

    interface Props {
        room: Room;
        eventId: string;
        onClose: () => void;
    }

    let { room, eventId, onClose }: Props = $props();

    const groups = $derived.by(() => {
        void messagesState.reactionTick;
        return getReactionDetails(room, eventId);
    });

    // Tabs follow the live reactions, so a reaction removed (by anyone) while
    // this is open drops its tab and the selection falls back.
    let chosenKey = $state<string | null>(null);
    const selected = $derived(
        groups.find((g) => g.key === chosenKey) ??
            groups.find(
                (g) => g.key === initialReactionKey(groups, auth.userId),
            ),
    );

    const shortcodes = $derived.by(() => {
        void messagesState.reactionTick;
        return new Map(
            getReactions(room, eventId).map((g) => [g.key, g.shortcode]),
        );
    });
    const customEmojis = $derived.by(() => {
        void roomsState.roomsTick;
        if (!groups.some((g) => g.key.startsWith("mxc://"))) return [];
        return getCustomEmojis(room);
    });
    function labelFor(key: string): string {
        return reactionDisplayName(
            key,
            shortcodes.get(key) ?? null,
            customEmojis,
            t("common.emoji"),
        );
    }

    const reactors = $derived.by(() => {
        void roomsState.roomsTick; // names and avatars fill in as members load
        return (selected?.reactors ?? []).map((r) => ({
            ...r,
            name: getMemberName(room, r.userId),
            avatarUrl: getMemberAvatar(room, r.userId),
        }));
    });

    let removing = $state<Set<string>>(new Set());
    async function remove(reactionEventId: string) {
        removing = new Set(removing).add(reactionEventId);
        try {
            await removeReaction(room.roomId, reactionEventId);
        } catch (err) {
            console.error("Failed to remove reaction:", err);
            showErrorToast(t("reactionsViewer.couldNotRemove"));
        } finally {
            const next = new Set(removing);
            next.delete(reactionEventId);
            removing = next;
        }
    }

    const sheet = $derived(interfaceState.isMobile);
</script>

{#snippet keyView(key: string, size: "tab" | "hero")}
    {@const imgSrc = key.startsWith("mxc://") ? mxcToHttp(key) : null}
    {#if imgSrc}
        <img
            src={imgSrc}
            alt=""
            class="{size === 'hero' ? 'w-16 h-16' : 'w-6 h-6'} object-contain"
        />
    {:else if key.startsWith(":") && key.endsWith(":")}
        <span
            class="font-mono {size === 'hero'
                ? 'text-2xl font-semibold break-all text-center'
                : 'text-xs truncate max-w-16'}">{key}</span
        >
    {:else if isEmojiOnly(key)}
        <span
            class="viewer-twemoji {size === 'hero'
                ? 'viewer-twemoji--hero'
                : ''}">{@html renderEmoji(key, "viewer-twemoji-img")}</span
        >
    {:else}
        <!-- Arbitrary reaction key: escaped text, never raw HTML -->
        <span
            class={size === "hero"
                ? "text-2xl font-semibold break-words text-center"
                : "text-sm truncate max-w-16"}>{key}</span
        >
    {/if}
{/snippet}

{#snippet tabs(vertical: boolean)}
    <div
        role="tablist"
        aria-label={t("reactionsViewer.title")}
        class="flex gap-1 {vertical
            ? 'flex-col w-44 flex-shrink-0 overflow-y-auto p-2 bg-zam-backgroundTertiary border-e border-zam-divider'
            : 'flex-row overflow-x-auto px-2 pb-2 border-b border-zam-divider overscroll-contain'}"
    >
        {#each groups as group (group.key)}
            {@const isSel = group.key === selected?.key}
            <button
                type="button"
                role="tab"
                aria-selected={isSel}
                title={labelFor(group.key)}
                onclick={() => (chosenKey = group.key)}
                class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg flex-shrink-0 text-sm {vertical
                    ? 'w-full'
                    : ''} {isSel
                    ? 'bg-zam-messageHover text-zam-textPrimary'
                    : 'text-zam-textSecondary hover:bg-zam-messageHover'}"
            >
                {@render keyView(group.key, "tab")}
                <span class="font-semibold tabular-nums">{group.count}</span>
            </button>
        {/each}
    </div>
{/snippet}

{#snippet list()}
    {#if selected}
        <div class="flex flex-col items-center gap-1 px-4 pt-4 pb-2">
            <div class="h-16 flex items-center justify-center">
                {@render keyView(selected.key, "hero")}
            </div>
            <div class="text-sm font-medium text-zam-textPrimary text-center">
                {labelFor(selected.key)}
            </div>
            <div class="text-xs text-zam-textMuted">
                {t("reactionsViewer.count", { count: selected.count })}
            </div>
        </div>
        <ul class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-2">
            {#each reactors as r (r.userId)}
                <li
                    class="flex items-center gap-3 px-2 py-1.5 border-b border-zam-divider last:border-b-0"
                >
                    <Avatar
                        src={r.avatarUrl}
                        name={r.name}
                        id={r.userId}
                        size={32}
                    />
                    <div class="min-w-0 flex-1 leading-tight">
                        <div class="text-sm text-zam-textPrimary truncate">
                            {r.name}
                        </div>
                        <div class="text-xs text-zam-textMuted truncate">
                            {r.userId}
                        </div>
                    </div>
                    <span
                        class="text-xs text-zam-textMuted whitespace-nowrap"
                        title={r.ts ? fullTimestamp(r.ts) : undefined}
                    >
                        {#if r.pending}
                            {t("reactionsViewer.sending")}
                        {:else if r.ts}
                            {compactDateTime(r.ts)}
                        {/if}
                    </span>
                    {#if r.userId === auth.userId && r.eventId && !r.pending}
                        {@const id = r.eventId}
                        <button
                            type="button"
                            disabled={removing.has(id)}
                            aria-label={t("reactionsViewer.removeYours")}
                            title={t("reactionsViewer.removeYours")}
                            onclick={() => remove(id)}
                            class="flex-shrink-0 w-8 h-8 md:w-6 md:h-6 inline-flex items-center justify-center rounded-md bg-zam-backgroundTertiary text-zam-textMuted hover:bg-zam-danger hover:text-white disabled:opacity-50"
                        >
                            <X size={14} />
                        </button>
                    {/if}
                </li>
            {/each}
        </ul>
    {:else}
        <p class="m-auto p-6 text-sm text-zam-textMuted text-center">
            {t("reactionsViewer.empty")}
        </p>
    {/if}
{/snippet}

<Portal>
    {#if sheet}
        <BottomSheet {onClose}>
            <div class="flex flex-col h-[min(60vh,28rem)]">
                <h2 class="sr-only">{t("reactionsViewer.title")}</h2>
                {#if groups.length > 0}
                    {@render tabs(false)}
                {/if}
                {@render list()}
            </div>
        </BottomSheet>
    {:else}
        <ModalDialog
            {onClose}
            label={t("reactionsViewer.title")}
            layerClass="z-[90] flex items-center justify-center p-4"
            panelClass="relative flex w-full max-w-2xl h-[min(520px,85dvh)] overflow-hidden rounded-xl border border-zam-divider bg-zam-backgroundSecondary shadow-2xl"
        >
            {#if groups.length > 0}
                {@render tabs(true)}
            {/if}
            <div class="relative flex flex-1 min-w-0 flex-col">
                <button
                    type="button"
                    onclick={onClose}
                    aria-label={t("common.close")}
                    class="absolute top-2 end-2 z-10 w-7 h-7 inline-flex items-center justify-center rounded-md bg-zam-backgroundTertiary text-zam-textMuted hover:text-zam-textPrimary"
                >
                    <X size={14} />
                </button>
                {@render list()}
            </div>
        </ModalDialog>
    {/if}
</Portal>

<style>
    :global(.viewer-twemoji-img) {
        width: 1.5rem;
        height: 1.5rem;
        display: inline-block;
        object-fit: contain;
    }
    .viewer-twemoji--hero :global(.viewer-twemoji-img) {
        width: 4rem;
        height: 4rem;
    }
</style>
