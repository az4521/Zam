/**
 * Pure engine for the built-in text-replacer plugin (item 17). Folds an ordered
 * list of user-configured substitution rules over outgoing message text at send
 * time. Literal rules escape regex metacharacters and match case-(in)sensitively;
 * regex rules use the raw pattern (invalid patterns are skipped, never thrown).
 * The replacement is ALWAYS a pure literal string (function replacer), so `$1` /
 * `$&` / `$$` are never interpreted as backreferences — no surprises. Empty match
 * or empty rules array = identity. Pure — no SDK/DOM/localStorage imports.
 */

export interface ReplaceRule {
    match: string;
    replacement: string;
    isRegex: boolean;
    caseInsensitive: boolean;
}

/** Escape a literal string for safe insertion into a RegExp source. */
function escapeRegExp(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyReplacements(
    text: string,
    rules: readonly ReplaceRule[],
): string {
    let out = text;
    for (const r of rules) {
        if (typeof r.match !== "string" || r.match === "") continue;
        const replacement =
            typeof r.replacement === "string" ? r.replacement : "";
        const flags = r.caseInsensitive ? "gi" : "g";
        let re: RegExp;
        try {
            re = new RegExp(r.isRegex ? r.match : escapeRegExp(r.match), flags);
        } catch {
            continue; // invalid user regex — skip this rule, never throw
        }
        // Function replacer keeps `replacement` a pure literal (no $1/$& magic).
        out = out.replace(re, () => replacement);
    }
    return out;
}
