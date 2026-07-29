<script lang="ts">
    interface Props {
        src: string;
        alt?: string;
        /** What `src` points at. "video" swaps the zoomable <img> for a single
         *  native player; anything else is shown as an image. */
        kind?: "image" | "video";
        /** Still shown behind a video until its data arrives. Ignored for
         *  images, which are their own poster. */
        poster?: string | null;
        /** Name to save as. Falls back to the last path segment of `src`, which
         *  is a bare media id (no extension) on Matrix download URLs. */
        filename?: string;
        onClose: () => void;
        /** When set, a favourite (star) button is shown that toggles this gif
         *  in the favourite gif picker. Pass only for gif-like media. */
        favourite?: { url: string; previewUrl: string };
        /** Gallery navigation. When supplied, a chevron and the matching arrow
         *  key step to the neighbouring item; omit at the ends of the list. */
        onPrev?: () => void;
        onNext?: () => void;
    }

    import {
        interfaceState,
        openModal,
        clearModalIfOwner,
    } from "$lib/stores/interface.svelte";
    import {
        isFavouriteGif,
        addFavouriteGif,
        removeFavouriteGif,
    } from "$lib/stores/favourites.svelte";
    import { fetchAttachmentBlob } from "$lib/matrix/client";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { onMount, untrack } from "svelte";

    let {
        src,
        alt = "",
        kind = "image",
        poster = null,
        filename,
        onClose,
        favourite,
        onPrev,
        onNext,
    }: Props = $props();

    const isVideo = $derived(kind === "video");
    const mediaNoun = $derived(isVideo ? "video" : "image");

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
        if (filename) return filename;
        try {
            const u = new URL(src, location.href);
            const last = u.pathname.split("/").filter(Boolean).pop();
            if (last && /\.[a-z0-9]+$/i.test(last)) return last;
        } catch {
            /* ignore */
        }
        return mediaNoun;
    }

    function saveBlobAs(objectUrl: string, name: string) {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = name;
        // In the document, not detached: Firefox has historically ignored
        // `download` on an anchor that was never in the DOM.
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async function download(e: MouseEvent) {
        e.stopPropagation();
        const name = filenameFromSrc();
        // A playing video has already been pulled down in full — save that copy
        // instead of fetching the whole file a second time. Ownership stays
        // with the effect below, so this path must NOT revoke it.
        if (videoBlobUrl) {
            saveBlobAs(videoBlobUrl, name);
            return;
        }
        let objectUrl: string | null = null;
        try {
            // Homeserver media uses authenticated media endpoints — the token
            // must be attached, and fetchAttachmentBlob refuses to send it
            // anywhere but the homeserver (throws on foreign URLs).
            objectUrl = await fetchAttachmentBlob(src);
            saveBlobAs(objectUrl, name);
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

    // ── Video playback ──────────────────────────────────────────────────────
    // Matrix media sits behind the authenticated download endpoint, so a plain
    // <video src={http}> 401s on a server that enforces it. Fetch the bytes
    // with the token attached and play the object URL, exactly as the timeline
    // player does.
    // Loading is "video branch, no blob yet, not failed" — no extra flag.
    let videoEl = $state<HTMLVideoElement | null>(null);
    let videoBlobUrl = $state<string | null>(null);
    let videoFailed = $state(false);

    // ⚠ Exactly ONE video element is ever live (this viewer is a singleton in
    // the modal slot) and it is only ever created after the user clicked a
    // tile. It carries no `loop`, and above all NO onpause handler that calls
    // play() — that pattern fights the browser's own load-shedding forever and
    // pegged the main thread when it lived in LinkPreview. Do not add one back.
    //
    // `src` and `kind` are read outside untrack so they are this effect's only
    // dependencies; the state writes are untracked so they cannot re-enter it
    // (effect_update_depth_exceeded). Stepping through a gallery swaps `src` on
    // this same instance, which is why teardown has to revoke here rather than
    // on unmount.
    $effect(() => {
        const target = kind === "video" ? src : null;
        if (!target) return;
        let objectUrl: string | null = null;
        let cancelled = false;
        untrack(() => {
            videoBlobUrl = null;
            videoFailed = false;
        });
        fetchAttachmentBlob(target)
            .then((url) => {
                if (cancelled) {
                    URL.revokeObjectURL(url);
                    return;
                }
                objectUrl = url;
                videoBlobUrl = url;
            })
            .catch((e) => {
                if (cancelled) return;
                console.error("Failed to load video", e);
                videoFailed = true;
            });
        return () => {
            cancelled = true;
            // Stop the element before the URL goes away: a paused, src-less
            // element cannot keep buffering, and revoking alone would leave a
            // playing video decoding what it already holds.
            if (videoEl) {
                videoEl.pause();
                videoEl.removeAttribute("src");
                videoEl.load();
            }
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            videoBlobUrl = null;
        };
    });

    // ── Zoom & pan ──────────────────────────────────────────────────────────
    let imgEl = $state<HTMLImageElement | null>(null);
    let scale = $state(1);
    let tx = $state(0);
    let ty = $state(0);

    // Gallery stepping swaps `src` on the SAME instance, so without this the
    // next image opens at the previous one's zoom, panned to coordinates
    // clamped against the previous one's dimensions. `src` is read outside
    // untrack so it is the only dependency; the writes are untracked so they
    // cannot re-enter this effect (effect_update_depth_exceeded).
    $effect(() => {
        void src;
        untrack(() => {
            scale = 1;
            tx = 0;
            ty = 0;
        });
    });

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

    // Lightbox is rendered INSIDE the message DOM subtree (MessageItem /
    // LinkPreview); `fixed` positioning does not change DOM ancestry, so a tap
    // on the backdrop or image would otherwise bubble to the message row's
    // onclick (toggling mobile selection on touch). This contains every click
    // within the viewer.
    //
    // ⚠ This MUST stay a Svelte `onclick={…}` on the root element. Do NOT
    // "clean it up" into an action that does `node.addEventListener("click",
    // …)` — that breaks the whole viewer. Svelte 5 DELEGATES `click`: the only
    // real DOM listener is one at the mount root, and Svelte replays handlers
    // down `composedPath` itself. A directly-attached listener that calls
    // stopPropagation runs during real bubbling and stops the event before it
    // ever reaches that root listener, so NONE of the delegated handlers inside
    // the viewer (backdrop close, download, favourite, prev/next) ever fire —
    // and the full-screen backdrop then hit-tests the whole viewport, leaving
    // the app mouse-dead until reload. As a delegated handler it works
    // correctly instead: Svelte's replay walks target→root and honours
    // `if (event.cancelBubble) break;`
    // (internal/client/dom/elements/events.js), so the inner handlers run
    // FIRST and the walk still stops here, before the message row's own
    // delegated onclick.
    function containClicks(e: MouseEvent) {
        e.stopPropagation();
    }

    onMount(() => {
        // Register in the shared modal slot so Escape/back close it centrally.
        // The store mirrors `interfaceState.lightboxOpen` off this claim, and
        // the token keeps a superseded viewer's teardown from stealing the slot
        // back from the viewer that replaced it.
        const token = openModal("lightbox", onClose);
        return () => {
            clearModalIfOwner(token);
        };
    });

    // Gallery arrow keys. Kept in its own onMount so the listener's lifecycle is
    // independent of the modal-slot registration above. Escape is NOT handled
    // here — `use:focusTrap={{ onEscape: onClose }}` owns it.
    onMount(() => {
        const onKey = (e: KeyboardEvent) => {
            // Alt+ArrowLeft is the browser-back chord; hijacking (and
            // preventDefault-ing) it would swallow the popstate the app's back
            // guard depends on. Leave every modified arrow to the browser.
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            if (e.key === "ArrowLeft" && onPrev) {
                e.preventDefault();
                onPrev();
            } else if (e.key === "ArrowRight" && onNext) {
                e.preventDefault();
                onNext();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-[9998] overflow-hidden"
    style="touch-action: none;"
    onclick={containClicks}
>
    <!-- Backdrop: clicking outside the media closes the viewer. -->
    <button
        type="button"
        aria-label="Close {mediaNoun} viewer"
        class="absolute inset-0 bg-black/80"
        onclick={onClose}
    ></button>

    <!-- Dialog: full-screen flex-centered layer. pointer-events-none lets clicks
         on the empty area fall through to the backdrop button; the image and the
         controls re-enable pointer events. -->
    <div
        class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="{isVideo ? 'Video' : 'Image'} viewer"
        use:focusTrap={{ onEscape: onClose }}
    >
        <!-- Top-right action buttons -->
        <div
            class="absolute top-3 right-3 z-10 flex items-center gap-2 pointer-events-auto"
        >
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

        {#if onPrev}
            <button
                onclick={onPrev}
                title="Previous"
                aria-label="Previous {mediaNoun}"
                class="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors pointer-events-auto"
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
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
            </button>
        {/if}
        {#if onNext}
            <button
                onclick={onNext}
                title="Next"
                aria-label="Next {mediaNoun}"
                class="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors pointer-events-auto"
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
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>
        {/if}

        {#if isVideo}
            <!-- One player, mounted only once its bytes are here. Native
                 controls are browser-internal, so they are unaffected by
                 Svelte's click delegation and by the root's containClicks. -->
            <div
                class="relative pointer-events-auto flex items-center justify-center"
                style="max-width: calc(100dvw - {interfaceState.isMobile
                    ? '6em'
                    : '2em'}); max-height: calc(100dvh - {interfaceState.isMobile
                    ? '6em'
                    : '2em'});"
            >
                {#if videoBlobUrl}
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video
                        bind:this={videoEl}
                        src={videoBlobUrl}
                        poster={poster ?? undefined}
                        controls
                        autoplay
                        preload="metadata"
                        playsinline
                        class="max-w-full max-h-full rounded-lg bg-black"
                        style="max-height: calc(100dvh - {interfaceState.isMobile
                            ? '6em'
                            : '2em'});"
                    ></video>
                {:else}
                    <div
                        class="relative flex items-center justify-center rounded-lg bg-black/60 min-w-[12rem] min-h-[8rem]"
                    >
                        {#if poster}
                            <img
                                src={poster}
                                {alt}
                                class="max-w-full max-h-[70dvh] rounded-lg opacity-60"
                            />
                        {/if}
                        <div
                            class="absolute inset-0 flex items-center justify-center"
                        >
                            {#if videoFailed}
                                <p class="px-4 text-sm text-white text-center">
                                    Could not load this video. Use Download to
                                    save it instead.
                                </p>
                            {:else}
                                <div
                                    class="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin"
                                ></div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {:else}
            <!-- The image is a genuine pinch/pan/zoom gesture surface driven by
                 pointer events; it cannot be cleanly keyboard-operated within
                 this a11y sweep, so
                 a11y_no_noninteractive_element_interactions stays. (No
                 per-image stopPropagation shim is needed: the backdrop is a
                 sibling button, and the root's DELEGATED containClicks handler
                 stops any image tap from bubbling to the surrounding message
                 row.) -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <img
                bind:this={imgEl}
                {src}
                {alt}
                class="pointer-events-auto"
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
        {/if}
    </div>
</div>
