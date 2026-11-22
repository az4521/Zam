// Pre-upload cache: uploads of composer attachments that start as soon as a
// file is queued, so pressing send only has to post the event.
//
// SDK-free and generic: the runner (the actual upload) is injected, so this
// module is testable on its own. An entry is keyed by the queued item's id and
// is only handed over when its fingerprint still matches the send's: a changed
// room, file, name, upload setting or encryption state means a fresh upload.

export interface PreUploadFingerprint {
    roomId: string;
    /** Compared by identity: a rebuilt File (rename) is a different upload. */
    file: File;
    name: string;
    /** The upload-affecting settings, as one string. */
    settings: string;
    /** The room's encrypted-for-send state when the upload started. */
    encrypted: boolean;
}

export type PreUploadStatus = "uploading" | "ready" | "failed";

export type PreUploadProgress = (loaded: number, total: number) => void;

export type PreUploadRun<T> = (
    report: PreUploadProgress,
    signal: AbortSignal,
) => Promise<T>;

export interface PreUploadEntry<T> {
    readonly fingerprint: PreUploadFingerprint;
    readonly promise: Promise<T>;
    readonly abort: AbortController;
    status: PreUploadStatus;
    progress: { loaded: number; total: number } | null;
    listeners: Set<PreUploadProgress>;
}

export function sameFingerprint(
    a: PreUploadFingerprint,
    b: PreUploadFingerprint,
): boolean {
    return (
        a.roomId === b.roomId &&
        a.file === b.file &&
        a.name === b.name &&
        a.settings === b.settings &&
        a.encrypted === b.encrypted
    );
}

export interface PreUploadCache<T> {
    /** Start an upload for `id`. A running entry with the same fingerprint is
     *  kept; any other entry for `id` is discarded (and aborted) first. */
    start(
        id: string,
        fingerprint: PreUploadFingerprint,
        run: PreUploadRun<T>,
    ): void;
    /** Take the entry out of the cache without judging it. The caller now owns
     *  it and must claim it or cancel it. */
    detach(id: string): PreUploadEntry<T> | undefined;
    /** Remove and abort the entry for `id`, if any. */
    discard(id: string): void;
    /** Abort an entry the caller owns (one that was detached). */
    cancel(entry: PreUploadEntry<T>): void;
    /** The entry's result if its fingerprint matches `fingerprint`, else null
     *  (the entry is aborted). Also null when the upload failed. Progress is
     *  forwarded to `onProgress`, replaying the last known value first. */
    claim(
        entry: PreUploadEntry<T>,
        fingerprint: PreUploadFingerprint,
        onProgress?: PreUploadProgress,
    ): Promise<T | null>;
    /** The entry's status, or undefined when none is cached for `id`. */
    status(id: string): PreUploadStatus | undefined;
    /** The last reported progress for `id`, or null when none yet. */
    progress(id: string): { loaded: number; total: number } | null;
}

export function createPreUploadCache<T>(
    onChange?: () => void,
): PreUploadCache<T> {
    const entries = new Map<string, PreUploadEntry<T>>();
    const changed = () => onChange?.();

    function cancel(entry: PreUploadEntry<T>): void {
        entry.listeners.clear();
        if (!entry.abort.signal.aborted) entry.abort.abort();
    }

    function discard(id: string): void {
        const entry = entries.get(id);
        if (!entry) return;
        entries.delete(id);
        cancel(entry);
        changed();
    }

    function detach(id: string): PreUploadEntry<T> | undefined {
        const entry = entries.get(id);
        if (!entry) return undefined;
        entries.delete(id);
        changed();
        return entry;
    }

    function start(
        id: string,
        fingerprint: PreUploadFingerprint,
        run: PreUploadRun<T>,
    ): void {
        const existing = entries.get(id);
        if (existing && sameFingerprint(existing.fingerprint, fingerprint)) {
            return;
        }
        discard(id);

        const abort = new AbortController();
        const listeners = new Set<PreUploadProgress>();
        // Declared before `promise` so the progress callback can reach the
        // entry it belongs to; assigned right after it is built.
        const state: {
            entry?: PreUploadEntry<T>;
        } = {};
        const report: PreUploadProgress = (loaded, total) => {
            const entry = state.entry;
            // Keyed on the abort, not the cache: a detached entry (claimed by a
            // send) still reports to its claimer.
            if (!entry || entry.abort.signal.aborted) return;
            entry.progress = { loaded, total };
            for (const listener of entry.listeners) listener(loaded, total);
            if (entries.get(id) === entry) changed();
        };
        const promise = new Promise<T>((resolve) => {
            resolve(run(report, abort.signal));
        });
        // Mark the promise as handled so a failed pre-upload that nobody claims
        // never surfaces as an unhandled rejection. Consumers still see the
        // rejection when they await it.
        promise.then(
            () => {
                if (state.entry) state.entry.status = "ready";
                changed();
            },
            () => {
                if (state.entry) state.entry.status = "failed";
                changed();
            },
        );
        promise.catch(() => {});

        const entry: PreUploadEntry<T> = {
            fingerprint,
            promise,
            abort,
            status: "uploading",
            progress: null,
            listeners,
        };
        state.entry = entry;
        entries.set(id, entry);
        changed();
    }

    async function claim(
        entry: PreUploadEntry<T>,
        fingerprint: PreUploadFingerprint,
        onProgress?: PreUploadProgress,
    ): Promise<T | null> {
        if (
            !sameFingerprint(entry.fingerprint, fingerprint) ||
            entry.abort.signal.aborted
        ) {
            cancel(entry);
            return null;
        }
        if (onProgress) {
            entry.listeners.add(onProgress);
            if (entry.progress)
                onProgress(entry.progress.loaded, entry.progress.total);
        }
        try {
            return await entry.promise;
        } catch {
            return null;
        } finally {
            if (onProgress) entry.listeners.delete(onProgress);
        }
    }

    return {
        start,
        detach,
        discard,
        cancel,
        claim,
        status: (id) => entries.get(id)?.status,
        progress: (id) => entries.get(id)?.progress ?? null,
    };
}
