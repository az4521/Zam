// `s/old/new/` in the composer: edit your last message instead of sending.
//
// Literal text, not a regex: what people type here is a typo fix, and `.` or
// `(` matching anything but itself would surprise. Flags: `g` replaces every
// occurrence (default: the first), `i` ignores case. The trailing slash is
// optional. Inside either part `\/` is a slash, `\\` a backslash and `\n` a
// line break. Zero SDK/DOM imports.

export interface SedCommand {
    pattern: string;
    replacement: string;
    global: boolean;
    ignoreCase: boolean;
}

const PART = String.raw`((?:\\[\s\S]|[^\\/])*)`;
const SED_RE = new RegExp(String.raw`^s/${PART}/${PART}(?:/([gi]*))?$`);

function unescapePart(s: string): string {
    return s.replace(/\\([\s\S])/g, (all, c: string) =>
        c === "/" || c === "\\" ? c : c === "n" ? "\n" : all,
    );
}

/**
 * The command `text` spells, or null when it is an ordinary message: anything
 * not starting with `s/`, an empty pattern, unknown flags, or trailing text.
 */
export function parseSedCommand(text: string): SedCommand | null {
    const m = SED_RE.exec(text.trim());
    if (!m) return null;
    const pattern = unescapePart(m[1]);
    if (!pattern) return null;
    const flags = m[3] ?? "";
    return {
        pattern,
        replacement: unescapePart(m[2]),
        global: flags.includes("g"),
        ignoreCase: flags.includes("i"),
    };
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `body` with the substitution applied, or null when the pattern is absent. */
export function applySedCommand(body: string, cmd: SedCommand): string | null {
    const re = new RegExp(
        escapeRegExp(cmd.pattern),
        (cmd.global ? "g" : "") + (cmd.ignoreCase ? "i" : ""),
    );
    if (!re.test(body)) return null;
    re.lastIndex = 0;
    // A function, so `$&` and friends in the replacement stay literal.
    return body.replace(re, () => cmd.replacement);
}
