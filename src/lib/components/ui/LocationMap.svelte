<script lang="ts">
    import { onMount } from "svelte";
    import "leaflet/dist/leaflet.css";
    import type * as Leaflet from "leaflet";

    export interface MapMarkerInput {
        id: string;
        lat: number;
        lon: number;
        /** Display name — rendered via textContent, never as HTML. */
        label: string;
        avatarUrl?: string | null;
        isSelf?: boolean;
    }

    interface Props {
        markers: MapMarkerInput[];
        /** Pan/zoom to keep markers in view until the user drags. */
        follow?: boolean;
        /** When false, disable all pan/zoom interaction (inline card use). */
        interactive?: boolean;
    }
    let { markers, follow = true, interactive = true }: Props = $props();

    let el: HTMLDivElement | undefined = $state();
    let L: typeof Leaflet | null = $state.raw(null);
    let map: Leaflet.Map | null = $state.raw(null);
    const layerById = new Map<string, Leaflet.Marker>();
    let userMoved = false;
    let didInitialFit = false;

    onMount(() => {
        let cancelled = false;
        (async () => {
            // Lazy: leaflet only loads when a map is actually shown.
            const mod = await import("leaflet");
            if (cancelled || !el) return;
            const leaflet = (mod.default ?? mod) as typeof Leaflet;
            const m = leaflet.map(el, {
                // A sane default before the first fix arrives.
                center: [0, 0],
                zoom: 2,
                attributionControl: true, // always — OSM tile ToS requires visible attribution
                zoomControl: interactive, // was hardcoded true
                dragging: interactive,
                scrollWheelZoom: interactive,
                doubleClickZoom: interactive,
                boxZoom: interactive,
                touchZoom: interactive,
                keyboard: interactive,
            });
            leaflet
                .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                    attribution:
                        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
                })
                .addTo(m);
            m.on("dragstart", () => (userMoved = true));
            L = leaflet;
            map = m;
        })();
        return () => {
            cancelled = true;
            map?.remove();
            map = null;
            layerById.clear();
        };
    });

    /** Marker DOM built programmatically — labels/URLs are user-controlled,
     *  so nothing is ever interpolated into an HTML string. */
    function buildMarkerElement(input: MapMarkerInput): HTMLElement {
        const wrap = document.createElement("div");
        wrap.className = "ll-marker" + (input.isSelf ? " ll-marker-self" : "");
        wrap.title = input.label;
        if (input.avatarUrl) {
            const img = document.createElement("img");
            img.src = input.avatarUrl;
            img.alt = input.label;
            img.draggable = false;
            wrap.appendChild(img);
        } else {
            const span = document.createElement("span");
            span.textContent = (input.label || "?")
                .trim()
                .charAt(0)
                .toUpperCase();
            wrap.appendChild(span);
        }
        return wrap;
    }

    function markerKey(input: MapMarkerInput): string {
        return `${input.label}|${input.avatarUrl ?? ""}|${input.isSelf ? 1 : 0}`;
    }
    const iconKeyById = new Map<string, string>();

    // Sync the declarative markers prop into the imperative leaflet map.
    $effect(() => {
        const list = markers;
        const leaflet = L;
        const m = map;
        if (!leaflet || !m) return;

        const seen = new Set<string>();
        for (const input of list) {
            seen.add(input.id);
            const existing = layerById.get(input.id);
            if (existing) {
                existing.setLatLng([input.lat, input.lon]);
                if (iconKeyById.get(input.id) !== markerKey(input)) {
                    existing.setIcon(
                        leaflet.divIcon({
                            className: "ll-marker-anchor",
                            html: buildMarkerElement(input),
                            iconSize: [44, 44],
                            iconAnchor: [22, 22],
                        }),
                    );
                    iconKeyById.set(input.id, markerKey(input));
                }
            } else {
                const marker = leaflet.marker([input.lat, input.lon], {
                    icon: leaflet.divIcon({
                        className: "ll-marker-anchor",
                        html: buildMarkerElement(input),
                        iconSize: [44, 44],
                        iconAnchor: [22, 22],
                    }),
                    keyboard: false,
                });
                marker.addTo(m);
                layerById.set(input.id, marker);
                iconKeyById.set(input.id, markerKey(input));
            }
        }
        for (const [id, layer] of layerById) {
            if (!seen.has(id)) {
                layer.remove();
                layerById.delete(id);
                iconKeyById.delete(id);
            }
        }

        if (list.length > 0 && (!didInitialFit || (follow && !userMoved))) {
            fitToMarkers(list, !didInitialFit);
            didInitialFit = true;
        }
    });

    function fitToMarkers(list: MapMarkerInput[], instant: boolean) {
        const leaflet = L;
        const m = map;
        if (!leaflet || !m || list.length === 0) return;
        if (list.length === 1) {
            m.setView(
                [list[0].lat, list[0].lon],
                Math.max(m.getZoom(), 16),
                instant ? { animate: false } : undefined,
            );
        } else {
            m.fitBounds(
                leaflet.latLngBounds(
                    list.map((p) => [p.lat, p.lon] as [number, number]),
                ),
                { padding: [48, 48], animate: !instant },
            );
        }
    }

    /** Re-fit to all markers and resume following (the recenter button). */
    export function recenter() {
        userMoved = false;
        fitToMarkers(markers, false);
    }
</script>

<div bind:this={el} class="ll-map h-full w-full"></div>

<style>
    .ll-map {
        background: #1a1d24;
        /* Leaflet's internal panes and controls use z-index 200–800. Without a
           stacking context of its own, those leak into the page and paint the
           map on top of modals, the mobile drawer, and other overlays. Isolate
           them so the map stays within its own place in the timeline. */
        position: relative;
        isolation: isolate;
        z-index: 0;
    }
    /* Dark map: invert the light OSM raster. Standard trick — labels invert
       too, which reads fine on the muted result. */
    .ll-map :global(.leaflet-tile) {
        filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.9)
            saturate(0.55);
    }
    .ll-map :global(.leaflet-control-attribution) {
        background: rgba(0, 0, 0, 0.6);
        color: #949ba4;
    }
    .ll-map :global(.leaflet-control-attribution a) {
        color: #00a8fc;
    }
    .ll-map :global(.ll-marker-anchor) {
        background: none;
        border: none;
    }
    .ll-map :global(.ll-marker) {
        width: 44px;
        height: 44px;
        border-radius: 9999px;
        border: 3px solid #23a559;
        background: #313338;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    }
    .ll-map :global(.ll-marker-self) {
        border-color: #00a8fc;
    }
    .ll-map :global(.ll-marker img) {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .ll-map :global(.ll-marker span) {
        color: #dbdee1;
        font-weight: 600;
        font-size: 18px;
    }
</style>
