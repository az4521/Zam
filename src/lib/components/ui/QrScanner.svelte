<script lang="ts">
    import jsQR from "jsqr";
    import { onDestroy, untrack } from "svelte";
    import { toQrPayloadBytes, isMatrixQrPayload } from "$lib/utils/qrCode";

    let {
        onScan,
        onError,
    }: {
        onScan: (bytes: Uint8ClampedArray) => void;
        onError?: (message: string) => void;
    } = $props();

    // jsQR is synchronous and routinely overruns a frame budget on a mid-range
    // phone, so decoding on every rAF pins the main thread at a 100% duty cycle
    // — and that is the SAME thread rust-crypto and the SDK's to-device
    // processing run on, so the modal's own Cancel button and the incoming
    // reciprocate prompt stall exactly while the user is waiting on them.
    // Decoding ~10x/second is imperceptible for scan latency and leaves the
    // thread free in between. (zxing-js ships the same idea as
    // `timeBetweenScansMillis`.)
    const DECODE_INTERVAL_MS = 100;

    let videoEl = $state<HTMLVideoElement | null>(null);
    let status = $state("Starting the camera…");
    let stream: MediaStream | null = null;
    let frame: number | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let lastDecode = 0;
    // Terminal latch: the loop is over and an outcome has been reported.
    let done = false;
    // Separate latch so a payload can never be handed up twice. It is set
    // BEFORE `onScan` runs while `done` stays false, which is what lets a throw
    // from the consumer still travel through `fail()`.
    let delivered = false;

    /**
     * End the decode loop and the camera. Tracks stop on EVERY path — the
     * camera indicator must always go out — but nulling `srcObject` is opt-out.
     *
     * Ending the tracks leaves the element holding a dead stream, which renders
     * as a frozen last frame; nulling the source blanks it to black instead.
     * Black is right under error text, and wrong after a successful scan: the
     * consumer's handshake can take seconds, and the frozen frame is all that
     * stands between the user and a black box. Same teardown as
     * VoiceAudioSettings' `stopCamera` otherwise.
     */
    function stop(clearPreview = true): void {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        for (const track of stream?.getTracks() ?? []) track.stop();
        stream = null;
        if (clearPreview && videoEl) videoEl.srcObject = null;
    }

    function fail(message: string): void {
        if (done) return;
        done = true;
        stop();
        status = message;
        onError?.(message);
    }

    /**
     * Map a `getUserMedia` rejection to user-facing copy, logging the raw error
     * the way crypto.ts's `verificationFailureText` does — the browser's own
     * message is developer-facing, but a bug report is useless without it.
     * NotReadableError (camera held by Teams/Zoom/OBS) and NotFoundError are the
     * common desktop failures and have nothing to do with TLS, so the https
     * wording is the last resort rather than the catch-all.
     */
    function cameraFailureText(e: unknown): string {
        console.warn("[matrix] could not open the camera for QR scanning", e);
        const name = e instanceof Error ? e.name : "";
        if (name === "NotAllowedError") return "Camera access was denied.";
        if (name === "NotFoundError")
            return "No camera was found on this device.";
        if (name === "NotReadableError")
            return "The camera is already in use by another app.";
        return "Could not open the camera. A secure (https) connection is required.";
    }

    function scanFrame(now: DOMHighResTimeStamp): void {
        frame = null;
        if (done) return;
        const video = videoEl;
        const width = video?.videoWidth ?? 0;
        const height = video?.videoHeight ?? 0;
        // `now - 0` clears the interval on the very first callback, so throttling
        // costs no latency on a code that is already in shot.
        if (
            video &&
            width > 0 &&
            height > 0 &&
            now - lastDecode >= DECODE_INTERVAL_MS
        ) {
            lastDecode = now;
            canvas ??= document.createElement("canvas");
            // Assigning width/height resets the bitmap, so only do it when the
            // dimensions actually changed rather than once per frame.
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
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
                if (payload && isMatrixQrPayload(payload) && !delivered) {
                    delivered = true;
                    // Keep the last frame: the consumer's handshake runs from
                    // here, and a black square under "checking it…" reads as a
                    // crash. `fail()` below still blanks it if that throws.
                    stop(false);
                    status = "Code found - checking it…";
                    try {
                        onScan(payload);
                        done = true;
                    } catch (e) {
                        // We are inside a rAF callback: an escaping throw would
                        // be an unhandled error with no path back to the UI.
                        console.warn("[matrix] QR scan handler threw", e);
                        fail("Could not start verification with that code.");
                    }
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
            // 640px wide is plenty to decode a QR held up to the lens and keeps
            // each getImageData allocation to ~1.2 MB instead of 720p's ~3.7 MB.
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 } },
            });
        } catch (e) {
            fail(cameraFailureText(e));
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
        } catch (e) {
            console.warn("[matrix] could not start the camera preview", e);
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
        // `untrack` so this effect keeps ZERO dependencies and can never re-run
        // and open a second camera. It matters now that `stop()` reads `videoEl`
        // ($state): on the no-getUserMedia branch `start()` reaches `fail()` ->
        // `stop()` synchronously, which would otherwise make `videoEl` a
        // dependency and let `bind:this` retrigger the whole effect.
        untrack(() => void start());
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
    <!-- The preview conveys nothing without sight and the live region below
         already carries every state change, so hide it rather than label it. -->
    <!-- svelte-ignore a11y_media_has_caption -- a live camera preview has no captions -->
    <video
        bind:this={videoEl}
        playsinline
        muted
        aria-hidden="true"
        class="h-48 w-48 rounded bg-black object-cover"
    ></video>
    <p class="text-xs text-discord-textMuted" aria-live="polite">{status}</p>
</div>
