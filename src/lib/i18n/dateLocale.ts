// date-fns locale for the active UI language. A catalogue for a language
// date-fns ships (French, German, ...) hands over that locale as
// `dateLocale`. One for a language date-fns lacks, like Suret, supplies
// `dates` (month, weekday and day-period names) instead, and gets a locale
// built from en-US's format-length tables with those names swapped in.
// English uses date-fns' default.

import type { Locale } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import {
    catalogueDateLocale,
    dateNames,
    getLocale,
    type DateNames,
} from "./index";

const PM_PERIODS = new Set(["pm", "afternoon", "evening", "night"]);

export function buildDateLocale(code: string, names: DateNames): Locale {
    return {
        ...enUS,
        code,
        localize: {
            ...enUS.localize,
            ordinalNumber: (n) => String(n),
            month: (m) => names.months[Number(m)],
            day: (d) => names.days[Number(d)],
            dayPeriod: (p) => (PM_PERIODS.has(p) ? names.pm : names.am),
        },
        options: { weekStartsOn: 0, firstWeekContainsDate: 1 },
    };
}

/**
 * The same locale with AM/PM in place of dotted Latin-script day periods
 * (German "vorm."/"nachm.", Spanish-style "a. m."/"p. m."), which read badly
 * next to a time. Day periods in another script (午前, Suret's) are kept.
 */
export function withPlainDayPeriods(locale: Locale): Locale {
    const dayPeriod = locale.localize.dayPeriod;
    return {
        ...locale,
        localize: {
            ...locale.localize,
            dayPeriod: (p, options) => {
                const name = dayPeriod(p, options);
                return name.includes(".") &&
                    /^[\p{Script=Latin}.\s]+$/u.test(name)
                    ? PM_PERIODS.has(p)
                        ? "PM"
                        : "AM"
                    : name;
            },
        },
    };
}

let cached: { code: string; locale: Locale | undefined } | null = null;

const withCatalogue = (l: Locale | undefined) =>
    l ? withPlainDayPeriods(l) : undefined;

/** The `locale` option to pass to date-fns `format` for the active language. */
export function dateFnsLocale(): Locale | undefined {
    const code = getLocale();
    if (cached?.code !== code) {
        const names = dateNames();
        cached = {
            code,
            locale:
                withCatalogue(catalogueDateLocale()) ??
                (names ? buildDateLocale(code, names) : undefined),
        };
    }
    return cached.locale;
}
