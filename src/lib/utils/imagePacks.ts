import type {
    CustomImagePack,
    CustomPackImage,
    ImageUsage,
} from "$lib/matrix/client";

export function packKey(pack: { stateKey?: string }): string {
    return pack.stateKey ?? "";
}

export function usageFromFlags(emoji: boolean, sticker: boolean): ImageUsage[] {
    return [
        ...(emoji ? (["emoticon"] as ImageUsage[]) : []),
        ...(sticker ? (["sticker"] as ImageUsage[]) : []),
    ];
}

export function sortPackImages(images: CustomPackImage[]): CustomPackImage[] {
    return [...images].sort((a, b) => a.shortcode.localeCompare(b.shortcode));
}

export function sortEmotePacks(packs: CustomImagePack[]): CustomImagePack[] {
    return [...packs]
        .map((pack) => ({ ...pack, images: sortPackImages(pack.images) }))
        .sort(
            (a, b) =>
                Number(a.inherited) - Number(b.inherited) ||
                (a.sourceName ?? "").localeCompare(b.sourceName ?? "") ||
                a.name.localeCompare(b.name),
        );
}
