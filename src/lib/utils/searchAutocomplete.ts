import type { HasFilter } from "./messageSearch";

export interface ActiveSearchToken {
    kind: "operator" | "from" | "has";
    query: string;
    start: number;
    end: number;
}

const HAS_VALUES: readonly HasFilter[] = [
    "image",
    "video",
    "file",
    "audio",
    "voice",
    "link",
];

export const SEARCH_OPERATORS: readonly string[] = ["from:", "has:"];

/** The whitespace-delimited token under the caret, classified as an operator
 *  the dropdown can complete, or null if the caret isn't inside a completable
 *  token (whitespace, a plain word, a URL, or an unowned `key:`). */
export function activeSearchToken(
    input: string,
    caret: number,
): ActiveSearchToken | null {
    const c = Math.max(0, Math.min(caret, input.length));
    // Expand to the token bounds around the caret.
    let start = c;
    while (start > 0 && !/\s/.test(input[start - 1])) start--;
    let end = c;
    while (end < input.length && !/\s/.test(input[end])) end++;
    if (start === end) return null; // caret sits in whitespace / empty input
    const token = input.slice(start, end);
    const from = /^from:(.*)$/i.exec(token);
    if (from) return { kind: "from", query: from[1].toLowerCase(), start, end };
    const has = /^has:(.*)$/i.exec(token);
    if (has) return { kind: "has", query: has[1].toLowerCase(), start, end };
    if (!token.includes(":")) {
        const low = token.toLowerCase();
        if ("from".startsWith(low) || "has".startsWith(low)) {
            return { kind: "operator", query: low, start, end };
        }
    }
    return null;
}

export interface MemberLite {
    userId: string;
    displayName: string;
}

export function filterMemberSuggestions(
    members: MemberLite[],
    query: string,
    limit = 8,
): MemberLite[] {
    const q = query.toLowerCase();
    return members
        .filter(
            (m) =>
                m.userId.toLowerCase().includes(q) ||
                m.displayName.toLowerCase().includes(q),
        )
        .slice(0, limit);
}

export function hasValueSuggestions(query: string): HasFilter[] {
    const q = query.toLowerCase();
    return HAS_VALUES.filter((v) => v.startsWith(q));
}

export function operatorSuggestions(query: string): string[] {
    const q = query.toLowerCase();
    return SEARCH_OPERATORS.filter((op) => op.startsWith(q));
}

/** Replace the active token with `completion` plus a trailing space; the caret
 *  lands after the space so the user can keep typing. */
export function applySuggestion(
    input: string,
    token: ActiveSearchToken,
    completion: string,
): { text: string; caret: number } {
    const text =
        input.slice(0, token.start) + completion + " " + input.slice(token.end);
    return { text, caret: token.start + completion.length + 1 };
}
