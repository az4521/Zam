import { describe, it, expect } from "vitest";
import {
    sortDevices,
    formatLastSeen,
    describeUserAgent,
    supportsPasswordUia,
    type DeviceInfo,
} from "./deviceSessions";

const dev = (
    deviceId: string,
    lastSeenTs?: number,
    displayName?: string,
): DeviceInfo => ({ deviceId, lastSeenTs, displayName });

describe("sortDevices — current session first, then most recently seen", () => {
    it("puts the current device first regardless of last-seen", () => {
        const devices = [
            dev("OLD", 1000),
            dev("CURRENT", 500),
            dev("NEW", 2000),
        ];
        const sorted = sortDevices(devices, "CURRENT");
        expect(sorted.map((d) => d.deviceId)).toEqual([
            "CURRENT",
            "NEW",
            "OLD",
        ]);
    });

    it("orders the rest by last-seen descending, unseen last", () => {
        const devices = [
            dev("NEVER"),
            dev("A", 1000),
            dev("B", 3000),
            dev("C", 2000),
        ];
        const sorted = sortDevices(devices, null);
        expect(sorted.map((d) => d.deviceId)).toEqual(["B", "C", "A", "NEVER"]);
    });

    it("breaks last-seen ties by device id for a stable order", () => {
        const devices = [dev("Z", 1000), dev("A", 1000)];
        expect(sortDevices(devices, null).map((d) => d.deviceId)).toEqual([
            "A",
            "Z",
        ]);
    });

    it("does not mutate the input array", () => {
        const devices = [dev("B", 1), dev("A", 2)];
        sortDevices(devices, null);
        expect(devices.map((d) => d.deviceId)).toEqual(["B", "A"]);
    });
});

describe("formatLastSeen — humanize a last-seen timestamp", () => {
    const NOW = 1_700_000_000_000;
    const MIN = 60_000;
    const HOUR = 3_600_000;
    const DAY = 86_400_000;

    it("returns Unknown when the server reported no timestamp", () => {
        expect(formatLastSeen(undefined, NOW)).toBe("Unknown");
    });

    it("says Just now within the last minute (and for clock skew)", () => {
        expect(formatLastSeen(NOW - 30_000, NOW)).toBe("Just now");
        expect(formatLastSeen(NOW + 5_000, NOW)).toBe("Just now");
    });

    it("uses minutes under an hour, singular at one", () => {
        expect(formatLastSeen(NOW - MIN, NOW)).toBe("1 minute ago");
        expect(formatLastSeen(NOW - 45 * MIN, NOW)).toBe("45 minutes ago");
    });

    it("uses hours under a day and days under a week", () => {
        expect(formatLastSeen(NOW - 5 * HOUR, NOW)).toBe("5 hours ago");
        expect(formatLastSeen(NOW - HOUR, NOW)).toBe("1 hour ago");
        expect(formatLastSeen(NOW - 3 * DAY, NOW)).toBe("3 days ago");
        expect(formatLastSeen(NOW - DAY, NOW)).toBe("1 day ago");
    });

    it("falls back to a calendar date after a week", () => {
        // NOW is Nov 2023; 30 days earlier is still 2023.
        const out = formatLastSeen(NOW - 30 * DAY, NOW);
        expect(out).toMatch(/2023/);
        expect(out).not.toMatch(/ago/);
    });
});

describe("describeUserAgent — friendly browser/OS description", () => {
    it("returns null when there is no user agent", () => {
        expect(describeUserAgent(undefined)).toBeNull();
        expect(describeUserAgent("")).toBeNull();
    });

    it("identifies desktop browsers with their OS", () => {
        expect(
            describeUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
            ),
        ).toBe("Firefox on Windows");
        expect(
            describeUserAgent(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            ),
        ).toBe("Chrome on Linux");
        expect(
            describeUserAgent(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
            ),
        ).toBe("Safari on macOS");
        expect(
            describeUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
            ),
        ).toBe("Edge on Windows");
    });

    it("identifies mobile platforms", () => {
        expect(
            describeUserAgent(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
            ),
        ).toBe("Chrome on Android");
        expect(
            describeUserAgent(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
            ),
        ).toBe("Safari on iOS");
    });

    it("identifies Electron apps as desktop apps", () => {
        expect(
            describeUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) svelte_matrix_client/0.1.0 Chrome/124.0.6367.230 Electron/30.0.9 Safari/537.36",
            ),
        ).toBe("Desktop app on Windows");
    });

    it("falls back to the product name for non-browser clients", () => {
        expect(describeUserAgent("Element/1.11.66 (Android 14)")).toBe(
            "Element on Android",
        );
        expect(describeUserAgent("SomeBot/2.0")).toBe("SomeBot");
    });
});

describe("supportsPasswordUia — can we complete a UIA flow with just a password?", () => {
    it("accepts a single-stage password flow", () => {
        expect(supportsPasswordUia([{ stages: ["m.login.password"] }])).toBe(
            true,
        );
    });

    it("accepts it among other flows we cannot complete", () => {
        expect(
            supportsPasswordUia([
                { stages: ["m.login.sso", "m.login.recaptcha"] },
                { stages: ["m.login.password"] },
            ]),
        ).toBe(true);
    });

    it("rejects flows that require stages beyond a password", () => {
        expect(
            supportsPasswordUia([
                { stages: ["m.login.password", "m.login.recaptcha"] },
            ]),
        ).toBe(false);
    });

    it("rejects missing or empty flow lists", () => {
        expect(supportsPasswordUia(undefined)).toBe(false);
        expect(supportsPasswordUia([])).toBe(false);
    });
});
