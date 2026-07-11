import { describe, it, expect } from "vitest";
import {
    isPresenceState,
    normalizePresence,
    presenceDot,
    presenceDotClass,
    presenceLabel,
    OWN_PRESENCE_OPTIONS,
} from "./presence";

describe("isPresenceState", () => {
    it("accepts the three spec presence states", () => {
        expect(isPresenceState("online")).toBe(true);
        expect(isPresenceState("unavailable")).toBe(true);
        expect(isPresenceState("offline")).toBe(true);
    });

    it("rejects junk values", () => {
        expect(isPresenceState("")).toBe(false);
        expect(isPresenceState("busy")).toBe(false);
        expect(isPresenceState("ONLINE")).toBe(false);
        expect(isPresenceState(null)).toBe(false);
        expect(isPresenceState(undefined)).toBe(false);
        expect(isPresenceState(42)).toBe(false);
        expect(isPresenceState({})).toBe(false);
    });
});

describe("normalizePresence", () => {
    it("passes valid states through", () => {
        expect(normalizePresence("online")).toBe("online");
        expect(normalizePresence("unavailable")).toBe("unavailable");
        expect(normalizePresence("offline")).toBe("offline");
    });

    it("maps unknown or missing values to offline", () => {
        expect(normalizePresence(undefined)).toBe("offline");
        expect(normalizePresence(null)).toBe("offline");
        expect(normalizePresence("")).toBe("offline");
        // MSC3026 unstable busy state — not supported, degrade safely.
        expect(normalizePresence("org.matrix.msc3026.busy")).toBe("offline");
        expect(normalizePresence(123)).toBe("offline");
    });
});

describe("presenceDot", () => {
    it("maps online to a green dot", () => {
        expect(presenceDot("online")).toBe("online");
    });

    it("maps unavailable to an idle dot", () => {
        expect(presenceDot("unavailable")).toBe("idle");
    });

    it("maps offline to an offline dot", () => {
        expect(presenceDot("offline")).toBe("offline");
    });
});

describe("presenceDotClass", () => {
    it("returns the themed Tailwind class per dot", () => {
        expect(presenceDotClass("online")).toBe("bg-discord-online");
        expect(presenceDotClass("idle")).toBe("bg-discord-idle");
        expect(presenceDotClass("offline")).toBe("bg-discord-offline");
    });
});

describe("presenceLabel", () => {
    it("humanizes each state", () => {
        expect(presenceLabel("online")).toBe("Online");
        expect(presenceLabel("unavailable")).toBe("Away");
        expect(presenceLabel("offline")).toBe("Offline");
    });
});

describe("OWN_PRESENCE_OPTIONS", () => {
    it("offers exactly the three settable states, online first", () => {
        expect(OWN_PRESENCE_OPTIONS.map((o) => o.value)).toEqual([
            "online",
            "unavailable",
            "offline",
        ]);
    });

    it("labels every option non-emptily", () => {
        for (const option of OWN_PRESENCE_OPTIONS) {
            expect(option.label.length).toBeGreaterThan(0);
        }
    });
});
