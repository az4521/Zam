<script lang="ts">
    import { t } from "$lib/i18n";
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
</script>

<div bind:this={wrapperEl} class="relative w-full max-w-sm mt-1 group/flash">
    <!-- No allow-same-origin, allow-top-navigation, allow-popups or
         allow-forms: see static/flash-sandbox/index.html. -->
    {#if navigatedAway}
        <div class="w-full aspect-video rounded-lg bg-black"></div>
    {:else}
        <iframe
            bind:this={frame}
            src="/flash-sandbox/index.html"
            sandbox="allow-scripts"
            allow="autoplay"
            referrerpolicy="no-referrer"
            title={t("swfEmbed.adobeFlash")}
            class="block w-full aspect-video rounded-lg overflow-hidden bg-black border-0"
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
</div>
