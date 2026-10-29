const ALPHABET =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const NAME_LENGTH = 16;

/** Everything from the first dot that looks like an extension chain, so
 *  `a.tar.gz` keeps `.tar.gz`. */
function extensionOf(name: string): string {
    // A leading dot (".bashrc") is part of the name, not an extension.
    const dot = name.indexOf(".", 1);
    if (dot === -1) return "";
    const ext = name.slice(dot);
    // Keep only sane trailing segments, so "My Photo. Final copy.jpg" does not
    // carry its whole sentence into the new name.
    const segments = ext.split(".").slice(1);
    const kept: string[] = [];
    for (let i = segments.length - 1; i >= 0; i--) {
        if (!/^[A-Za-z0-9_-]{1,10}$/.test(segments[i])) break;
        kept.unshift(segments[i]);
    }
    return kept.length ? "." + kept.join(".") : "";
}

function randomAlphanumeric(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = "";
    // 256 % 62 != 0, so reject the biased tail.
    for (const b of bytes) {
        if (b < 248) out += ALPHABET[b % 62];
        else out += ALPHABET[Math.floor(Math.random() * 62)];
    }
    return out;
}

/** Random alphanumeric file name with the original extension(s) kept. */
export function randomizeFileName(name: string): string {
    return randomAlphanumeric(NAME_LENGTH) + extensionOf(name);
}

/** The same file under a randomized name. */
export function withRandomFileName(file: File): File {
    return new File([file], randomizeFileName(file.name), {
        type: file.type,
        lastModified: file.lastModified,
    });
}
