/**
 * Inline timestamps: a Discord-compatible `<t:UNIX_SECONDS>` or
 * `<t:UNIX_SECONDS:STYLE>` typed in the composer goes out as an absolute
 * instant that every reader sees in their own time zone and locale.
 *
 * Send side (pure): the token becomes a readable UTC fallback in `body` and a
 * `<time datetime data-zam-ts-style>` element in `formatted_body`, so clients
 * that do not know the element still show the fallback text.
 *
 * Receive side (pure): a sanitized `<time datetime>` is rewritten to the
 * viewer's localized text. Relative (`R`) output carries the unix time so a
 * shared ticker can refresh it (see actions/relativeTimestamps.ts).
 *
 * No regex lookbehind (old WebViews), no DOM, no SDK.
 */

export const TIMESTAMP_STYLES = ["t", "T", "d", "D", "f", "F", "R"] as const;
export type TimestampStyle = (typeof TIMESTAMP_STYLES)[number];
export const DEFAULT_TIMESTAMP_STYLE: TimestampStyle = "f";

/** Source of the token pattern: unix seconds (up to 13 digits), optional style. */
const TOKEN_SOURCE = "<t:(-?\\d{1,13})(?::([tTdDfFR]))?>";

/** Earliest and latest instants whose ISO form has a four-digit year. */
const MIN_UNIX_SECONDS = Date.UTC(1, 0, 1) / 1000;
const MAX_UNIX_SECONDS = Date.UTC(9999, 11, 31, 23, 59, 59) / 1000;

/** Class on the viewer-side pill; Tailwind scans this file for the utilities. */
export const TIMESTAMP_PILL_CLASS =
    "inline-block rounded px-1 bg-zam-backgroundTertiary";

export interface InlineTimestampToken {
    seconds: number;
    style: TimestampStyle;
}

export function isTimestampStyle(value: unknown): value is TimestampStyle {
    return (
        typeof value === "string" &&
        (TIMESTAMP_STYLES as readonly string[]).includes(value)
    );
}

export function isValidUnixSeconds(seconds: number): boolean {
    return (
        Number.isSafeInteger(seconds) &&
        seconds >= MIN_UNIX_SECONDS &&
        seconds <= MAX_UNIX_SECONDS
    );
}

/** A fresh global pattern (callers may keep lastIndex state). */
export function timestampTokenPattern(): RegExp {
    return new RegExp(TOKEN_SOURCE, "g");
}

/** Parse one complete token such as `<t:1700000000:F>`, or null. */
export function parseInlineTimestamp(
    token: string,
): InlineTimestampToken | null {
    const m = new RegExp(`^${TOKEN_SOURCE}$`).exec(token);
    if (!m) return null;
    const seconds = Number(m[1]);
    if (!isValidUnixSeconds(seconds)) return null;
    const style = isTimestampStyle(m[2]) ? m[2] : DEFAULT_TIMESTAMP_STYLE;
    return { seconds, style };
}

/** The token the composer inserts for a picked instant. */
export function buildInlineTimestampToken(
    seconds: number,
    style: TimestampStyle,
): string {
    return `<t:${seconds}:${style}>`;
}

/** `2026-11-20T14:00:00Z`, the `datetime` attribute value. */
export function inlineTimestampIso(seconds: number): string | null {
    if (!isValidUnixSeconds(seconds)) return null;
    return new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
}

/** Readable UTC text sent in `body` and inside the `<time>` element. */
export function inlineTimestampFallback(seconds: number): string | null {
    const iso = inlineTimestampIso(seconds);
    if (!iso) return null;
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/**
 * The `<time>` element the sender puts in formatted_body. `style` outside the
 * known set falls back to the default. Null for a value that is not a date.
 */
export function inlineTimestampHtml(
    seconds: number,
    style?: string,
): string | null {
    const iso = inlineTimestampIso(seconds);
    const fallback = inlineTimestampFallback(seconds);
    if (!iso || !fallback) return null;
    const s = isTimestampStyle(style) ? style : DEFAULT_TIMESTAMP_STYLE;
    return `<time datetime="${iso}" data-zam-ts-style="${s}">${fallback}</time>`;
}

/**
 * Plain-text body for a message: every valid token outside code becomes its
 * UTC fallback. Tokens in inline code spans or fenced blocks stay literal, as
 * do invalid tokens. Mirrors the code detection in markdown.ts.
 */
export function convertInlineTimestampsInBody(plain: string): string {
    if (!plain.includes("<t:")) return plain;
    const pattern = new RegExp(`(\`[^\`\\n]+\`)|${TOKEN_SOURCE}`, "g");
    let inFence = false;
    return plain
        .split("\n")
        .map((line) => {
            const fenceLine = line.trimStart().startsWith("```");
            if (inFence) {
                if (fenceLine) inFence = false;
                return line;
            }
            // A backslash-escaped marker is not a fence (same rule as markdown.ts).
            if (fenceLine && !/^\\[>`#\-]/.test(line)) {
                inFence = true;
                return line;
            }
            return line.replace(
                pattern,
                (whole: string, code: string | undefined, secs: string) => {
                    if (code !== undefined) return whole;
                    const fallback = inlineTimestampFallback(Number(secs));
                    return fallback ?? whole;
                },
            );
        })
        .join("\n");
}

/** Absolute styles → Intl options (time zone is the viewer's own). */
export function timestampIntlOptions(
    style: Exclude<TimestampStyle, "R">,
): Intl.DateTimeFormatOptions {
    switch (style) {
        case "t":
            return { hour: "numeric", minute: "2-digit" };
        case "T":
            return { hour: "numeric", minute: "2-digit", second: "2-digit" };
        case "d":
            return { year: "numeric", month: "numeric", day: "numeric" };
        case "D":
            return { year: "numeric", month: "long", day: "numeric" };
        case "F":
            return {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            };
        case "f":
            return {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            };
    }
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
];

/** Largest sensible unit for a signed difference in seconds (future > 0). */
export function relativeTimeParts(diffSeconds: number): {
    value: number;
    unit: Intl.RelativeTimeFormatUnit;
} {
    const abs = Math.abs(diffSeconds);
    const [unit, size] =
        RELATIVE_UNITS.find(([, s]) => abs >= s) ??
        RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
    return { value: Math.round(diffSeconds / size), unit };
}

/** Localized text for one instant, or null when it is not a date. */
export function formatInlineTimestamp(
    seconds: number,
    style: TimestampStyle,
    locale: string | undefined,
    nowMs: number,
): { text: string; title: string; iso: string } | null {
    const iso = inlineTimestampIso(seconds);
    if (!iso) return null;
    const date = new Date(seconds * 1000);
    const title = new Intl.DateTimeFormat(
        locale,
        timestampIntlOptions("F"),
    ).format(date);
    let text: string;
    if (style === "R") {
        const { value, unit } = relativeTimeParts(seconds - nowMs / 1000);
        text = new Intl.RelativeTimeFormat(locale, {
            numeric: "auto",
        }).format(value, unit);
    } else {
        text = new Intl.DateTimeFormat(
            locale,
            timestampIntlOptions(style),
        ).format(date);
    }
    return { text, title, iso };
}

function escapeText(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Rewrite each sanitized `<time datetime>` into the viewer's localized pill.
 * The output is built only from the parsed instant and fixed attributes, so
 * remote markup never reaches the result. Elements whose datetime is not a
 * date are returned unchanged.
 */
export function renderInlineTimestampsHtml(
    html: string,
    locale: string | undefined,
    nowMs: number,
): string {
    if (!/<time\b/i.test(html)) return html;
    return html.replace(
        /<time\b([^>]*)>([\s\S]*?)<\/time>/gi,
        (whole: string, attrs: string) => {
            const dt = /\bdatetime="([^"]*)"/i.exec(attrs)?.[1];
            if (dt === undefined) return whole;
            const ms = Date.parse(dt);
            if (Number.isNaN(ms)) return whole;
            const seconds = Math.floor(ms / 1000);
            const rawStyle = /\bdata-zam-ts-style="([^"]*)"/i.exec(attrs)?.[1];
            const style = isTimestampStyle(rawStyle)
                ? rawStyle
                : DEFAULT_TIMESTAMP_STYLE;
            const out = formatInlineTimestamp(seconds, style, locale, nowMs);
            if (!out) return whole;
            const rel =
                style === "R"
                    ? ` data-zam-ts-unix="${seconds}" data-zam-ts-rel=""`
                    : "";
            return `<time datetime="${out.iso}" data-zam-ts-style="${style}" title="${escapeText(out.title)}" class="${TIMESTAMP_PILL_CLASS}"${rel}>${escapeText(out.text)}</time>`;
        },
    );
}

/**
 * The composer's date picker value (`YYYY-MM-DDTHH:MM`, local time) as unix
 * seconds, or null when it is not a real calendar moment.
 */
export function localDateTimeToUnix(value: string): number | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const d = new Date(year, month - 1, day, Number(m[4]), Number(m[5]));
    if (
        d.getFullYear() !== year ||
        d.getMonth() !== month - 1 ||
        d.getDate() !== day
    )
        return null;
    const seconds = Math.floor(d.getTime() / 1000);
    return isValidUnixSeconds(seconds) ? seconds : null;
}

/** `YYYY-MM-DDTHH:MM` in local time, for a picker's default value. */
export function unixToLocalDateTimeValue(seconds: number): string {
    const d = new Date(seconds * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Inverse of the send-side body conversion, for editing. Each Zam
 * `<time data-zam-ts-style>` in formatted_body whose UTC text still appears in
 * the plain body is put back as its `<t:N:S>` token (first occurrence each).
 * Elements without the Zam style, or with an unusable datetime, are skipped.
 */
export function restoreInlineTimestampTokens(
    body: string,
    formattedBody: string | null | undefined,
): string {
    if (!formattedBody || !/<time\b/i.test(formattedBody)) return body;
    let out = body;
    for (const [, attrs, inner] of formattedBody.matchAll(
        /<time\b([^>]*)>([\s\S]*?)<\/time>/gi,
    )) {
        const style = /\bdata-zam-ts-style="([^"]*)"/i.exec(attrs)?.[1];
        const dt = /\bdatetime="([^"]*)"/i.exec(attrs)?.[1];
        if (!isTimestampStyle(style) || dt === undefined) continue;
        const ms = Date.parse(dt);
        if (Number.isNaN(ms)) continue;
        const seconds = Math.floor(ms / 1000);
        if (!isValidUnixSeconds(seconds)) continue;
        const text = inner.replace(/<[^>]*>/g, "");
        if (!text || !out.includes(text)) continue;
        out = out.replace(text, buildInlineTimestampToken(seconds, style));
    }
    return out;
}
