// Suggests a custom emoji shortcode from an image file name. The result is only
// a starting point: the user can edit it, and validateEmojiShortcode still runs
// on submit, so this only has to produce something close to valid.
export function shortcodeFromFileName(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    const base = dot > 0 ? fileName.slice(0, dot) : fileName;
    return base
        .replace(/[^A-Za-z0-9_.+-]+/g, "_")
        .replace(/^[_.]+|[_.]+$/g, "");
}
