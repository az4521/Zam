<script lang="ts">
    import jsQR from "jsqr";
    import { onDestroy } from "svelte";
    import { toQrPayloadBytes, isMatrixQrPayload } from "$lib/utils/qrCode";

    let {
        onScan,
        onError,
    }: {
        onScan: (bytes: Uint8ClampedArray) => void;
        onError?: (message: string) => void;
    } = $props();

    let videoEl = $state<HTMLVideoElement | null>(null);
    let status = $state("Starting the camera…");
    let stream: MediaStream | null = null;
    let frame: number | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let done = false;

    function stop(): void {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        for (const track of stream?.getTracks() ?? []) track.stop();
        stream = null;
    }

    function fail(message: string): void {
        if (done) return;
        done = true;
        stop();
        status = message;
        onError?.(message);
    }

    function scanFrame(): void {
        frame = null;
        if (done) return;
        const video = videoEl;
        const width = video?.videoWidth ?? 0;
        const height = video?.videoHeight ?? 0;
        if (video && width > 0 && height > 0) {
            canvas ??= document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const image = ctx.getImageData(0, 0, width, height);
                const found = jsQR(image.data, width, height, {
                    inversionAttempts: "dontInvert",
                });
                const payload = found
                    ? toQrPayloadBytes(found.binaryData)
                    : null;
                if (payload && isMatrixQrPayload(payload)) {
                    done = true;
                    stop();
                    status = "Code found — checking it…";
                    onScan(payload);
                    return;
                }
                if (found) status = "That isn't a verification code.";
            }
        }
        frame = requestAnimationFrame(scanFrame);
    }

    async function start(): Promise<void> {
        if (!navigator.mediaDevices?.getUserMedia) {
            fail("This device has no camera available.");
            return;
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
        } catch (e) {
            // NotAllowedError is a refused prompt; anything else is a hardware
            // or (most often on mobile) insecure-context failure.
            fail(
                e instanceof Error && e.name === "NotAllowedError"
                    ? "Camera access was denied."
                    : "Could not open the camera. A secure (https) connection is required.",
            );
            return;
        }
        if (done) {
            stop();
            return;
        }
        const video = videoEl;
        if (!video) {
            fail("Could not start the camera preview.");
            return;
        }
        video.srcObject = stream;
        try {
            await video.play();
        } catch {
            fail("Could not start the camera preview.");
            return;
        }
        if (done) {
            stop();
            return;
        }
        status = "Point the camera at their code.";
        frame = requestAnimationFrame(scanFrame);
    }

    $effect(() => {
        void start();
        return () => {
            done = true;
            stop();
        };
    });

    onDestroy(() => {
        done = true;
        stop();
    });
</script>

<div class="flex flex-col items-center gap-2">
    <!-- svelte-ignore a11y_media_has_caption -- a live camera preview has no captions -->
    <video
        bind:this={videoEl}
        playsinline
        muted
        class="h-48 w-48 rounded bg-black object-cover"
    ></video>
    <p class="text-xs text-discord-textMuted" aria-live="polite">{status}</p>
</div>
