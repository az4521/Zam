// UI string lookup. Every user-facing string lives in `./en.ts` (the source
// catalogue); each other language is a file in `./locales/` keyed by the same
// ids, listed in `./manifest.ts`, and falls back to English for anything it
// lacks.
//
// Only the active language is downloaded: `initI18n()` (awaited by the
// client `init` hook before any route module loads) fetches its catalogue.
// The language then stays fixed for the page's lifetime; switching persists
// the choice and reloads, as Element does. That keeps `t()` a plain function
// that is safe to call anywhere, including module-level constants.

import type { Locale as DateFnsLocale } from "date-fns";
import { en, type MessageKey } from "./en";
import {
    DEFAULT_LOCALE,
    LOCALES,
    type Locale,
    type LocaleInfo,
} from "./manifest";

export type { MessageKey, Locale, LocaleInfo };
export { LOCALES };

/** Calendar names for languages date-fns has no locale for. */
export interface DateNames {
    /** January first. */
    months: readonly string[];
    /** Sunday first. */
    days: readonly string[];
    am: string;
    pm: string;
}

/** What a `./locales/<code>.ts` module default-exports. */
export interface LocaleCatalogue {
    messages: Partial<Record<MessageKey, string>>;
    /** date-fns' own locale, for languages it ships (import it in the catalogue). */
    dateLocale?: DateFnsLocale;
    /** Otherwise, calendar names to build one from (see ./dateLocale.ts). */
    dates?: DateNames;
}

export const LOCALE_STORAGE_KEY = "settings:locale";
// Read by the inline script in app.html to set <html dir> before first paint.
const DIR_STORAGE_KEY = "settings:localeDir";

const loaders = import.meta.glob<{ default: LocaleCatalogue }>(
    "./locales/*.ts",
);

/** Map any language tag (stored, OS, browser) to a supported locale. */
export function normalizeLocale(v: string | null | undefined): Locale | null {
    if (!v) return null;
    const tag = v.toLowerCase();
    const matches = (base: string) =>
        tag === base || tag.startsWith(base + "-");
    for (const l of LOCALES as readonly LocaleInfo[]) {
        if (matches(l.code) || l.aliases?.some(matches))
            return l.code as Locale;
    }
    return null;
}

/** The stored choice, else the first supported browser language. */
export function detectLocale(): Locale {
    try {
        const stored = normalizeLocale(
            globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY),
        );
        if (stored) return stored;
    } catch {
        /* storage blocked */
    }
    try {
        for (const lang of globalThis.navigator?.languages ?? []) {
            const hit = normalizeLocale(lang);
            if (hit) return hit;
        }
    } catch {
        /* no navigator */
    }
    return DEFAULT_LOCALE;
}

let current: Locale = DEFAULT_LOCALE;
let catalogue: LocaleCatalogue = { messages: en };
let pluralRules: Intl.PluralRules | null = new Intl.PluralRules("en");

function activate(code: Locale, cat: LocaleCatalogue): void {
    current = code;
    catalogue = cat;
    const info = localeInfo(code);
    try {
        pluralRules = new Intl.PluralRules(info.plural ?? info.intl ?? code);
    } catch {
        pluralRules = null;
    }
}

/**
 * Load the active language's catalogue. Failure (offline with an uncached
 * chunk, a missing file) leaves the app in English rather than blocking
 * startup.
 */
export async function initI18n(code: Locale = detectLocale()): Promise<void> {
    if (code === DEFAULT_LOCALE) {
        activate(DEFAULT_LOCALE, { messages: en });
    } else if (code !== current) {
        try {
            const load = loaders[`./locales/${code}.ts`];
            if (!load) throw new Error(`no catalogue for "${code}"`);
            activate(code, (await load()).default);
        } catch (e) {
            console.error("[i18n] falling back to English:", e);
            activate(DEFAULT_LOCALE, { messages: en });
        }
    }
    applyDocumentLocale();
}

export function getLocale(): Locale {
    return current;
}

export function localeInfo(code: string = current): LocaleInfo {
    return (
        (LOCALES as readonly LocaleInfo[]).find((l) => l.code === code) ??
        LOCALES[0]
    );
}

export function isRtl(): boolean {
    return localeInfo().dir === "rtl";
}

/** Locale to hand to `Intl` / `toLocaleString` (see `LocaleInfo.intl`). */
export function intlLocale(): string | undefined {
    if (current === DEFAULT_LOCALE) return undefined;
    return localeInfo().intl ?? current;
}

/** Calendar names supplied by the active catalogue, if any. */
export function dateNames(): DateNames | undefined {
    return catalogue.dates;
}

/** A date-fns locale supplied by the active catalogue, if any. */
export function catalogueDateLocale(): DateFnsLocale | undefined {
    return catalogue.dateLocale;
}

/** Persist a new language and reload so every string picks it up. */
export function setLocale(code: Locale): void {
    try {
        localStorage.setItem(LOCALE_STORAGE_KEY, code);
        localStorage.setItem(DIR_STORAGE_KEY, localeInfo(code).dir);
    } catch {
        return; // storage blocked: the choice could not survive a reload
    }
    if (code === current) return;
    try {
        location.reload();
    } catch {
        /* not in a browser */
    }
}

/** Test hook: switch the in-memory locale without touching storage. */
export function _setLocaleForTests(
    code: Locale,
    cat: LocaleCatalogue = { messages: en },
): void {
    activate(code, cat);
}

/** Mirror the active locale onto <html lang dir> (and app.html's cache). */
export function applyDocumentLocale(): void {
    if (typeof document === "undefined") return;
    const info = localeInfo();
    document.documentElement.lang = info.code;
    document.documentElement.dir = info.dir;
    try {
        localStorage.setItem(DIR_STORAGE_KEY, info.dir);
    } catch {
        /* storage blocked */
    }
}

export type MessageParams = Record<string, string | number | null | undefined>;

// Index just past the `}` closing the `{` at `open`.
function matchBrace(s: string, open: number): number {
    let depth = 0;
    for (let i = open; i < s.length; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}" && --depth === 0) return i + 1;
    }
    return s.length;
}

// `{count, plural, =0 {...} one {...} few {...} other {...}}`: ICU plural
// syntax, with the category chosen by the language's own plural rules
// (zero/one/two/few/many/other), so languages with richer plural systems
// than English need no code changes, just more branches in their catalogue.
function formatPlurals(msg: string, params: MessageParams): string {
    let out = "";
    let i = 0;
    const open = /\{(\w+),\s*plural,/g;
    let m: RegExpExecArray | null;
    while ((m = open.exec(msg))) {
        const end = matchBrace(msg, m.index);
        const body = msg.slice(m.index + m[0].length, end - 1);
        const n = Number(params[m[1]] ?? 0);
        const options = new Map<string, string>();
        const opt = /\s*(=\d+|\w+)\s*\{/g;
        let o: RegExpExecArray | null;
        while ((o = opt.exec(body))) {
            const optOpen = o.index + o[0].length - 1;
            const optEnd = matchBrace(body, optOpen);
            options.set(o[1], body.slice(optOpen + 1, optEnd - 1));
            opt.lastIndex = optEnd;
        }
        const category = pluralRules?.select(n) ?? (n === 1 ? "one" : "other");
        const chosen =
            options.get(`=${n}`) ??
            options.get(category) ??
            options.get("other") ??
            "";
        out += msg.slice(i, m.index) + chosen.replace(/#/g, String(n));
        i = end;
        open.lastIndex = end;
    }
    return out + msg.slice(i);
}

/**
 * Look up a UI string. `{name}` placeholders are filled from `params`; a
 * placeholder with no matching param is left as-is so the gap is visible.
 */
export function t(key: MessageKey, params?: MessageParams): string {
    let msg = catalogue.messages[key] ?? en[key] ?? key;
    if (!params) return msg;
    if (msg.includes(", plural,")) msg = formatPlurals(msg, params);
    return msg.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const v = params[name];
        return v === undefined || v === null ? whole : String(v);
    });
}
