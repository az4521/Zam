/**
 * Justified-row layout for an MSC4274 gallery's images and videos.
 *
 * Items are packed left to right into rows. Every item in a row gets the
 * row's height and a width from its own aspect ratio, and a full row is
 * scaled so it spans the container exactly, so nothing is cropped and the
 * grid adapts to the width it is given: a phone gets short rows of few items,
 * a wide pane longer rows. The last row keeps the target height instead of
 * being stretched to fill.
 *
 * Pure: the caller measures the container and supplies the aspect ratios
 * (info.w / info.h, else what the loaded image reported, else 1).
 */

export interface GalleryTile {
    /** Index into the `aspects` array given. */
    index: number;
    width: number;
    height: number;
}

export interface GalleryRow {
    height: number;
    tiles: GalleryTile[];
}

export interface GalleryLayoutOptions {
    /** Space between tiles, horizontally and vertically, in px. */
    gap?: number;
}

/** Ratios past these are laid out at the limit; the image is then fitted
 *  inside its tile (letterboxed), never cropped. Keeps a panorama from
 *  becoming a 20px strip and a tall screenshot from taking a whole row. */
export const MIN_ASPECT = 0.5;
export const MAX_ASPECT = 2.5;

/** Height a lone item may reach, as for a single image message. */
const SINGLE_MAX_HEIGHT = 320;

/** Aspect ratio from untrusted dimensions, clamped for layout; 1 when unknown. */
export function layoutAspect(width: unknown, height: unknown): number {
    const w = typeof width === "number" ? width : Number(width);
    const h = typeof height === "number" ? height : Number(height);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0)
        return 1;
    return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, w / h));
}

/** Row height aimed for at a container width: shorter rows on narrow screens. */
export function targetRowHeight(width: number): number {
    return Math.round(Math.min(180, Math.max(100, width / 2.6)));
}

/** Most items one row may hold at a container width. */
export function maxPerRow(width: number): number {
    return width < 360 ? 3 : 4;
}

export function justifyGallery(
    aspects: readonly number[],
    width: number,
    options: GalleryLayoutOptions = {},
): GalleryRow[] {
    const gap = options.gap ?? 4;
    const w = Math.max(0, Math.floor(width));
    if (aspects.length === 0 || w === 0) return [];
    const ars = aspects.map((a) =>
        Number.isFinite(a) && a > 0
            ? Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, a))
            : 1,
    );

    // One item: as large as a single image message would be.
    if (ars.length === 1) {
        const height = Math.min(SINGLE_MAX_HEIGHT, w / ars[0]);
        return [
            {
                height: Math.round(height),
                tiles: [
                    {
                        index: 0,
                        width: Math.round(Math.min(w, height * ars[0])),
                        height: Math.round(height),
                    },
                ],
            },
        ];
    }

    const target = targetRowHeight(w);
    const cap = maxPerRow(w);
    // A row never grows taller than this when scaled to fill.
    const maxHeight = target * 1.6;
    const rows: GalleryRow[] = [];
    let start = 0;
    while (start < ars.length) {
        let end = start;
        let sum = 0;
        // Add items until the row at the target height reaches the width.
        while (end < ars.length && end - start < cap) {
            sum += ars[end];
            end++;
            const gaps = gap * (end - start - 1);
            if (sum * target + gaps >= w) break;
        }
        // Don't leave one item alone on a last row (three photos as 2 + 1):
        // take it into this row when the row has room for it and stays at
        // least 60% of the target height.
        if (
            end === ars.length - 1 &&
            end - start + 1 <= cap &&
            (w - gap * (end - start)) / (sum + ars[end]) >= target * 0.6
        ) {
            sum += ars[end];
            end++;
        }
        const count = end - start;
        const gaps = gap * (count - 1);
        const filled = (w - gaps) / sum;
        const isLast = end >= ars.length;
        // A full row is scaled to span the width; so is a row the per-row cap
        // cut short (tall portraits), as long as that keeps it under
        // maxHeight. Past that, and always for the last row, it keeps the
        // target height and is ragged on the right instead of stretching.
        const height = Math.max(
            1,
            isLast || filled > maxHeight ? Math.min(target, filled) : filled,
        );
        const rounded = Math.round(height);
        const tiles: GalleryTile[] = [];
        let used = 0;
        for (let i = start; i < end; i++) {
            let tw = Math.floor(ars[i] * height);
            // The last tile of a filled row takes the rounding remainder, so
            // the row's right edge lines up with the container's.
            if (i === end - 1 && height === filled) tw = w - gaps - used;
            tiles.push({ index: i, width: Math.max(1, tw), height: rounded });
            used += tw;
        }
        rows.push({ height: rounded, tiles });
        start = end;
    }
    return rows;
}

/**
 * Square box edge (px) to ask the server's thumbnail endpoint for, with
 * method=scale, for a tile drawn at `width`×`height` CSS px. Rounded up to the
 * sizes servers commonly pre-generate so tiles share cached thumbnails.
 */
export function thumbnailBox(
    width: number,
    height: number,
    devicePixelRatio = 1,
): number {
    const need = Math.ceil(Math.max(width, height) * (devicePixelRatio || 1));
    for (const size of [96, 320, 640, 800]) if (need <= size) return size;
    return 800;
}
