/**
 * Geometry for the call's picture-in-picture: the desktop pop-out's drag
 * decisions and where the built-in video rests. Pure (no DOM, no SDK) so it
 * can be tested.
 */
import { snapPipToEdge, type PipPlacement } from "$lib/utils/videoTiles";

export interface PipRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PipPoint {
    x: number;
    y: number;
}

/** Rest margins, in rem, that the built-in video keeps from the window
 *  edges: clear of the room header above and the composer below. */
export const REST_SIDE_REM = 1;
export const REST_TOP_REM = 3.5;
export const REST_BOTTOM_REM = 5.5;

/** Built-in video width in rem (desktop, phone). */
export const PIP_WIDTH_REM = 18;
export const PIP_WIDTH_REM_MOBILE = 11;

/** The built-in video's size in CSS pixels for a root font size. */
export function pipSizeFor(
    mobile: boolean,
    rem: number,
): { width: number; height: number } {
    const width = (mobile ? PIP_WIDTH_REM_MOBILE : PIP_WIDTH_REM) * rem;
    return { width, height: (width * 9) / 16 };
}

/** Whether a pointer at (x, y), in viewport coordinates, has left a viewport
 *  of the given size. The pointer is captured while dragging, so it keeps
 *  reporting positions outside the window. */
export function leftViewport(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number,
): boolean {
    return x < 0 || y < 0 || x >= viewportWidth || y >= viewportHeight;
}

export function centreOf(rect: PipRect): PipPoint {
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Where the built-in video's top-left corner may rest in the viewport. */
export function restBounds(
    viewportWidth: number,
    viewportHeight: number,
    width: number,
    height: number,
    rem: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
        minX: REST_SIDE_REM * rem,
        maxX: viewportWidth - width - REST_SIDE_REM * rem,
        minY: REST_TOP_REM * rem,
        maxY: viewportHeight - height - REST_BOTTOM_REM * rem,
    };
}

/** The resting placement for a built-in video dropped with its top-left
 *  corner at (x, y): snapped to the nearest side, as a drag of it is. */
export function dockPlacement(
    x: number,
    y: number,
    width: number,
    height: number,
    viewportWidth: number,
    viewportHeight: number,
    rem: number,
): PipPlacement {
    return snapPipToEdge(
        x,
        y,
        restBounds(viewportWidth, viewportHeight, width, height, rem),
    );
}
