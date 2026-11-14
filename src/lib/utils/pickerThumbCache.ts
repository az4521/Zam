// Emoji and sticker picker thumbnails are kept on the device by the service
// worker (static/sw.js, `pickerThumbResponse`), so reopening a picker does not
// re-download every custom emoji.
//
// The page marks a thumbnail URL as cacheable with PICKER_THUMB_PARAM. The
// worker strips the marker before it forwards the request, so the homeserver
// never sees it, and the page only adds it while a worker controls the page
// (an uncontrolled page fetches media itself and would send it as is).
//
// An image at a given mxc:// address never changes, so entries never go stale.
// The cache is per account (PICKER_THUMB_CACHE_PREFIX + user id) and the worker
// deletes an account's cache once that account is no longer signed in here.
//
// static/sw.js cannot import this file: it repeats both constants, and
// pickerThumbCache.test.ts fails if they drift.

export const PICKER_THUMB_PARAM = "zam_picker_thumb";
export const PICKER_THUMB_CACHE_PREFIX = "zam-picker-thumbs:";

/** Whether a service worker controls this page and will strip the marker. */
export function swControlsPage(): boolean {
    return (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        !!navigator.serviceWorker.controller
    );
}

/** Add the cache marker to a thumbnail URL. */
export function markPickerThumb(url: string): string {
    return `${url}${url.includes("?") ? "&" : "?"}${PICKER_THUMB_PARAM}=1`;
}
