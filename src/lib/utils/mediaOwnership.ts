/**
 * Which client generation uploaded a plugin's media (audit ARCH-01's plugin
 * upload→send hole).
 *
 * The plugin API exposes upload and send as two separate calls. A plugin flow
 * that spans an account switch can upload on account A's server and then send
 * the resulting mxc URL as account B. The host records `mxc → generation` at
 * upload time and refuses to send an mxc recorded under an older generation.
 *
 * An mxc the host never recorded is allowed: plugins legitimately send media
 * they did not upload this session (sticker packs, reposts). Retired entries
 * are kept, not deleted, on client replacement, because deleting them would
 * turn "refused" back into "never recorded" and disable the guard. A size cap
 * bounds memory instead.
 */

export interface MediaOwnership {
    record(mxc: string, generation: number): void;
    /** True when `mxc` was uploaded under a generation other than `current`. */
    isForeign(mxc: string, current: number): boolean;
    size(): number;
}

export const MEDIA_OWNERSHIP_CAP = 256;

export function createMediaOwnership(
    cap: number = MEDIA_OWNERSHIP_CAP,
): MediaOwnership {
    // Map iteration order is insertion order, so the first key is the oldest.
    const owners = new Map<string, number>();
    return {
        record(mxc, generation) {
            owners.delete(mxc);
            owners.set(mxc, generation);
            while (owners.size > cap) {
                const oldest = owners.keys().next().value as string;
                owners.delete(oldest);
            }
        },
        isForeign(mxc, current) {
            const recorded = owners.get(mxc);
            return recorded !== undefined && recorded !== current;
        },
        size() {
            return owners.size;
        },
    };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

/** Every media URL an event content can reference: plain, encrypted, thumbnails. */
export function mxcUrlsInContent(content: Record<string, unknown>): string[] {
    const urls: unknown[] = [content.url];
    if (isRecord(content.file)) urls.push(content.file.url);
    if (isRecord(content.info)) {
        urls.push(content.info.thumbnail_url);
        if (isRecord(content.info.thumbnail_file)) {
            urls.push(content.info.thumbnail_file.url);
        }
    }
    return urls.filter((u): u is string => typeof u === "string");
}
