// Keeps the volume (and mute) of every video and audio player in step: what
// is set on one is what the next one starts with, across messages, the
// lightbox and restarts. Device-local, like the other playback preferences.

const KEY = "settings:mediaVolume";

interface Saved {
    volume: number;
    muted: boolean;
}

export function readSavedVolume(): Saved | null {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null");
        const volume = parsed?.volume;
        if (typeof volume !== "number" || !(volume >= 0 && volume <= 1))
            return null;
        return { volume, muted: parsed.muted === true };
    } catch {
        return null;
    }
}

function save(el: HTMLMediaElement): void {
    try {
        localStorage.setItem(
            KEY,
            JSON.stringify({ volume: el.volume, muted: el.muted }),
        );
    } catch {
        // ignore (private mode / storage full)
    }
}

/** `use:rememberVolume` on a <video> or <audio> that plays with sound. */
export function rememberVolume(el: HTMLMediaElement): { destroy: () => void } {
    const saved = readSavedVolume();
    if (saved) {
        el.volume = saved.volume;
        el.muted = saved.muted;
    }
    // Setting the saved values above fires this once, writing them back
    // unchanged, so it needs no guard.
    const onChange = () => save(el);
    el.addEventListener("volumechange", onChange);
    return { destroy: () => el.removeEventListener("volumechange", onChange) };
}
