// Natural sizes of media this session has already loaded, by URL. A row the
// timeline unmounts and mounts again (utils/timelineWindow) would otherwise
// draw media the sender gave no dimensions for at 0×0 until it reloads, then
// grow and shove everything around it. Sizes come from the browser
// (naturalWidth, videoWidth), never from event content.

const MAX_ENTRIES = 5000;
const sizes = new Map<string, { width: number; height: number }>();

export function learnMediaSize(
    key: string | null | undefined,
    width: number,
    height: number,
): void {
    if (!key || !(width > 0) || !(height > 0)) return;
    const prev = sizes.get(key);
    if (prev?.width === width && prev.height === height) return;
    sizes.delete(key);
    if (sizes.size >= MAX_ENTRIES) {
        sizes.delete(sizes.keys().next().value!);
    }
    sizes.set(key, { width, height });
}

export function learnedMediaSize(
    key: string | null | undefined,
): { width: number; height: number } | undefined {
    return key ? sizes.get(key) : undefined;
}

/** An `onload` for an `<img>`: remember its natural size under `key`. */
export function learnImageSize(key: string | null | undefined) {
    return (e: Event) => {
        const img = e.currentTarget as HTMLImageElement;
        learnMediaSize(key, img.naturalWidth, img.naturalHeight);
    };
}
