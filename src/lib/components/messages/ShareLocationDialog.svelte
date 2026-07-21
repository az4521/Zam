<script lang="ts">
    import {
        locationDialogState,
        closeShareLocationDialog,
    } from "$lib/stores/locationDialog.svelte";
    import { sendLocation } from "$lib/matrix/client";
    import { formatCoords } from "$lib/utils/location";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    let coords = $state<{ lat: number; lon: number } | null>(null);
    let description = $state("");
    let locating = $state(false);
    let sending = $state(false);
    let error = $state<string | null>(null);

    function locate() {
        if (!("geolocation" in navigator)) {
            error = "Location isn't available in this browser.";
            return;
        }
        locating = true;
        error = null;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                coords = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                };
                locating = false;
            },
            (err) => {
                error =
                    err.code === err.PERMISSION_DENIED
                        ? "Location permission was denied."
                        : "Couldn't get your location.";
                locating = false;
            },
            { enableHighAccuracy: true, timeout: 10000 },
        );
    }

    async function share() {
        const roomId = locationDialogState.roomId;
        if (!roomId || !coords || sending) return;
        sending = true;
        try {
            await sendLocation(roomId, {
                ...coords,
                description: description.trim() || undefined,
            });
            closeShareLocationDialog();
        } catch (err) {
            showErrorToast(
                err instanceof Error ? err.message : "Failed to share location",
            );
            sending = false;
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") closeShareLocationDialog();
    }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    onclick={closeShareLocationDialog}
>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="bg-discord-backgroundSecondary rounded-lg shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto flex flex-col gap-4 p-6"
        onclick={(e) => e.stopPropagation()}
    >
        <h2 class="text-lg font-bold text-discord-textPrimary">
            Share location
        </h2>

        <!-- Locate -->
        <div class="flex flex-col gap-2">
            <button
                type="button"
                onclick={locate}
                disabled={locating}
                class="self-start flex items-center gap-2 rounded bg-discord-backgroundTertiary px-3 py-2 text-sm font-medium text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <svg
                    class="w-4 h-4 text-discord-accent flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                    />
                </svg>
                {locating ? "Locating…" : "Use my current location"}
            </button>
            {#if coords}
                <p class="text-xs text-discord-textMuted">
                    {formatCoords(coords.lat, coords.lon)}
                </p>
            {/if}
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1.5">
            <label
                for="location-description"
                class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted"
            >
                Description (optional)
            </label>
            <input
                id="location-description"
                type="text"
                bind:value={description}
                placeholder="e.g. Home, the café on 5th…"
                maxlength="340"
                class="w-full rounded bg-discord-backgroundTertiary px-3 py-2 text-sm text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-2 focus:ring-discord-accent"
            />
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 pt-1">
            {#if error}
                <span class="mr-auto text-xs text-discord-danger">{error}</span>
            {/if}
            <button
                type="button"
                onclick={closeShareLocationDialog}
                class="px-4 py-2 rounded text-sm font-medium text-discord-textSecondary hover:text-discord-textPrimary hover:underline transition-colors"
            >
                Cancel
            </button>
            <button
                type="button"
                onclick={share}
                disabled={!coords || sending}
                class="px-4 py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {sending ? "Sharing…" : "Share"}
            </button>
        </div>
    </div>
</div>
