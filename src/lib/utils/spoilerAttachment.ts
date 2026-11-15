// Spoilered attachments follow the Discord convention: the file name starts
// with "SPOILER_". No extra event fields, so other clients that know the
// convention hide them too, and ones that don't still show a sane name.

export const SPOILER_PREFIX = "SPOILER_";

export function isSpoilerFilename(name: string | null | undefined): boolean {
    return typeof name === "string" && name.startsWith(SPOILER_PREFIX);
}

/** Add or remove the spoiler prefix, never doubling it. */
export function withSpoiler(name: string, spoiler: boolean): string {
    const has = isSpoilerFilename(name);
    if (spoiler) return has ? name : SPOILER_PREFIX + name;
    return has ? name.slice(SPOILER_PREFIX.length) : name;
}

/** Whether a media event's content names a spoilered file. */
export function isSpoilerMedia(content: object | null | undefined): boolean {
    if (!content) return false;
    const c = content as { filename?: unknown; body?: unknown };
    const name = typeof c.filename === "string" ? c.filename : c.body;
    return isSpoilerFilename(typeof name === "string" ? name : null);
}
