<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        clampSize,
        RESIZE_STEP_LARGE_PX,
        RESIZE_STEP_PX,
    } from "$lib/actions/resizeHandle";
    import {
        clearSavedFlashSize,
        readSavedFlashSize,
        readSavedFlashVolume,
        writeSavedFlashSize,
        writeSavedFlashVolume,
        type FlashSize,
    } from "$lib/utils/flashPrefs";
    interface Props {
        src: string; // URL of the SWF (a blob: URL of the fetched attachment)
    }

    let { src }: Props = $props();

    // Ruffle's two wasm builds, the only files the sandbox may ask for.
    const RUFFLE_WASM = /^[0-9a-f]{20}\.wasm$/;

    let frame: HTMLIFrameElement | undefined = $state();
    let port: MessagePort | null = $state(null);
    // The frame left our page: something in it navigated, which Ruffle's
    // openUrlMode should never allow. Drop it rather than keep running it.
    let navigatedAway = $state(false);

    // Ruffle runs in static/flash-sandbox/, never in this page: whatever a
    // SWF gets to execute is confined to an opaque origin with no access to
    // the session in this page's storage, its DOM, or the network.
    $effect(() => {
        if (!frame) return;
        const target = frame;
        const currentSrc = src;
        const channel = new MessageChannel();
        let started = false;
        let disposed = false;

        channel.port1.onmessage = async (e) => {
            const msg = e.data ?? {};
            if (msg.type === "ready") {
                port = channel.port1;
                // Hand the player the level the user last set; it cannot
                // read localStorage itself.
                const volume = readSavedFlashVolume();
                if (volume !== null)
                    channel.port1.postMessage({
                        type: "volume",
                        value: volume,
                    });
            } else if (msg.type === "volume") {
                // The player polls its own volume and reports what changed.
                writeSavedFlashVolume(msg.value);
            } else if (
                msg.type === "wasm" &&
                Number.isInteger(msg.id) &&
                typeof msg.name === "string" &&
                RUFFLE_WASM.test(msg.name)
            ) {
                let bytes: ArrayBuffer | null = null;
                try {
                    const res = await fetch(`/ruffle/${msg.name}`);
                    if (res.ok) bytes = await res.arrayBuffer();
                } catch {
                    /* answered as unavailable */
                }
                if (disposed) return;
                channel.port1.postMessage(
                    { type: "wasm", id: msg.id, bytes },
                    bytes ? [bytes] : [],
                );
            }
        };

        async function onLoad() {
            // Once only: a SWF that navigates the frame gets nothing more.
            if (started) {
                navigatedAway = true;
                return;
            }
            started = true;
            const swf = await (await fetch(currentSrc)).arrayBuffer();
            if (disposed) return;
            // An opaque origin has no name to target; the frame is ours.
            target.contentWindow?.postMessage({ type: "init", swf }, "*", [
                channel.port2,
                swf,
            ]);
        }
        const onLoadSafe = () => onLoad().catch(console.error);
        target.addEventListener("load", onLoadSafe);

        return () => {
            disposed = true;
            target.removeEventListener("load", onLoadSafe);
            channel.port1.close();
            port = null;
        };
    });

    let wrapperEl: HTMLDivElement | undefined = $state();

    $effect(() => {
        if (!wrapperEl || !port) return;
        const p = port;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) p.postMessage({ type: "suspend" });
            },
            { threshold: 0 },
        );
        observer.observe(wrapperEl);
        return () => observer.disconnect();
    });

    // The viewport size the user dragged to, or null for the default (the
    // video's 16:9 box at max-w-2xl). Remembered device-locally.
    let size = $state<FlashSize | null>(readSavedFlashSize());
    let dragging = $state(false);
    const MIN_W = 240;
    const MIN_H = 135;
    let drag: {
        x: number;
        y: number;
        w: number;
        h: number;
        sign: number;
    } | null = null;

    // The grip sits at the bottom-right, so in RTL it is bottom-left and the
    // horizontal sense of both the drag and the arrow keys flips.
    function xSign(el: Element): number {
        return getComputedStyle(el).direction === "rtl" ? -1 : 1;
    }

    // Width up to the parent's width, height up to 90% of the window.
    function bounds() {
        return {
            minW: MIN_W,
            minH: MIN_H,
            maxW: wrapperEl?.parentElement?.clientWidth ?? window.innerWidth,
            maxH: window.innerHeight * 0.9,
        };
    }

    function currentSize(): { w: number; h: number } {
        const r = wrapperEl?.getBoundingClientRect();
        return { w: r?.width ?? MIN_W, h: r?.height ?? MIN_H };
    }

    function gripDown(e: PointerEvent) {
        const grip = e.currentTarget as HTMLElement;
        const { w, h } = currentSize();
        drag = {
            x: e.clientX,
            y: e.clientY,
            w,
            h,
            sign: xSign(grip),
        };
        grip.setPointerCapture(e.pointerId);
        // The iframe would otherwise swallow the pointer moves.
        dragging = true;
        e.preventDefault();
    }

    function gripMove(e: PointerEvent) {
        if (!drag) return;
        const next = clampSize(
            drag.w + (e.clientX - drag.x) * drag.sign,
            drag.h + (e.clientY - drag.y),
            bounds(),
        );
        size = { w: Math.round(next.w), h: Math.round(next.h) };
    }

    function gripUp() {
        if (!drag) return;
        drag = null;
        dragging = false;
        if (size) writeSavedFlashSize(size);
    }

    // Arrow keys move the grip one step, Shift for a larger one. Same clamp
    // and persistence as the drag.
    function gripKey(e: KeyboardEvent) {
        const step = e.shiftKey ? RESIZE_STEP_LARGE_PX : RESIZE_STEP_PX;
        let dx = 0;
        let dy = 0;
        switch (e.key) {
            case "ArrowLeft":
                dx = -step;
                break;
            case "ArrowRight":
                dx = step;
                break;
            case "ArrowUp":
                dy = -step;
                break;
            case "ArrowDown":
                dy = step;
                break;
            default:
                return;
        }
        e.preventDefault();
        const base = size ?? currentSize();
        const sign = xSign(e.currentTarget as Element);
        const next = clampSize(base.w + dx * sign, base.h + dy, bounds());
        size = { w: Math.round(next.w), h: Math.round(next.h) };
        writeSavedFlashSize(size);
    }

    // Double-click returns to the default size and forgets the stored one.
    function resetSize() {
        size = null;
        clearSavedFlashSize();
    }
</script>

<div
    bind:this={wrapperEl}
    class="relative w-full mt-1 group/flash"
    class:max-w-2xl={!size}
    style:width={size ? `min(${size.w}px, 100%)` : undefined}
    style:height={size ? `min(${size.h}px, 90vh)` : undefined}
>
    <!-- No allow-same-origin, allow-top-navigation, allow-popups or
         allow-forms: see static/flash-sandbox/index.html. -->
    {#if navigatedAway}
        <div
            class="w-full rounded-lg bg-black"
            class:aspect-video={!size}
            class:h-full={!!size}
        ></div>
    {:else}
        <iframe
            bind:this={frame}
            src="/flash-sandbox/index.html"
            sandbox="allow-scripts"
            allow="autoplay"
            referrerpolicy="no-referrer"
            title={t("swfEmbed.adobeFlash")}
            class="block w-full rounded-lg overflow-hidden bg-black border-0"
            class:aspect-video={!size}
            class:h-full={!!size}
            class:pointer-events-none={dragging}
        ></iframe>
    {/if}
    {#if port && !navigatedAway}
        <button
            onclick={() => port?.postMessage({ type: "suspend" })}
            title={t("flashEmbed.suspend")}
            class="absolute top-1.5 end-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/flash:opacity-100 transition-opacity hover:bg-black/70"
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
        </button>
    {/if}
    {#if !navigatedAway}
        <!-- Resize grip (bottom-right). Pointer capture keeps the drag
             going when the pointer leaves it; the iframe is inert meanwhile. -->
        <button
            type="button"
            onpointerdown={gripDown}
            onpointermove={gripMove}
            onpointerup={gripUp}
            onpointercancel={gripUp}
            onkeydown={gripKey}
            ondblclick={resetSize}
            title={t("flashEmbed.resizeHint")}
            aria-label={t("flashEmbed.resize")}
            class="absolute bottom-1 end-1 z-10 p-1 rounded bg-black/50 text-white cursor-nwse-resize mirror:cursor-nesw-resize opacity-0 group-hover/flash:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
            <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                class="w-3 h-3 mirror:-scale-x-100"
            >
                <path d="M14 6v8H6z" />
            </svg>
        </button>
    {/if}
</div>
