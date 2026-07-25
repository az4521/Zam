<script lang="ts">
    import {
        parseGeoUri,
        formatCoords,
        mapLinkFor,
        googleMapsLinkFor,
    } from "$lib/utils/location";
    import LocationMap, {
        type MapMarkerInput,
    } from "$lib/components/ui/LocationMap.svelte";

    interface Props {
        content: Record<string, unknown>;
        senderName?: string;
        senderAvatarUrl?: string | null;
        isSelf?: boolean;
    }
    let { content, senderName, senderAvatarUrl, isSelf }: Props = $props();

    const loc = $derived(
        (content["org.matrix.msc3488.location"] ?? null) as {
            uri?: string;
            description?: string;
        } | null,
    );
    const geoUri = $derived(
        typeof loc?.uri === "string"
            ? loc.uri
            : typeof content.geo_uri === "string"
              ? content.geo_uri
              : "",
    );
    const coords = $derived(geoUri ? parseGeoUri(geoUri) : null);
    // Only a real MSC3488 description goes on the card — the interop `body`
    // fallback ("Location (geo:…)") would just echo the coords line below.
    const description = $derived(
        typeof loc?.description === "string" ? loc.description : "",
    );

    let el: HTMLDivElement | undefined = $state();
    let mapVisible = $state(false);

    // Render the map only once the card is (nearly) on screen, then keep it —
    // bounds simultaneous Leaflet instances to roughly what's visible and defers
    // the leaflet JS chunk until a location card is actually seen.
    $effect(() => {
        const node = el;
        if (!node || mapVisible) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    mapVisible = true;
                    observer.disconnect();
                }
            },
            { rootMargin: "200px" },
        );
        observer.observe(node);
        return () => observer.disconnect();
    });
</script>

{#if coords}
    <div
        bind:this={el}
        class="mt-1 max-w-sm rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2.5"
    >
        {#if mapVisible}
            {@const markers = [
                {
                    id: "loc",
                    lat: coords.lat,
                    lon: coords.lon,
                    label: senderName || description || "Location",
                    avatarUrl: senderAvatarUrl,
                    isSelf,
                },
            ] as MapMarkerInput[]}
            <div class="mb-2 h-40 w-full overflow-hidden rounded-lg">
                <LocationMap {markers} interactive={false} follow={false} />
            </div>
        {/if}
        <div class="flex items-start gap-2">
            <svg
                class="w-5 h-5 mt-0.5 text-discord-accent flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
                />
            </svg>
            <div class="min-w-0">
                {#if description}
                    <p class="text-sm text-discord-textPrimary break-words">
                        {description}
                    </p>
                {/if}
                <p class="text-xs text-discord-textMuted">
                    {formatCoords(coords.lat, coords.lon)}
                </p>
                <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <a
                        href={mapLinkFor(coords.lat, coords.lon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-discord-accent hover:underline"
                        >OpenStreetMap ↗</a
                    >
                    <a
                        href={googleMapsLinkFor(coords.lat, coords.lon)}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-discord-accent hover:underline"
                        >Google Maps ↗</a
                    >
                </div>
            </div>
        </div>
    </div>
{:else if typeof content.body === "string"}
    <p class="text-sm text-discord-textPrimary break-words">{content.body}</p>
{/if}
