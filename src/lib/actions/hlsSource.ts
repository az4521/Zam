import type Hls from "hls.js";

// Plays an HLS (m3u8) playlist in a <video>. Engines that play HLS natively
// (Safari, iOS) get it as the src. Everywhere else hls.js is loaded on first
// use, so the library costs nothing for tweets that play as mp4. The worker
// is off: it would need a blob: worker, which the CSP leaves out of
// worker-src. A null url detaches whatever is playing.
export function hlsSource(node: HTMLVideoElement, url: string | null) {
    let hls: Hls | null = null;
    let generation = 0;

    function teardown() {
        hls?.destroy();
        hls = null;
    }

    async function attach(src: string | null) {
        const mine = ++generation;
        teardown();
        if (!src) return;
        if (node.canPlayType("application/vnd.apple.mpegurl")) {
            node.src = src;
            return;
        }
        const { default: HlsCtor } = await import("hls.js");
        // The element may have been detached or given a new url meanwhile.
        if (mine !== generation || !HlsCtor.isSupported()) return;
        const player = new HlsCtor({ enableWorker: false });
        hls = player;
        player.on(HlsCtor.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            console.warn("HLS playback failed", data.type, data.details);
            if (hls === player) teardown();
        });
        player.loadSource(src);
        player.attachMedia(node);
    }

    void attach(url);

    return {
        update(next: string | null) {
            void attach(next);
        },
        destroy() {
            generation++;
            teardown();
        },
    };
}
