import { describe, expect, it } from "vitest";
import {
    PROFILE_PRESENCE_KEY,
    PROFILE_PRESENCE_STALE_MS,
    buildProfilePresence,
    parseProfilePresence,
    presenceControlsShown,
} from "./profilePresence";

const NOW = 1_700_000_000_000;
const profile = (value: unknown) => ({ [PROFILE_PRESENCE_KEY]: value });

describe("buildProfilePresence", () => {
    it("publishes live states with the write time", () => {
        expect(buildProfilePresence("online", NOW)).toEqual({
            presence: "online",
            ts: NOW,
        });
        expect(buildProfilePresence("busy", NOW)?.presence).toBe("busy");
    });

    it("deletes the field for invisible", () => {
        expect(buildProfilePresence("offline", NOW)).toBeNull();
    });
});

describe("parseProfilePresence", () => {
    it("reads a fresh value", () => {
        expect(
            parseProfilePresence(
                profile({ presence: "unavailable", ts: NOW - 1000 }),
                NOW,
            ),
        ).toEqual({ state: "unavailable", ts: NOW - 1000 });
    });

    it("reads busy", () => {
        expect(
            parseProfilePresence(profile({ presence: "busy", ts: NOW }), NOW)
                ?.state,
        ).toBe("busy");
    });

    it("ignores a stale value", () => {
        const ts = NOW - PROFILE_PRESENCE_STALE_MS - 1;
        expect(
            parseProfilePresence(profile({ presence: "online", ts }), NOW),
        ).toBeNull();
    });

    it("ignores a value dated far in the future", () => {
        expect(
            parseProfilePresence(
                profile({ presence: "online", ts: NOW + 10 * 60_000 }),
                NOW,
            ),
        ).toBeNull();
    });

    it("ignores offline, unknown states and malformed values", () => {
        for (const value of [
            { presence: "offline", ts: NOW },
            { presence: "dancing", ts: NOW },
            { presence: "online" },
            { presence: "online", ts: "now" },
            "online",
            null,
        ]) {
            expect(parseProfilePresence(profile(value), NOW)).toBeNull();
        }
    });

    it("handles a missing profile", () => {
        expect(parseProfilePresence(undefined, NOW)).toBeNull();
        expect(parseProfilePresence({}, NOW)).toBeNull();
    });
});

describe("presenceControlsShown", () => {
    it("shows the picker unless the server lacks presence and we do not share", () => {
        expect(presenceControlsShown(false, false)).toBe(true);
        expect(presenceControlsShown(true, false)).toBe(false);
        expect(presenceControlsShown(true, true)).toBe(true);
    });
});
