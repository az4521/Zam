import { describe, it, expect } from "vitest";
import {
    AUTO_AWAY_MS,
    activityHidden,
    advertisedPresence,
    presenceProbeVerdict,
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
        expect(normalizePresence("BUSY")).toBe("offline");
        expect(normalizePresence(123)).toBe("offline");
    });

    it("reads MSC3026 busy in both server spellings", () => {
        // tuwunel sends "busy", Synapse the unstable name.
        expect(normalizePresence("busy")).toBe("busy");
        expect(normalizePresence("org.matrix.msc3026.busy")).toBe("busy");
    });
});

describe("advertisedPresence", () => {
    it("stays online while the device is in use", () => {
        expect(advertisedPresence("online", 0)).toBe("online");
        expect(advertisedPresence("online", AUTO_AWAY_MS - 1)).toBe("online");
    });

    it("goes away once the device has been idle long enough", () => {
        expect(advertisedPresence("online", AUTO_AWAY_MS)).toBe("unavailable");
        expect(advertisedPresence("online", AUTO_AWAY_MS * 10)).toBe(
            "unavailable",
        );
    });

    it("leaves a chosen away or invisible alone", () => {
        expect(advertisedPresence("unavailable", 0)).toBe("unavailable");
        expect(advertisedPresence("offline", 0)).toBe("offline");
        expect(advertisedPresence("offline", AUTO_AWAY_MS)).toBe("offline");
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
        expect(presenceDotClass("online")).toBe("bg-zam-online");
        expect(presenceDotClass("idle")).toBe("bg-zam-idle");
        expect(presenceDotClass("offline")).toBe("bg-zam-offline");
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

describe("busy presence", () => {
    it("renders as a red Do Not Disturb dot", () => {
        expect(presenceDot("busy")).toBe("dnd");
        expect(presenceDotClass("dnd")).toBe("bg-zam-dnd");
        expect(presenceLabel("busy")).toBe(presenceLabel("busy"));
        expect(presenceLabel("busy")).not.toBe(presenceLabel("unavailable"));
    });

    it("is not turned into away by idleness", () => {
        expect(advertisedPresence("busy", AUTO_AWAY_MS * 10)).toBe("busy");
    });
});

describe("activityHidden", () => {
    it("hides activity only while invisible on a server with presence", () => {
        expect(activityHidden("offline", false)).toBe(true);
        expect(activityHidden("online", false)).toBe(false);
        expect(activityHidden("unavailable", false)).toBe(false);
    });

    it("ignores a leftover invisible choice where presence is unsupported", () => {
        expect(activityHidden("offline", true)).toBe(false);
    });
});

describe("presenceProbeVerdict", () => {
    it("reads offline after advertising online as unsupported", () => {
        expect(presenceProbeVerdict("online", "offline")).toBe(false);
        expect(presenceProbeVerdict("unavailable", "offline")).toBe(false);
    });

    it("reads any live state as supported", () => {
        expect(presenceProbeVerdict("online", "online")).toBe(true);
        expect(presenceProbeVerdict("unavailable", "unavailable")).toBe(true);
        expect(presenceProbeVerdict("busy", "org.matrix.msc3026.busy")).toBe(
            true,
        );
    });

    it("learns nothing when we advertised offline or the request failed", () => {
        expect(presenceProbeVerdict("offline", "offline")).toBeNull();
        expect(presenceProbeVerdict("online", null)).toBeNull();
    });
});
