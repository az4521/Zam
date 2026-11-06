/**
 * `<t:UNIX>` / `<t:UNIX:STYLE>` in a message body, rendered as a `<time>` in
 * the viewer's own time zone and locale (the sender's wall clock is irrelevant:
 * the number is an absolute instant).
 *
 * Styles follow Discord's: t/T short/long time, d/D short/long date, f/F
 * short/long date-time, R relative. `f` is the default.
 */

const FORMATS: Record<string, Intl.DateTimeFormatOptions> = {
    t: { timeStyle: "short" },
    T: { timeStyle: "medium" },
    d: { dateStyle: "short" },
    D: { dateStyle: "long" },
    f: { dateStyle: "long", timeStyle: "short" },
    F: { dateStyle: "full", timeStyle: "short" },
};

// Plain-text bodies are HTML-escaped before this runs, formatted bodies carry
// the escaped form too, so match the entities rather than raw angle brackets.
const TIMESTAMP_RE = /&lt;t:(-?\d{1,13})(?::([tTdDfFR]))?&gt;/g;

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
];

function formatRelative(date: Date, nowMs: number): string {
    const diffSec = Math.round((date.getTime() - nowMs) / 1000);
    const abs = Math.abs(diffSec);
    const [unit, size] =
        RELATIVE_UNITS.find(([, s]) => abs >= s) ??
        RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        Math.round(diffSec / size),
        unit,
    );
}

/** Format one timestamp, or null when the value is not a valid date. */
export function formatMessageTimestamp(
    unixSeconds: number,
    style = "f",
    nowMs = Date.now(),
): { text: string; full: string; iso: string } | null {
    const date = new Date(unixSeconds * 1000);
    if (Number.isNaN(date.getTime())) return null;
    const full = new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "long",
    }).format(date);
    const text =
        style === "R"
            ? formatRelative(date, nowMs)
            : new Intl.DateTimeFormat(
                  undefined,
                  FORMATS[style] ?? FORMATS.f,
              ).format(date);
    return { text, full, iso: date.toISOString() };
}

/**
 * Replace `<t:…>` in already-escaped message HTML. Like `highlightRoomMention`
 * it only touches text between tags and skips links and code.
 */
export function renderMessageTimestamps(html: string): string {
    if (!html.includes("&lt;t:")) return html;
    let skip = 0;
    return html.replace(
        /<(\/?)(a|code|pre)(?=[\s/>])[^>]*>|>?[^<]+/gi,
        (m, close) => {
            if (m.startsWith("<")) {
                if (close) skip = Math.max(0, skip - 1);
                else if (!m.endsWith("/>")) skip++;
                return m;
            }
            if (skip) return m;
            return m.replace(TIMESTAMP_RE, (whole, secs, style) => {
                const out = formatMessageTimestamp(Number(secs), style);
                return out
                    ? `<time datetime="${out.iso}" title="${out.full}">${out.text}</time>`
                    : whole;
            });
        },
    );
}
