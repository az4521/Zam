<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import { Maximize2, Presentation, X } from "lucide-svelte";
    import WidgetFrame from "$lib/components/layout/WidgetFrame.svelte";
    import type { RoomWidget } from "$lib/utils/widgets";
    import { callWidgetKey } from "$lib/utils/callWidgets";
    import { closeCallWidget, focusTile } from "$lib/stores/voiceCall.svelte";

    // Open call widgets, rendered ONCE in a stable layer and laid over the
    // placeholder tiles that CallView draws in the grid, the spotlight stage and
    // the filmstrip (marked data-call-widget-slot). An iframe that is moved in
    // the DOM reloads and breaks the widget API handshake, so the frame never
    // moves: only its box is repositioned to follow its slot.
    interface Props {
        room: Room;
        openWidgets: RoomWidget[];
        /** The widget shown on the spotlight stage, if any. */
        focusedWidgetId: string | null;
        /** Whether CallView is showing the spotlight layout. */
        spotlight: boolean;
        /** Changes whenever the tile layout inputs change, to re-measure. */
        layoutKey: string;
    }
    let { room, openWidgets, focusedWidgetId, spotlight, layoutKey }: Props =
        $props();

    /** Flip and scale animations move slots without any resize event, so after
     *  a trigger we re-measure for this long, then stop. */
    const BURST_MS = 600;

    interface Rect {
        left: number;
        top: number;
        width: number;
        height: number;
    }

    let layerEl = $state<HTMLDivElement | undefined>();
    let ro: ResizeObserver | null = null;
    const observed = new Set<Element>();
    /** The last geometry written to each box, so unchanged boxes are not touched. */
    const applied = new WeakMap<HTMLElement, string>();
    let raf = 0;
    let burstEnd = 0;

    /** The slot's full rect plus the insets its clipping ancestors (the grid,
     *  the filmstrip) cut off it, or null when nothing of it is visible. The
     *  box keeps the full size and is clipped: shrinking it instead would
     *  resize the iframe and make the widget re-lay out on every scroll. */
    function slotGeometry(
        slot: HTMLElement,
        stop: HTMLElement,
    ): { rect: Rect; clip: string } | null {
        const r = slot.getBoundingClientRect();
        let left = r.left;
        let top = r.top;
        let right = r.right;
        let bottom = r.bottom;
        for (
            let el = slot.parentElement;
            el && el !== stop;
            el = el.parentElement
        ) {
            const cs = getComputedStyle(el);
            if (cs.overflowX === "visible" && cs.overflowY === "visible")
                continue;
            const c = el.getBoundingClientRect();
            left = Math.max(left, c.left);
            top = Math.max(top, c.top);
            right = Math.min(right, c.right);
            bottom = Math.min(bottom, c.bottom);
        }
        if (right - left <= 0 || bottom - top <= 0) return null;
        const insets = [
            top - r.top,
            r.right - right,
            r.bottom - bottom,
            left - r.left,
        ];
        return {
            rect: {
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
            },
            clip: insets.every((v) => v <= 0.5)
                ? ""
                : `inset(${insets.map((v) => `${Math.max(0, v)}px`).join(" ")})`,
        };
    }

    function observeTargets(container: Element, slots: Element[]): void {
        if (!ro) return;
        const want = new Set<Element>([container, ...slots]);
        for (const el of observed) {
            if (!want.has(el)) {
                ro.unobserve(el);
                observed.delete(el);
            }
        }
        for (const el of want) {
            if (!observed.has(el)) {
                ro.observe(el);
                observed.add(el);
            }
        }
    }

    /** Positions every box over its slot. Writes styles only when they change;
     *  a box with no visible slot is hidden, never unmounted. */
    function sync(): void {
        const layer = layerEl;
        const container = layer?.parentElement;
        if (!layer || !container) return;
        const origin = layer.getBoundingClientRect();
        const slots = new Map<string, HTMLElement>();
        const slotEls: HTMLElement[] = [];
        for (const el of container.querySelectorAll<HTMLElement>(
            "[data-call-widget-slot]",
        )) {
            slotEls.push(el);
            const id = el.dataset.callWidgetSlot ?? "";
            if (id && !slots.has(id)) slots.set(id, el);
        }
        observeTargets(container, slotEls);
        for (const box of layer.querySelectorAll<HTMLElement>(
            "[data-call-widget-box]",
        )) {
            const slot = slots.get(box.dataset.callWidgetBox ?? "");
            const geo = slot ? slotGeometry(slot, container) : null;
            if (!geo) {
                if (applied.get(box) !== "hidden") {
                    box.style.visibility = "hidden";
                    applied.set(box, "hidden");
                }
                continue;
            }
            const { rect, clip } = geo;
            const left = rect.left - origin.left;
            const top = rect.top - origin.top;
            const sig = `${left}|${top}|${rect.width}|${rect.height}|${clip}`;
            if (applied.get(box) === sig) continue;
            box.style.left = `${left}px`;
            box.style.top = `${top}px`;
            box.style.width = `${rect.width}px`;
            box.style.height = `${rect.height}px`;
            box.style.clipPath = clip;
            box.style.visibility = "visible";
            applied.set(box, sig);
        }
    }

    /** Sync now, then keep syncing for BURST_MS. One loop at a time; it ends on
     *  its own, so there is no permanent animation frame loop. */
    function burst(): void {
        sync();
        burstEnd = performance.now() + BURST_MS;
        if (raf) return;
        const step = () => {
            sync();
            raf =
                performance.now() < burstEnd ? requestAnimationFrame(step) : 0;
        };
        raf = requestAnimationFrame(step);
    }

    // Listeners and the resize observer live as long as the layer.
    $effect(() => {
        const layer = layerEl;
        if (!layer) return;
        ro = new ResizeObserver(() => burst());
        const onScroll = () => burst();
        window.addEventListener("resize", onScroll);
        document.addEventListener("scroll", onScroll, {
            capture: true,
            passive: true,
        });
        return () => {
            window.removeEventListener("resize", onScroll);
            document.removeEventListener("scroll", onScroll, true);
            ro?.disconnect();
            ro = null;
            observed.clear();
            cancelAnimationFrame(raf);
            raf = 0;
        };
    });

    // Layout inputs changed (spotlight, widget list, tile counts): re-measure.
    $effect(() => {
        void layoutKey;
        untrack(() => burst());
    });

    function toggleFullscreen(e: MouseEvent): void {
        e.stopPropagation();
        const box = (e.currentTarget as HTMLElement).closest<HTMLElement>(
            "[data-call-widget-box]",
        );
        if (!box) return;
        if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
        } else {
            void box.requestFullscreen().catch(() => {});
        }
    }

    const CHROME_BTN =
        "p-1 rounded bg-black/60 text-white opacity-70 hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
</script>

<div
    bind:this={layerEl}
    class="absolute inset-0 pointer-events-none"
    data-call-widget-layer
>
    {#each openWidgets as w (w.id)}
        {@const key = callWidgetKey(w.id)}
        {@const focused = w.id === focusedWidgetId}
        {@const inStrip = spotlight && !focused}
        <div
            data-call-widget-box={w.id}
            class="absolute z-30 pointer-events-auto rounded-lg overflow-hidden bg-black border-2 {focused
                ? 'border-zam-accent'
                : 'border-transparent'}"
            style="visibility: hidden;"
        >
            <WidgetFrame {room} widget={w} />
            {#if inStrip}
                <!-- Filmstrip: the frame is not interactive, so a click here
                     brings the widget to the stage. -->
                <button
                    type="button"
                    class="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                    aria-label={t("callView.focusWidget", { widget: w.name })}
                    onclick={() => focusTile(key)}
                ></button>
            {/if}
            <div class="absolute top-1 end-1 z-20 flex items-center gap-1">
                <button
                    type="button"
                    class="{CHROME_BTN} {focused ? 'text-zam-accent' : ''}"
                    title={focused
                        ? t("callView.exitSpotlightFor", { label: w.name })
                        : t("callView.spotlight", { label: w.name })}
                    aria-label={focused
                        ? t("callView.exitSpotlightFor", { label: w.name })
                        : t("callView.spotlight", { label: w.name })}
                    onclick={(e) => {
                        e.stopPropagation();
                        focusTile(key);
                    }}
                >
                    <Presentation size={16} />
                </button>
                <button
                    type="button"
                    class={CHROME_BTN}
                    title={t("videoTile.fullscreen")}
                    aria-label={t("videoTile.fullscreen")}
                    onclick={toggleFullscreen}
                >
                    <Maximize2 size={16} />
                </button>
                <button
                    type="button"
                    class={CHROME_BTN}
                    title={t("callView.closeWidget")}
                    aria-label={t("callView.closeWidget")}
                    onclick={(e) => {
                        e.stopPropagation();
                        closeCallWidget(w.id);
                    }}
                >
                    <X size={16} />
                </button>
            </div>
            <span
                class="absolute bottom-2 start-2 z-10 max-w-[calc(100%-1rem)] truncate px-1.5 py-0.5 rounded bg-black/60 text-xs text-white pointer-events-none"
                >{w.name}</span
            >
        </div>
    {/each}
</div>

<style>
    /* Fullscreen fills the screen: the slot's scroll clip must not apply. */
    [data-call-widget-box]:fullscreen {
        clip-path: none !important;
    }
</style>
