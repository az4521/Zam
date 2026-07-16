import { describe, it, expect } from "vitest";
import {
    safeFormat,
    timePart,
    datePart,
    formatMessageTimestamp,
    formatDaySeparator,
    formatCompactDateTime,
    formatDateOnly,
    formatFullTimestamp,
    normalizeTimeClock,
    normalizeDateStyle,
    previewDatePattern,
    type TimeFormatOpts,
} from "./timeFormat";

// Fixed reference frame, built from local-time components so today/yesterday
// comparisons are stable regardless of the test runner's timezone.
const NOW = new Date(2026, 6, 16, 14, 30, 0); // Thu Jul 16 2026 14:30 local
const TODAY = new Date(2026, 6, 16, 9, 5, 0).getTime(); // same day 09:05
const YESTERDAY = new Date(2026, 6, 15, 9, 5, 0).getTime(); // Jul 15 09:05
const OLDER = new Date(2026, 3, 2, 9, 5, 0).getTime(); // Apr 2 2026 09:05

function opts(over: Partial<TimeFormatOpts> = {}): TimeFormatOpts {
    return {
        timeClock: "12h",
        dateStyle: "default",
        customDatePattern: "yyyy-MM-dd",
        alwaysAbsolute: false,
        now: NOW,
        ...over,
    };
}

describe("normalizeTimeClock", () => {
    it("accepts 24h", () => expect(normalizeTimeClock("24h")).toBe("24h"));
    it("accepts 12h", () => expect(normalizeTimeClock("12h")).toBe("12h"));
    it("defaults unknown/null to 12h", () => {
        expect(normalizeTimeClock(null)).toBe("12h");
        expect(normalizeTimeClock("bogus")).toBe("12h");
    });
});

describe("normalizeDateStyle", () => {
    it("accepts known styles", () => {
        expect(normalizeDateStyle("iso")).toBe("iso");
        expect(normalizeDateStyle("custom")).toBe("custom");
    });
    it("defaults unknown/null to default", () => {
        expect(normalizeDateStyle(null)).toBe("default");
        expect(normalizeDateStyle("YYYY")).toBe("default");
    });
});

describe("previewDatePattern", () => {
    it("renders a valid pattern against now", () => {
        expect(previewDatePattern("yyyy-MM-dd", NOW)).toBe("2026-07-16");
    });
    it("returns null for an invalid pattern", () => {
        expect(previewDatePattern("YYYY", NOW)).toBeNull();
    });
    it("returns null for an empty pattern", () => {
        expect(previewDatePattern("", NOW)).toBeNull();
    });
});

describe("safeFormat", () => {
    it("formats with the given pattern", () => {
        expect(safeFormat(OLDER, "yyyy-MM-dd", "yyyy")).toBe("2026-04-02");
    });
    it("falls back when the pattern throws (protected YYYY/DD tokens)", () => {
        expect(safeFormat(OLDER, "YYYY-MM-DD", "yyyy-MM-dd")).toBe(
            "2026-04-02",
        );
    });
});

describe("timePart", () => {
    it("12h clock", () => {
        expect(timePart(TODAY, opts({ timeClock: "12h" }))).toBe("9:05 AM");
    });
    it("24h clock", () => {
        expect(timePart(TODAY, opts({ timeClock: "24h" }))).toBe("09:05");
    });
});

describe("datePart", () => {
    it("default style uses the caller's default pattern", () => {
        expect(datePart(OLDER, opts({ dateStyle: "default" }), "MMM d")).toBe(
            "Apr 2",
        );
    });
    it("iso style overrides to yyyy-MM-dd", () => {
        expect(datePart(OLDER, opts({ dateStyle: "iso" }), "MMM d")).toBe(
            "2026-04-02",
        );
    });
    it("dmy style", () => {
        expect(datePart(OLDER, opts({ dateStyle: "dmy" }), "MMM d")).toBe(
            "02/04/2026",
        );
    });
    it("mdy style", () => {
        expect(datePart(OLDER, opts({ dateStyle: "mdy" }), "MMM d")).toBe(
            "04/02/2026",
        );
    });
    it("custom style uses the custom pattern", () => {
        expect(
            datePart(
                OLDER,
                opts({ dateStyle: "custom", customDatePattern: "dd.MM.yyyy" }),
                "MMM d",
            ),
        ).toBe("02.04.2026");
    });
    it("custom style with a throwing pattern falls back to the default pattern", () => {
        expect(
            datePart(
                OLDER,
                opts({ dateStyle: "custom", customDatePattern: "YYYY" }),
                "MMM d",
            ),
        ).toBe("Apr 2");
    });
});

describe("formatMessageTimestamp", () => {
    it("today → time only", () => {
        expect(formatMessageTimestamp(TODAY, opts())).toBe("9:05 AM");
    });
    it("yesterday → 'Yesterday at' + time", () => {
        expect(formatMessageTimestamp(YESTERDAY, opts())).toBe(
            "Yesterday at 9:05 AM",
        );
    });
    it("older → date + time (default yyyy/MM/dd)", () => {
        expect(formatMessageTimestamp(OLDER, opts())).toBe(
            "2026/04/02 9:05 AM",
        );
    });
    it("alwaysAbsolute → today shows date + time", () => {
        expect(
            formatMessageTimestamp(TODAY, opts({ alwaysAbsolute: true })),
        ).toBe("2026/07/16 9:05 AM");
    });
    it("alwaysAbsolute + iso + 24h", () => {
        expect(
            formatMessageTimestamp(
                YESTERDAY,
                opts({
                    alwaysAbsolute: true,
                    dateStyle: "iso",
                    timeClock: "24h",
                }),
            ),
        ).toBe("2026-07-15 09:05");
    });
});

describe("formatDaySeparator", () => {
    it("today → 'Today'", () => {
        expect(formatDaySeparator(TODAY, opts())).toBe("Today");
    });
    it("yesterday → 'Yesterday'", () => {
        expect(formatDaySeparator(YESTERDAY, opts())).toBe("Yesterday");
    });
    it("older default → verbose date", () => {
        expect(formatDaySeparator(OLDER, opts())).toContain("April 2, 2026");
    });
    it("older iso → yyyy-MM-dd", () => {
        expect(formatDaySeparator(OLDER, opts({ dateStyle: "iso" }))).toBe(
            "2026-04-02",
        );
    });
    it("alwaysAbsolute replaces Today with the date", () => {
        expect(
            formatDaySeparator(
                TODAY,
                opts({ alwaysAbsolute: true, dateStyle: "iso" }),
            ),
        ).toBe("2026-07-16");
    });
});

describe("formatCompactDateTime", () => {
    it("default 'MMM d' + time, 24h", () => {
        expect(formatCompactDateTime(OLDER, opts({ timeClock: "24h" }))).toBe(
            "Apr 2, 09:05",
        );
    });
    it("respects 12h (previously hardcoded 24h)", () => {
        expect(formatCompactDateTime(OLDER, opts({ timeClock: "12h" }))).toBe(
            "Apr 2, 9:05 AM",
        );
    });
});

describe("formatDateOnly", () => {
    it("pinned default 'MMM d'", () => {
        expect(formatDateOnly(OLDER, opts(), "MMM d")).toBe("Apr 2");
    });
    it("sessions default 'MMM d, yyyy'", () => {
        expect(formatDateOnly(OLDER, opts(), "MMM d, yyyy")).toBe(
            "Apr 2, 2026",
        );
    });
    it("iso overrides both", () => {
        expect(formatDateOnly(OLDER, opts({ dateStyle: "iso" }), "MMM d")).toBe(
            "2026-04-02",
        );
    });
});

describe("formatFullTimestamp", () => {
    it("verbose date + time for the hover tooltip", () => {
        const s = formatFullTimestamp(OLDER, opts());
        expect(s).toContain("April 2, 2026");
        expect(s).toContain("9:05 AM");
    });
    it("iso + 24h", () => {
        expect(
            formatFullTimestamp(
                OLDER,
                opts({ dateStyle: "iso", timeClock: "24h" }),
            ),
        ).toBe("2026-04-02 09:05");
    });
});
