<script lang="ts">
    import { t } from "$lib/i18n";
    import { Eye } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { watcherSlots } from "$lib/utils/shareWatchers";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        getMemberAvatar,
        getMemberName,
        getRoom,
    } from "$lib/matrix/client";

    interface Props {
        /** User ids of whoever is watching the share, sorted. */
        viewers: string[];
        /** Avatars drawn before collapsing the rest into "+N". */
        max?: number;
        /** Avatar diameter in px. */
        size?: number;
    }
    let { viewers, max = 3, size = 16 }: Props = $props();

    const slots = $derived(watcherSlots(viewers, max));
    const room = $derived.by(() => {
        void roomsState.roomsTick;
        return voiceCallState.roomId ? getRoom(voiceCallState.roomId) : null;
    });
    function nameOf(userId: string): string {
        return room ? getMemberName(room, userId) : userId;
    }
    function avatarOf(userId: string): string | null {
        void roomsState.roomsTick;
        return room ? getMemberAvatar(room, userId) : null;
    }

    // The full list lives in the tooltip: a stack this small can't show it,
    // and a hover card would be clipped by the tile it sits on.
    const fullList = $derived(
        viewers.length === 0
            ? t("videoTile.noWatchers")
            : [t("videoTile.watchers"), ...viewers.map(nameOf)].join("\n"),
    );
    const countLabel = $derived(
        t("videoTile.watchingCount", { count: viewers.length }),
    );
</script>

<!-- min-w-0 and the flex row let a parent that is narrower than the stack
     clip it instead of pushing its neighbours off. -->
<span
    role="img"
    class="inline-flex items-center gap-1 min-w-0 max-w-full px-1 py-0.5 rounded bg-black/60 text-white text-xs"
    aria-label={countLabel}
    title={fullList}
    data-testid="watcher-stack"
>
    {#if viewers.length === 0}
        <Eye size={12} />
        <span class="tabular-nums">0</span>
    {:else}
        <Eye size={12} class="shrink-0" />
        <span class="inline-flex items-center -space-x-1.5 shrink-0">
            {#each slots.shown as userId (userId)}
                <span class="inline-flex rounded-full ring-1 ring-black/60">
                    <Avatar
                        src={avatarOf(userId)}
                        name={nameOf(userId)}
                        id={userId}
                        {size}
                    />
                </span>
            {/each}
        </span>
        {#if slots.extra > 0}
            <span class="tabular-nums shrink-0">+{slots.extra}</span>
        {/if}
    {/if}
</span>
