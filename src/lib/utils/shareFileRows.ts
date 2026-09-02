// src/lib/utils/shareFileRows.ts
import { formatMediaSize } from "./roomMedia";

/** Structural shape of a shared file. Kept structural (not `File`) so the
 *  helper stays pure and testable — same approach as sharePayload's unknown[]. */
export type ShareFileLike = {
    name?: string | null;
    size?: number | null;
    type?: string | null;
};

export type ShareFileRow = {
    name: string;
    sizeLabel: string;
    isImage: boolean;
};

/** Build display rows for the share sheet's file-preview list: a filename, a
 *  human size label (empty when unknown), and whether it is an image (drives
 *  the thumbnail). */
export function shareFileRows(files: readonly ShareFileLike[]): ShareFileRow[] {
    return files.map((f) => ({
        name: (f.name ?? "").trim() || "file",
        sizeLabel: formatMediaSize(f.size),
        isImage: typeof f.type === "string" && f.type.startsWith("image/"),
    }));
}
