// Normalize the two "share INTO Zam" source shapes (Android intent extras and
// the Web Share Target POST fields) into one model the receive flow consumes.
// Files are opaque here so this stays pure (no File/DOM dependency, jsdom-safe).

export type AndroidShareInput = {
    source: "android";
    text?: string | null;
    subject?: string | null;
    files?: unknown[] | null;
    droppedFiles?: number;
};
export type WebShareInput = {
    source: "web";
    title?: string | null;
    text?: string | null;
    url?: string | null;
    files?: unknown[] | null;
    droppedFiles?: number;
};
export type ShareInput = AndroidShareInput | WebShareInput;

export type NormalizedShare =
    | { kind: "text"; text: string; droppedFiles?: number }
    | { kind: "files"; text: string; files: unknown[]; droppedFiles?: number };

function cleanFiles(files: unknown[] | null | undefined): unknown[] {
    if (!Array.isArray(files)) return [];
    return files.filter((f) => f != null && typeof f === "object");
}

export function normalizeSharePayload(
    input: ShareInput,
): NormalizedShare | null {
    const pieces: string[] = [];
    const push = (v: string | null | undefined) => {
        const t = (v ?? "").trim();
        if (t) pieces.push(t);
    };
    if (input.source === "web") {
        push(input.title);
        push(input.text);
        const url = (input.url ?? "").trim();
        if (url && !(input.text ?? "").includes(url)) push(url);
    } else {
        push(input.subject);
        push(input.text);
    }
    const text = pieces.join("\n");
    const files = cleanFiles(input.files);
    const droppedFiles = input.droppedFiles;
    if (files.length > 0)
        return {
            kind: "files",
            text,
            files,
            ...(droppedFiles && droppedFiles > 0 ? { droppedFiles } : {}),
        };
    if (text)
        return {
            kind: "text",
            text,
            ...(droppedFiles && droppedFiles > 0 ? { droppedFiles } : {}),
        };
    // When all files were dropped but there's no text, still return a payload
    // so the sheet opens and shows the droppedFiles notice.
    if (droppedFiles && droppedFiles > 0)
        return { kind: "text", text: "", droppedFiles };
    return null;
}
