import { afterEach, describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { format } from "date-fns";
import { dateFnsLocale } from "./dateLocale";
import { en, type MessageKey } from "./en";
import { LOCALES } from "./manifest";
import {
    _setLocaleForTests,
    normalizeLocale,
    t,
    type LocaleCatalogue,
} from "./index";

const catalogues = import.meta.glob<{ default: LocaleCatalogue }>(
    "./locales/*.ts",
    { eager: true },
);

const byCode = new Map(
    Object.entries(catalogues).map(([path, mod]) => [
        path.replace(/^\.\/locales\/|\.ts$/g, ""),
        mod.default,
    ]),
);

// `{name}` placeholders and plural variables: the parts code relies on.
function placeholders(s: string): string[] {
    const names = new Set<string>();
    for (const m of s.matchAll(/\{(\w+)\}/g)) names.add(m[1]);
    for (const m of s.matchAll(/\{(\w+),\s*plural,/g)) names.add(m[1]);
    return [...names].sort();
}

afterEach(() => _setLocaleForTests("en"));

describe("locale manifest", () => {
    it("has a catalogue file for every non-English locale, and vice versa", () => {
        const files = readdirSync(join(__dirname, "locales"))
            .filter((f) => f.endsWith(".ts"))
            .map((f) => f.slice(0, -3))
            .sort();
        const listed = LOCALES.map((l) => l.code)
            .filter((c) => c !== "en")
            .sort();
        expect(files).toEqual(listed);
    });

    it("has unique codes", () => {
        const codes = LOCALES.map((l) => l.code);
        expect(new Set(codes).size).toBe(codes.length);
    });
});

describe.each([...byCode])("%s catalogue", (_code, catalogue) => {
    const entries = Object.entries(catalogue.messages) as [
        MessageKey,
        string,
    ][];

    it("uses only keys that exist in English", () => {
        const unknown = entries.map(([k]) => k).filter((k) => !(k in en));
        expect(unknown).toEqual([]);
    });

    it("keeps every string's placeholders", () => {
        const broken = entries
            .filter(
                ([k, v]) =>
                    placeholders(v).join() !== placeholders(en[k]).join(),
            )
            .map(([k]) => k);
        expect(broken).toEqual([]);
    });

    it("keeps plural messages plural, with an `other` branch", () => {
        const broken = entries
            .filter(([k, v]) => {
                const src = en[k].includes(", plural,");
                const tr = v.includes(", plural,");
                return src !== tr || (tr && !/\bother\s*\{/.test(v));
            })
            .map(([k]) => k);
        expect(broken).toEqual([]);
    });

    it("has no em dashes (the build rejects them)", () => {
        expect(entries.filter(([, v]) => v.includes("—"))).toEqual([]);
    });

    it("supplies 12 months and 7 weekdays when it supplies dates", () => {
        if (!catalogue.dates) return;
        expect(catalogue.dates.months).toHaveLength(12);
        expect(catalogue.dates.days).toHaveLength(7);
    });
});

describe("t()", () => {
    it("fills placeholders and leaves unknown ones visible", () => {
        expect(t("appShell.isCalling", { name: "Ashur" })).toBe(
            "Ashur is calling",
        );
        expect(t("appShell.isCalling")).toBe("{name} is calling");
    });

    it("picks plural branches with the language's rules", () => {
        expect(t("common.memberCount", { count: 1 })).toBe("1 member");
        expect(t("common.memberCount", { count: 3 })).toBe("3 members");
        expect(
            t("liveAnnouncer.newMessagesFrom", { count: 2, sender: "Ninos" }),
        ).toBe("2 new messages from Ninos");
    });

    it("uses exact-match and many-category branches", () => {
        _setLocaleForTests("en", {
            messages: {
                "common.memberCount":
                    "{count, plural, =0 {nobody} one {# one} other {# others}}",
            },
        });
        expect(t("common.memberCount", { count: 0 })).toBe("nobody");
        expect(t("common.memberCount", { count: 1 })).toBe("1 one");
        expect(t("common.memberCount", { count: 5 })).toBe("5 others");
    });

    it("falls back to English for a string a catalogue lacks", () => {
        _setLocaleForTests("aii", { messages: {} });
        expect(t("common.save")).toBe("Save");
    });

    it("uses the active catalogue", () => {
        const aii = byCode.get("aii");
        if (!aii) return;
        _setLocaleForTests("aii", aii);
        expect(t("common.save")).toBe(aii.messages["common.save"]);
    });
});

describe("date locales", () => {
    it("uses a catalogue's date-fns locale, or builds one from its names", () => {
        const jan = new Date(2026, 0, 5);
        const fr = byCode.get("fr");
        if (fr) {
            _setLocaleForTests("fr", fr);
            expect(format(jan, "MMMM", { locale: dateFnsLocale() })).toBe(
                "janvier",
            );
        }
        const aii = byCode.get("aii");
        if (aii?.dates) {
            _setLocaleForTests("aii", aii);
            expect(format(jan, "MMMM", { locale: dateFnsLocale() })).toBe(
                aii.dates.months[0],
            );
        }
        _setLocaleForTests("en");
        expect(dateFnsLocale()).toBeUndefined();
    });
});

describe("normalizeLocale", () => {
    it("maps codes, regional tags and aliases", () => {
        expect(normalizeLocale("en-GB")).toBe("en");
        expect(normalizeLocale("aii")).toBe("aii");
        expect(normalizeLocale("syr-SY")).toBe("aii");
        expect(normalizeLocale("fr-CA")).toBe("fr");
        expect(normalizeLocale("de-AT")).toBe("de");
        expect(normalizeLocale("xx")).toBeNull();
        expect(normalizeLocale("")).toBeNull();
    });
});
