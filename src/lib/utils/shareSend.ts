/**
 * Pure utilities for planning and executing share sends without touching the
 * composer's draft/queue/reply state. Used by shareInbox.svelte.ts to isolate
 * share sends from the user's unsent draft.
 */

export type ShareSendStep =
    | { kind: "file"; file: File; caption: string | null }
    | { kind: "text"; text: string };

/**
 * Plan a share send as an ordered sequence of steps. When files are present,
 * the caption (trimmed, non-empty) rides on the first file; remaining files
 * have no caption. When no files are present, a non-whitespace caption becomes
 * a single text step. An empty/whitespace-only share returns an empty plan.
 */
export function planShareSend(input: {
    caption: string;
    files: File[];
}): ShareSendStep[] {
    const trimmed = input.caption.trim();

    // Files present: one step per file, caption on first file only
    if (input.files.length > 0) {
        return input.files.map((file, i) => ({
            kind: "file" as const,
            file,
            caption: i === 0 && trimmed ? trimmed : null,
        }));
    }

    // No files: text-only if non-empty, else empty plan
    if (trimmed) {
        return [{ kind: "text", text: trimmed }];
    }

    return [];
}

/**
 * Compute what remains unsent after a partial failure. Caption is considered
 * sent once step 0 is sent (it rides on the first file or is the only text
 * step). Already-sent files are never returned.
 */
export function shareRemainder(
    steps: ShareSendStep[],
    sentCount: number,
): { text: string; files: File[] } {
    const unsent = steps.slice(sentCount);
    const files = unsent
        .filter(
            (s): s is { kind: "file"; file: File; caption: string | null } =>
                s.kind === "file",
        )
        .map((s) => s.file);

    // Caption is sent once step 0 is sent (it was on that file or text step)
    const text =
        sentCount === 0 && unsent.length > 0
            ? unsent[0].kind === "file"
                ? unsent[0].caption || ""
                : unsent[0].text
            : "";

    return { text, files };
}
