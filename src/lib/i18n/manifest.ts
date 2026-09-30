// Every language the app can be shown in. Adding one takes two steps:
//   1. add an entry here;
//   2. add `./locales/<code>.ts` (see ./README.md). English lives in ../en.ts
//      and is the source catalogue every other language is translated from.
// Metadata only: catalogues are code-split and loaded on demand, so this list
// can grow without growing the bundle every user downloads.

export interface LocaleInfo {
    /** BCP 47 / ISO 639 code; also the catalogue's file name. */
    code: string;
    /** The language's own name for itself, shown in the picker. */
    nativeName: string;
    /** The language's name in English, shown alongside it. */
    englishName: string;
    dir: "ltr" | "rtl";
    /**
     * Locale handed to `Intl` / `toLocaleString` when it differs from `code`
     * (a language with no CLDR data of its own borrows a close one).
     * `undefined` for English keeps the browser's regional conventions.
     */
    intl?: string;
    /** Locale whose `Intl.PluralRules` to use, when `intl` has none. */
    plural?: string;
    /** Other language tags (from the OS / browser) that map to this one. */
    aliases?: readonly string[];
}

export const LOCALES = [
    {
        code: "en",
        nativeName: "English",
        englishName: "English",
        dir: "ltr",
    },
    {
        code: "aii",
        nativeName: "ܣܘܪܝܬ",
        englishName: "Assyrian Neo-Aramaic",
        dir: "rtl",
        // No CLDR locale for Suret: Syriac shares its script and calendar
        // names, and English its one/other plural split.
        intl: "syr",
        plural: "en",
        aliases: ["syr"],
    },
    {
        code: "fr",
        nativeName: "Français",
        englishName: "French",
        dir: "ltr",
    },
    {
        code: "de",
        nativeName: "Deutsch",
        englishName: "German",
        dir: "ltr",
    },
] as const satisfies readonly LocaleInfo[];

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";
