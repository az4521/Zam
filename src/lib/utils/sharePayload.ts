// Normalize the two "share INTO Zam" source shapes (Android intent extras and
// the Web Share Target POST fields) into one model the receive flow consumes.
// Files are opaque here so this stays pure (no File/DOM dependency, jsdom-safe).

export type AndroidShareInput = {
    source: "android";
    text?: string | null;
    subject?: string | null;
    files?: unknown[] | null;
};
export type WebShareInput = {
    source: "web";
    title?: string | null;
    text?: string | null;
    url?: string | null;
    files?: unknown[] | null;
};
export type ShareInput = AndroidShareInput | WebShareInput;

export type NormalizedShare =
    | { kind: "text"; text: string }
    | { kind: "files"; text: string; files: unknown[] };

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
    if (files.length > 0) return { kind: "files", text, files };
    if (text) return { kind: "text", text };
    return null;
}
