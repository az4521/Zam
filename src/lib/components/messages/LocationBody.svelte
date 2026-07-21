<script lang="ts">
    import { parseGeoUri, formatCoords, mapLinkFor } from "$lib/utils/location";

    interface Props {
        content: Record<string, unknown>;
    }
    let { content }: Props = $props();

    const loc = $derived(
        (content["org.matrix.msc3488.location"] ?? null) as {
            uri?: string;
            description?: string;
        } | null,
    );
    const geoUri = $derived(
        loc?.uri ??
            (typeof content.geo_uri === "string" ? content.geo_uri : ""),
    );
    const coords = $derived(geoUri ? parseGeoUri(geoUri) : null);
    const description = $derived(
        (typeof loc?.description === "string" && loc.description) ||
            (typeof content.body === "string" ? content.body : ""),
    );
</script>

{#if coords}
    <div
        class="mt-1 max-w-sm rounded-lg border border-discord-divider bg-discord-backgroundSecondary px-3 py-2.5"
    >
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
                <a
                    href={mapLinkFor(coords.lat, coords.lon)}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs text-discord-accent hover:underline"
                    >Open in OpenStreetMap ↗</a
                >
            </div>
        </div>
    </div>
{:else if typeof content.body === "string"}
    <p class="text-sm text-discord-textPrimary break-words">{content.body}</p>
{/if}
