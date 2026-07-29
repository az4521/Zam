import { describe, it, expect } from "vitest";
import {
    ACTIVE_SESSION_KEY,
    DEFAULT_GRACE_MS,
    GRACE_OPTIONS,
    HEARTBEAT_INTERVAL_MS,
    IDLE_LIMIT_MS,
    MAX_CUSTOM_GRACE_MINUTES,
    MAX_FUTURE_SKEW_MS,
    MAX_GRACE_MS,
    MIN_CUSTOM_GRACE_MS,
    MIN_HEARTBEAT_INTERVAL_MS,
    buildHeartbeat,
    graceMsToMinutesInput,
    heartbeatIntervalFor,
    isDeviceInUse,
    isPresetGraceMs,
    normalizeGraceMs,
    parseActiveSession,
    parseCustomGraceMinutes,
    shouldSuppressForActiveDevice,
    shouldWriteHeartbeat,
    type ActiveSessionHeartbeat,
} from "./activeSession";

const NOW = 1_700_000_000_000;

function hb(
    over: Partial<ActiveSessionHeartbeat> = {},
): ActiveSessionHeartbeat {
    return { deviceId: "OTHERDEV", ts: NOW - 1_000, graceMs: 60_000, ...over };
}

describe("ACTIVE_SESSION_KEY", () => {
    it("is the agreed account-data type", () => {
        expect(ACTIVE_SESSION_KEY).toBe("moe.crafty.matrix.active_session");
    });
});

describe("parseActiveSession", () => {
    it("parses a well-formed blob", () => {
        expect(
            parseActiveSession({ deviceId: "ABC", ts: 123, graceMs: 60_000 }),
        ).toEqual({ deviceId: "ABC", ts: 123, graceMs: 60_000 });
    });

    it("ignores unknown extra keys", () => {
        expect(
            parseActiveSession({
                deviceId: "ABC",
                ts: 123,
                graceMs: 0,
                junk: true,
            }),
        ).toEqual({ deviceId: "ABC", ts: 123, graceMs: 0 });
    });

    it.each([
        ["null", null],
        ["undefined", undefined],
        ["a string", "nope"],
        ["an empty object", {}],
        ["a blank deviceId", { deviceId: "", ts: 1, graceMs: 1 }],
        ["a non-string deviceId", { deviceId: 5, ts: 1, graceMs: 1 }],
        ["a non-numeric ts", { deviceId: "A", ts: "1", graceMs: 1 }],
        ["a NaN ts", { deviceId: "A", ts: NaN, graceMs: 1 }],
        ["a missing graceMs", { deviceId: "A", ts: 1 }],
        ["a negative graceMs", { deviceId: "A", ts: 1, graceMs: -1 }],
    ])("returns null for %s (fail open)", (_label, input) => {
        expect(parseActiveSession(input)).toBeNull();
    });
});

describe("shouldSuppressForActiveDevice", () => {
    it("suppresses when another device is inside the grace window", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb(),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(true);
    });

    it("never suppresses on the device that wrote the heartbeat", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ deviceId: "MYDEV" }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress once the heartbeat is older than the grace window", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW - 60_001 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress exactly at the grace boundary", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW - 60_000 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress when there is no heartbeat", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: null,
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress when we do not know our own device id", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb(),
                myDeviceId: null,
                now: NOW,
            }),
        ).toBe(false);
    });

    it("does not suppress when the feature is Off (graceMs 0)", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ graceMs: 0 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    // The past-dated Off case above would still pass with the `graceMs <= 0`
    // guard deleted (age 1_000 is not < 0). A FUTURE-dated one pins the guard:
    // without it the age is negative and -1_000 < 0 would suppress.
    it("does not suppress when Off even if the heartbeat is future-dated", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW + 1_000, graceMs: 0 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("fails open on a wildly future timestamp (clock skew)", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW + MAX_FUTURE_SKEW_MS + 1 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    // Both sides of the skew boundary are pinned: the hand-written sw.js and
    // Java copies have to land on the same inclusive/exclusive choice.
    it("still suppresses exactly at the skew boundary (inclusive)", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW + MAX_FUTURE_SKEW_MS }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(true);
    });

    it("tolerates small clock skew inside the allowance", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW + 1_000 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(true);
    });

    // An absurd graceMs from a buggy/hostile writer must not mute this device
    // forever — the reader clamps the window it is willing to honour.
    it("clamps an absurd graceMs to MAX_GRACE_MS", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW - MAX_GRACE_MS, graceMs: 1e12 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(false);
    });

    it("still suppresses a fresh heartbeat carrying an absurd graceMs", () => {
        expect(
            shouldSuppressForActiveDevice({
                heartbeat: hb({ ts: NOW - 1_000, graceMs: 1e12 }),
                myDeviceId: "MYDEV",
                now: NOW,
            }),
        ).toBe(true);
    });
});

describe("heartbeatIntervalFor", () => {
    it.each([
        [15_000, 7_500],
        [60_000, 30_000],
        [300_000, 30_000],
        [0, 30_000],
        [NaN, 30_000],
        [2_000, 5_000], // floor wins over half-the-grace
    ])("maps a grace of %p to a %p tick", (grace, expected) => {
        expect(heartbeatIntervalFor(grace)).toBe(expected);
    });

    it("never exceeds the cap or drops below the floor", () => {
        for (const option of GRACE_OPTIONS) {
            const interval = heartbeatIntervalFor(option.value);
            expect(interval).toBeLessThanOrEqual(HEARTBEAT_INTERVAL_MS);
            expect(interval).toBeGreaterThanOrEqual(MIN_HEARTBEAT_INTERVAL_MS);
        }
    });

    // The property that actually matters: for every offered grace, the writer
    // refreshes before the blob can expire, so suppression cannot flap.
    it("refreshes faster than the grace expires for every offered option", () => {
        for (const option of GRACE_OPTIONS) {
            if (option.value <= 0) continue;
            expect(heartbeatIntervalFor(option.value)).toBeLessThan(
                option.value,
            );
        }
    });
});

describe("shouldWriteHeartbeat", () => {
    it("writes on the first call while focused", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: null,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(true);
    });

    it("never writes while unfocused", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: null,
                now: NOW,
                hasFocus: false,
                intervalMs: 30_000,
            }),
        ).toBe(false);
    });

    it("does not write again inside the interval", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: NOW - 29_999,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(false);
    });

    it("writes once the interval has elapsed", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: NOW - 30_000,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(true);
    });

    it("writes when the clock jumped backwards", () => {
        expect(
            shouldWriteHeartbeat({
                lastWriteTs: NOW + 5_000,
                now: NOW,
                hasFocus: true,
                intervalMs: 30_000,
            }),
        ).toBe(true);
    });
});

describe("isDeviceInUse", () => {
    const inUse = (over: Partial<Parameters<typeof isDeviceInUse>[0]> = {}) =>
        isDeviceInUse({
            hasFocus: true,
            lastInputTs: NOW - 1_000,
            now: NOW,
            idleLimitMs: IDLE_LIMIT_MS,
            ...over,
        });

    it("is in use when focused with input a second ago", () => {
        expect(inUse()).toBe(true);
    });

    // The boundary is EXCLUSIVE: at exactly the limit the device is idle.
    it("is idle at exactly the idle limit", () => {
        expect(inUse({ lastInputTs: NOW - IDLE_LIMIT_MS })).toBe(false);
    });

    it("is still in use one millisecond inside the idle limit", () => {
        expect(inUse({ lastInputTs: NOW - (IDLE_LIMIT_MS - 1) })).toBe(true);
    });

    it("is idle long past the limit even though the window kept focus", () => {
        expect(inUse({ lastInputTs: NOW - IDLE_LIMIT_MS * 10 })).toBe(false);
    });

    it("is not in use while unfocused, however recent the input", () => {
        expect(inUse({ hasFocus: false, lastInputTs: NOW })).toBe(false);
    });

    it("is not in use before any input has been seen", () => {
        expect(inUse({ lastInputTs: null })).toBe(false);
    });

    // Clock jumped backwards: input stamped "in the future" is the freshest
    // thing we have, so treat it as current rather than as ancient.
    it("treats a future input timestamp as fresh", () => {
        expect(inUse({ lastInputTs: NOW + 60_000 })).toBe(true);
    });

    it("honours a caller-supplied idle limit", () => {
        expect(inUse({ lastInputTs: NOW - 5_000, idleLimitMs: 1_000 })).toBe(
            false,
        );
        expect(inUse({ lastInputTs: NOW - 500, idleLimitMs: 1_000 })).toBe(
            true,
        );
    });
});

describe("IDLE_LIMIT_MS", () => {
    it("is three minutes", () => {
        expect(IDLE_LIMIT_MS).toBe(180_000);
    });
});

describe("buildHeartbeat", () => {
    it("produces exactly the three blob fields", () => {
        expect(
            buildHeartbeat({ deviceId: "ABC", now: NOW, graceMs: 15_000 }),
        ).toEqual({ deviceId: "ABC", ts: NOW, graceMs: 15_000 });
    });

    it("round-trips through parseActiveSession", () => {
        const built = buildHeartbeat({
            deviceId: "ABC",
            now: NOW,
            graceMs: DEFAULT_GRACE_MS,
        });
        expect(parseActiveSession(built)).toEqual(built);
    });
});

describe("normalizeGraceMs", () => {
    it("keeps a known option", () => {
        expect(normalizeGraceMs(15_000)).toBe(15_000);
    });

    it("keeps Off", () => {
        expect(normalizeGraceMs(0)).toBe(0);
    });

    it("accepts a numeric string (localStorage round-trip)", () => {
        expect(normalizeGraceMs("30000")).toBe(30_000);
    });

    // A blank stored string must NOT read as an explicit "Off" — Number("")
    // is 0, which would silently disable the feature.
    it.each([[undefined], [null], ["abc"], [-5], [NaN], [""], ["   "]])(
        "falls back to the default for %p",
        (input) => {
            expect(normalizeGraceMs(input)).toBe(DEFAULT_GRACE_MS);
        },
    );

    // An out-of-range grace adopted from a remote blob would otherwise be
    // re-published verbatim by this device forever, and the readers all clamp
    // it — so every device would go quiet for the clamp's full window after
    // each heartbeat, with no way back except a human opening Settings.
    it("clamps an absurd value to MAX_GRACE_MS", () => {
        expect(normalizeGraceMs(86_400_000)).toBe(MAX_GRACE_MS);
    });

    it("clamps an absurd numeric string too", () => {
        expect(normalizeGraceMs("86400000")).toBe(MAX_GRACE_MS);
    });

    it("keeps a value exactly at the cap", () => {
        expect(normalizeGraceMs(MAX_GRACE_MS)).toBe(MAX_GRACE_MS);
    });

    it("leaves every offered option untouched", () => {
        for (const option of GRACE_OPTIONS)
            expect(normalizeGraceMs(option.value)).toBe(option.value);
    });
});

describe("GRACE_OPTIONS", () => {
    it("offers Off first", () => {
        expect(GRACE_OPTIONS[0].value).toBe(0);
    });

    it("is strictly ascending", () => {
        const values = GRACE_OPTIONS.map((o) => o.value);
        expect(values).toEqual([...values].sort((a, b) => a - b));
        expect(new Set(values).size).toBe(values.length);
    });

    it("labels every option", () => {
        for (const option of GRACE_OPTIONS) {
            expect(option.label.trim().length).toBeGreaterThan(0);
        }
    });

    it("round-trips every offered value through normalizeGraceMs", () => {
        for (const option of GRACE_OPTIONS) {
            expect(normalizeGraceMs(option.value)).toBe(option.value);
        }
    });

    it("offers the longer 10- and 30-minute windows", () => {
        const values = GRACE_OPTIONS.map((o) => o.value);
        expect(values).toContain(600_000);
        expect(values).toContain(1_800_000);
    });

    it("keeps the short windows people already picked", () => {
        const values = GRACE_OPTIONS.map((o) => o.value);
        for (const kept of [0, 15_000, 30_000, 60_000, 120_000, 300_000])
            expect(values).toContain(kept);
    });
});

describe("MAX_GRACE_MS", () => {
    // THE landmine this cap creates: readers clamp to it, so any offered
    // option above it would show one duration in Settings and behave as
    // another. The cap must stay strictly above whatever the picker offers.
    it("never clamps an offered option", () => {
        for (const option of GRACE_OPTIONS)
            expect(Math.min(option.value, MAX_GRACE_MS)).toBe(option.value);
    });

    it("leaves headroom above the longest offered option", () => {
        const longest = Math.max(...GRACE_OPTIONS.map((o) => o.value));
        expect(MAX_GRACE_MS).toBeGreaterThan(longest);
    });

    // Hand-mirrored into static/sw.js and MatrixMessagingService.java, which
    // no gate compiles — pin the number so a change here is loud.
    it("is two hours", () => {
        expect(MAX_GRACE_MS).toBe(7_200_000);
    });

    it("is the ceiling the custom picker enforces", () => {
        expect(MAX_CUSTOM_GRACE_MINUTES * 60_000).toBe(MAX_GRACE_MS);
    });
});

describe("parseCustomGraceMinutes", () => {
    it("accepts a plain number of minutes", () => {
        expect(parseCustomGraceMinutes("10")).toEqual({
            ok: true,
            ms: 600_000,
        });
    });

    it("accepts a fractional value", () => {
        expect(parseCustomGraceMinutes("1.5")).toEqual({
            ok: true,
            ms: 90_000,
        });
    });

    it("tolerates surrounding whitespace", () => {
        expect(parseCustomGraceMinutes("  45  ")).toEqual({
            ok: true,
            ms: 2_700_000,
        });
    });

    it("accepts exactly the maximum", () => {
        expect(
            parseCustomGraceMinutes(String(MAX_CUSTOM_GRACE_MINUTES)),
        ).toEqual({ ok: true, ms: MAX_GRACE_MS });
    });

    it("accepts exactly the minimum", () => {
        expect(parseCustomGraceMinutes("1")).toEqual({
            ok: true,
            ms: MIN_CUSTOM_GRACE_MS,
        });
    });

    it.each([
        ["an empty string", ""],
        ["whitespace only", "   "],
        ["a non-numeric string", "abc"],
        ["a half-numeric string", "10abc"],
        ["Infinity", "Infinity"],
        ["NaN", "NaN"],
    ])("rejects %s", (_label, input) => {
        const result = parseCustomGraceMinutes(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    });

    it.each([
        ["zero", "0"],
        ["a negative value", "-5"],
        ["a value under one minute", "0.5"],
    ])("rejects %s as too short", (_label, input) => {
        const result = parseCustomGraceMinutes(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/least/i);
    });

    // The whole bug class: never hand back a value the readers would clamp.
    it("rejects a value above the maximum instead of silently clamping it", () => {
        const result = parseCustomGraceMinutes(
            String(MAX_CUSTOM_GRACE_MINUTES + 1),
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toMatch(/120|2 hours/i);
    });

    it("never returns a value that normalizeGraceMs would change", () => {
        for (const input of ["1", "7", "10", "30", "99.5", "120"]) {
            const result = parseCustomGraceMinutes(input);
            expect(result.ok).toBe(true);
            if (result.ok) expect(normalizeGraceMs(result.ms)).toBe(result.ms);
        }
    });

    it("never returns a value a reader would clamp", () => {
        for (const input of ["1", "60", "120"]) {
            const result = parseCustomGraceMinutes(input);
            if (result.ok)
                expect(Math.min(result.ms, MAX_GRACE_MS)).toBe(result.ms);
        }
    });
});

describe("isPresetGraceMs", () => {
    it("recognises every offered option", () => {
        for (const option of GRACE_OPTIONS)
            expect(isPresetGraceMs(option.value)).toBe(true);
    });

    it("rejects a value that is not offered", () => {
        expect(isPresetGraceMs(420_000)).toBe(false);
    });
});

describe("graceMsToMinutesInput", () => {
    it.each([
        [600_000, "10"],
        [1_800_000, "30"],
        [90_000, "1.5"],
        [45_000, "0.75"],
        [MAX_GRACE_MS, "120"],
    ])("renders %p as %p", (ms, expected) => {
        expect(graceMsToMinutesInput(ms)).toBe(expected);
    });

    // Round-trip: whatever we prefill must parse back to the same ms, or
    // reopening Settings and pressing Save would silently change the setting.
    it("round-trips through parseCustomGraceMinutes", () => {
        for (const ms of [60_000, 600_000, 1_800_000, 5_400_000, MAX_GRACE_MS])
            expect(parseCustomGraceMinutes(graceMsToMinutesInput(ms))).toEqual({
                ok: true,
                ms,
            });
    });
});
