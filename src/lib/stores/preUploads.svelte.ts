// The app's pre-upload cache (utils/preUploadCache): uploads of queued composer
// attachments that started before Send. Its tick makes the attachment strip
// re-read progress; the cache itself knows nothing about the SDK. media.ts
// starts and claims entries, the composer queue discards them.

import {
    createPreUploadCache,
    type PreUploadStatus,
} from "$lib/utils/preUploadCache";
import type { PreparedMedia } from "$lib/matrix/media";

const tickState = $state({ n: 0 });

export const preUploads = createPreUploadCache<PreparedMedia>(() => {
    tickState.n++;
});

/** Status and last progress of a queued file's pre-upload. Reads the tick, so
 *  a $derived that calls it re-runs on every change. */
export function preUploadFor(id: string): {
    status: PreUploadStatus | undefined;
    progress: { loaded: number; total: number } | null;
} {
    void tickState.n;
    return {
        status: preUploads.status(id),
        progress: preUploads.progress(id),
    };
}
