<script lang="ts">
    interface Props {
        src: string;
        alt?: string;
        onClose: () => void;
        /** When set, a favourite (star) button is shown that toggles this gif
         *  in the favourite gif picker. Pass only for gif-like media. */
        favourite?: { url: string; previewUrl: string };
    }

    import {
        interfaceState,
        openModal,
        clearModal,
    } from "$lib/stores/interface.svelte";
    import {
        isFavouriteGif,
        addFavouriteGif,
        removeFavouriteGif,
    } from "$lib/stores/favourites.svelte";
    import { fetchAttachmentBlob } from "$lib/matrix/client";
    import { onMount } from "svelte";

    let { src, alt = "", onClose, favourite }: Props = $props();

    // Reactively tracks favourite state (reads favouritesState.gifs $state).
    const favourited = $derived(
        favourite ? isFavouriteGif(favourite.url) : false,
    );

    function toggleFavourite(e: MouseEvent) {
        e.stopPropagation();
        if (!favourite) return;
        if (isFavouriteGif(favourite.url)) {
            removeFavouriteGif(favourite.url);
        } else {
            addFavouriteGif({
                url: favourite.url,
                previewUrl: favourite.previewUrl,
            });
        }
    }

    function filenameFromSrc(): string {
        try {
            const u = new URL(src, location.href);
            const last = u.pathname.split("/").filter(Boolean).pop();
            if (last && /\.[a-z0-9]+$/i.test(last)) return last;
        } catch {
            /* ignore */
        }
        return "image";
    }

    async function download(e: MouseEvent) {
        e.stopPropagation();
        const name = filenameFromSrc();
        let objectUrl: string | null = null;
        try {
            // Homeserver media uses authenticated media endpoints — the token
            // must be attached, and fetchAttachmentBlob refuses to send it
            // anywhere but the homeserver (throws on foreign URLs).
            objectUrl = await fetchAttachmentBlob(src);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch {
            // Non-homeserver media (e.g. an embedded tweet photo) or a transient
            // failure — open it directly, with no auth attached.
            const a = document.createElement("a");
            a.href = src;
            a.download = name;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.click();
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
    }

    // ── Zoom & pan ──────────────────────────────────────────────────────────
    let imgEl = $state<HTMLImageElement | null>(null);
    let scale = $state(1);
    let tx = $state(0);
    let ty = $state(0);

    // Active pointers for pinch/pan.
    const pointers = new Map<number, { x: number; y: number }>();
    let lastDist = 0; // last two-finger distance
    let panStartX = 0;
    let panStartY = 0;
    let panBaseTx = 0;
    let panBaseTy = 0;
    let downX = 0;
    let downY = 0;
    let moved = false; // distinguishes a tap from a drag/pinch

    const MIN_SCALE = 1;
    const MAX_SCALE = 8;

    /** Clamp the pan so the image can't be dragged past its visible edges. */
    function clampPan() {
        if (!imgEl) return;
        const w = imgEl.offsetWidth * scale;
        const h = imgEl.offsetHeight * scale;
        const maxX = Math.max(0, (w - window.innerWidth) / 2);
        const maxY = Math.max(0, (h - window.innerHeight) / 2);
        tx = Math.min(maxX, Math.max(-maxX, tx));
        ty = Math.min(maxY, Math.max(-maxY, ty));
    }

    /** Scale by `factor` keeping the point (px,py) in screen space fixed. */
    function zoomAt(factor: number, px: number, py: number) {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
        const f = next / scale;
        const mx = px - window.innerWidth / 2;
        const my = py - window.innerHeight / 2;
        tx = mx - f * (mx - tx);
        ty = my - f * (my - ty);
        scale = next;
        clampPan();
    }

    function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }
    function midpoint(
        a: { x: number; y: number },
        b: { x: number; y: number },
    ) {
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function onPointerDown(e: PointerEvent) {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        downX = e.clientX;
        downY = e.clientY;
        moved = false;
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            lastDist = dist(a, b);
        } else if (pointers.size === 1) {
            panStartX = e.clientX;
            panStartY = e.clientY;
            panBaseTx = tx;
            panBaseTy = ty;
        }
    }

    function onPointerMove(e: PointerEvent) {
        if (!pointers.has(e.pointerId)) return;
        e.preventDefault();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size >= 2) {
            const [a, b] = [...pointers.values()];
            const d = dist(a, b);
            if (lastDist > 0) {
                const m = midpoint(a, b);
                zoomAt(d / lastDist, m.x, m.y);
            }
            lastDist = d;
            moved = true;
            return;
        }

        // Single pointer: pan only when zoomed in.
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) moved = true;
        if (scale > 1) {
            tx = panBaseTx + (e.clientX - panStartX);
            ty = panBaseTy + (e.clientY - panStartY);
            clampPan();
        }
    }

    function onPointerUp(e: PointerEvent) {
        const wasPinch = pointers.size >= 2;
        pointers.delete(e.pointerId);
        if (pointers.size === 1) {
            // Lifted one finger of a pinch — resume panning from the other.
            const [p] = [...pointers.values()];
            panStartX = p.x;
            panStartY = p.y;
            panBaseTx = tx;
            panBaseTy = ty;
        }
        if (pointers.size > 0) return;
        lastDist = 0;

        // A clean tap (no drag, no pinch) toggles 1x ↔ 2x at the tap point.
        if (!moved && !wasPinch) {
            if (scale > 1) {
                scale = 1;
                tx = 0;
                ty = 0;
            } else {
                zoomAt(2, e.clientX, e.clientY);
            }
        }
    }

    onMount(() => {
        interfaceState.lightboxOpen = true;
        // Register in the shared modal slot so Escape/back close it centrally.
        openModal("lightbox", onClose);
        return () => {
            interfaceState.lightboxOpen = false;
            clearModal("lightbox");
        };
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 overflow-hidden"
    style="touch-action: none;"
    onclick={(e) => {
        e.stopPropagation();
        onClose();
    }}
>
    <!-- Top-right action buttons -->
    <div class="absolute top-3 right-3 z-10 flex items-center gap-2">
        {#if favourite}
            <button
                onclick={toggleFavourite}
                title={favourited
                    ? "Remove from favourites"
                    : "Add to favourites"}
                aria-label={favourited
                    ? "Remove from favourites"
                    : "Add to favourites"}
                class="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
                {#if favourited}
                    <svg
                        class="w-5 h-5 text-discord-warning"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                    </svg>
                {:else}
                    <svg
                        class="w-5 h-5"
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
        <button
            onclick={download}
            title="Download"
            aria-label="Download"
            class="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
            <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                />
            </svg>
        </button>
    </div>

    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <img
        bind:this={imgEl}
        {src}
        {alt}
        onclick={(e) => e.stopPropagation()}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        ondragstart={(e) => e.preventDefault()}
        style="max-width: calc(100dvw - {interfaceState.isMobile
            ? '6em'
            : '2em'}); max-height: calc(100dvh - {interfaceState.isMobile
            ? '6em'
            : '2em'}); object-fit: contain; border-radius: 0.5em; touch-action: none; transform: translate({tx}px, {ty}px) scale({scale}); transition: {pointers.size ===
        0
            ? 'transform 0.2s ease'
            : 'none'}; cursor: {scale > 1 ? 'grab' : 'zoom-in'};"
    />
</div>
