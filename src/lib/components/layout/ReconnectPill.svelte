<script lang="ts">
    import { syncStateLabel } from "$lib/utils/syncStatus";

    interface Props {
        /** Raw matrix-js-sdk sync state (auth.syncState). */
        syncState: string | null | undefined;
    }
    let { syncState }: Props = $props();

    const status = $derived(syncStateLabel(syncState));
    const disconnected = $derived(status.tone !== "ok");
    const offline = $derived(syncState === "STOPPED");

    // Debounce: only surface the pill once a disconnect has PERSISTED, so a
    // brief transient RECONNECTING/CATCHUP blip (normal on any sync) never
    // flashes it. Cleared the instant we reconnect. The pill is
    // pointer-events-none and never covers the columns, so it can't imply the
    // app is locked - offline stays fully usable.
    const APPEAR_DELAY_MS = 2000;
    let show = $state(false);
    $effect(() => {
        if (!disconnected) {
            show = false;
            return;
        }
        const timer = setTimeout(() => (show = true), APPEAR_DELAY_MS);
        return () => clearTimeout(timer);
    });
</script>

{#if show}
    <!-- Top centre, just under the room header (the same 3.5rem + safe-area
         clearance CallPipOverlay uses). A bottom corner sat on the profile
         footer on desktop and on the composer on mobile. -->
    <div
        role="status"
        aria-live="polite"
        class="pointer-events-none fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-discord-backgroundTertiary/95 px-3 py-1.5 text-xs font-medium text-discord-textSecondary shadow-lg ring-1 ring-black/20"
        style="top: calc(3.5rem + env(safe-area-inset-top, 0px));"
    >
        <span
            class="h-2 w-2 flex-shrink-0 rounded-full {offline
                ? 'bg-discord-danger'
                : 'bg-discord-warning animate-pulse'}"
        ></span>
        {status.label}
    </div>
{/if}
