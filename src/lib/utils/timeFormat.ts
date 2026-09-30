// Centralized, configurable timestamp formatting. Pure core (functions take
// explicit opts — unit-tested); the store-reading wrappers below are what
// components call. Reading settingsState inside a wrapper is deliberate: the
// $state read is tracked through the call during template evaluation, so every
// timestamp re-renders live when a format setting changes.

import { format } from "date-fns";
import { t } from "$lib/i18n";
import { dateFnsLocale } from "$lib/i18n/dateLocale";
import { settingsState } from "$lib/stores/settings.svelte";

export type TimeClock = "12h" | "24h";
export type DateStyle = "default" | "iso" | "dmy" | "mdy" | "custom";

export interface TimeFormatOpts {
    timeClock: TimeClock;
    dateStyle: DateStyle;
    customDatePattern: string;
    alwaysAbsolute: boolean;
    now: Date;
}

// The default-style date pattern each surface would use — passed in so that
// `dateStyle: "default"` preserves each surface's current look, while any other
// style renders dates uniformly across the whole app.
const OLDER_MSG_DATE = "yyyy/MM/dd";
// Word-based patterns come from the catalogue: other languages order day and
// month differently ("EEEE, d MMMM yyyy").
const SEPARATOR_DATE = t("timeFormat.separatorDatePattern");
const MONTH_DAY_DATE = t("timeFormat.monthDayPattern");

// Normalize a persisted/hand-edited value; unknown → default. These are called
// by the settings store while it initializes, which (via the settingsState
// import below) runs during this module's own evaluation in the import cycle —
// so they must be self-contained (no module-level const/let, which would be in
// the temporal dead zone at that point).
export function normalizeTimeClock(v: string | null): TimeClock {
    return v === "24h" ? "24h" : "12h";
}

export function normalizeDateStyle(v: string | null): DateStyle {
    return v === "iso" ||
        v === "dmy" ||
        v === "mdy" ||
        v === "custom" ||
        v === "default"
        ? v
        : "default";
}

/** date-fns format that never throws: a bad pattern falls back to `fallbackPattern`. */
export function safeFormat(
    ts: Date | number,
    pattern: string,
    fallbackPattern: string,
): string {
    try {
        return format(ts, pattern, { locale: dateFnsLocale() });
    } catch {
        return format(ts, fallbackPattern, { locale: dateFnsLocale() });
    }
}

/**
 * Render a custom date pattern against `now` for the settings live preview,
 * or null if the pattern is empty or date-fns rejects it (e.g. `YYYY`/`DD`).
 */
export function previewDatePattern(
    pattern: string,
    now: Date = new Date(),
): string | null {
    if (!pattern.trim()) return null;
    try {
        return format(now, pattern, { locale: dateFnsLocale() });
    } catch {
        return null;
    }
}

export function timePart(ts: number, opts: TimeFormatOpts): string {
    return format(ts, opts.timeClock === "24h" ? "HH:mm" : "h:mm a", {
        locale: dateFnsLocale(),
    });
}

function stylePattern(opts: TimeFormatOpts, defaultPattern: string): string {
    switch (opts.dateStyle) {
        case "iso":
            return "yyyy-MM-dd";
        case "dmy":
            return "dd/MM/yyyy";
        case "mdy":
            return "MM/dd/yyyy";
        case "custom":
            return opts.customDatePattern;
        default:
            return defaultPattern;
    }
}

export function datePart(
    ts: number,
    opts: TimeFormatOpts,
    defaultPattern: string,
): string {
    return safeFormat(ts, stylePattern(opts, defaultPattern), defaultPattern);
}

function isSameDay(a: Date, b: Date): boolean {
    return a.toDateString() === b.toDateString();
}

function dayCategory(ts: number, now: Date): "today" | "yesterday" | "older" {
    const d = new Date(ts);
    if (isSameDay(d, now)) return "today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(d, yesterday)) return "yesterday";
    return "older";
}

/** Message header/inline timestamp. */
export function formatMessageTimestamp(
    ts: number,
    opts: TimeFormatOpts,
): string {
    const time = timePart(ts, opts);
    if (opts.alwaysAbsolute)
        return datePart(ts, opts, OLDER_MSG_DATE) + " " + time;
    const cat = dayCategory(ts, opts.now);
    if (cat === "today") return time;
    if (cat === "yesterday") return t("timeFormat.yesterdayAt", { time });
    return datePart(ts, opts, OLDER_MSG_DATE) + " " + time;
}

/** Timeline date-separator label. */
export function formatDaySeparator(ts: number, opts: TimeFormatOpts): string {
    if (!opts.alwaysAbsolute) {
        const cat = dayCategory(ts, opts.now);
        if (cat === "today") return t("timeFormat.today");
        if (cat === "yesterday") return t("timeFormat.yesterday");
    }
    return datePart(ts, opts, SEPARATOR_DATE);
}

/** Compact "date, time" for search results and the notifications inbox. */
export function formatCompactDateTime(
    ts: number,
    opts: TimeFormatOpts,
): string {
    return t("timeFormat.compactDateTime", {
        date: datePart(ts, opts, MONTH_DAY_DATE),
        time: timePart(ts, opts),
    });
}

/** Date-only surfaces (pinned "MMM d", sessions "MMM d, yyyy"). */
export function formatDateOnly(
    ts: number,
    opts: TimeFormatOpts,
    defaultPattern: string,
): string {
    return datePart(ts, opts, defaultPattern);
}

/** Full absolute date + time for the message hover tooltip. */
export function formatFullTimestamp(ts: number, opts: TimeFormatOpts): string {
    return datePart(ts, opts, SEPARATOR_DATE) + " " + timePart(ts, opts);
}

// ── Live wrappers ──────────────────────────────────────────────────────────
// What components call. Read settingsState (tracked → live re-render) and
// delegate to the pure formatters above.

function currentOpts(now: Date = new Date()): TimeFormatOpts {
    return {
        timeClock: settingsState.timeClock,
        dateStyle: settingsState.dateStyle,
        customDatePattern: settingsState.customDatePattern,
        alwaysAbsolute: settingsState.alwaysAbsolute,
        now,
    };
}

/** Message header timestamp (today→time, yesterday→"Yesterday at …", older→date+time). */
export function messageTimestamp(ts: number): string {
    return formatMessageTimestamp(ts, currentOpts());
}

/** Just the time — inline hover time on grouped messages, thread panel. */
export function timeOnly(ts: number): string {
    return timePart(ts, currentOpts());
}

export function daySeparator(ts: number, now: Date = new Date()): string {
    return formatDaySeparator(ts, currentOpts(now));
}

export function compactDateTime(ts: number): string {
    return formatCompactDateTime(ts, currentOpts());
}

export function pinnedDate(ts: number): string {
    return formatDateOnly(ts, currentOpts(), MONTH_DAY_DATE);
}

/** Full absolute date + time — the message hover tooltip. */
export function fullTimestamp(ts: number): string {
    return formatFullTimestamp(ts, currentOpts());
}
