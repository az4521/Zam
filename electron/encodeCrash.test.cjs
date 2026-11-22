// Run with: node --test electron/encodeCrash.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    ENCODE_GRACE_MS,
    encodeCrashCounts,
    gpuDriverKey,
    encodeCrashApplies,
} = require("./encodeCrash.cjs");

const base = { reason: "crashed", encoding: true, stoppedAt: 0, now: 100000 };

test("a crash while encoding on the GPU counts", () => {
    assert.equal(encodeCrashCounts(base), true);
    assert.equal(encodeCrashCounts({ ...base, reason: "abnormal-exit" }), true);
});

test("clean exits, kills, out of memory and repaints don't", () => {
    for (const reason of ["clean-exit", "killed", "oom"])
        assert.equal(encodeCrashCounts({ ...base, reason }), false);
    assert.equal(encodeCrashCounts({ ...base, repaint: true }), false);
});

test("a crash shortly after encoding stopped still counts", () => {
    const stopped = { ...base, encoding: false };
    assert.equal(
        encodeCrashCounts({ ...stopped, stoppedAt: base.now - 1000 }),
        true,
    );
    assert.equal(
        encodeCrashCounts({
            ...stopped,
            stoppedAt: base.now - ENCODE_GRACE_MS - 1,
        }),
        false,
    );
});

test("gpuDriverKey names the active GPU and its driver", () => {
    const info = {
        gpuDevice: [
            { vendorId: 0x8086, deviceId: 0x4680, driverVersion: "31.0" },
            {
                vendorId: 0x1002,
                deviceId: 0x744c,
                driverVersion: "32.0.32029.2010",
                active: true,
            },
        ],
    };
    assert.equal(gpuDriverKey(info), "1002:744c:32.0.32029.2010");
    assert.equal(gpuDriverKey({ gpuDevice: [] }), "");
    assert.equal(gpuDriverKey(null), "");
});

test("a record applies until the GPU or driver changes", () => {
    const record = { driver: "1002:744c:32.0", at: 1 };
    assert.equal(encodeCrashApplies(record, "1002:744c:32.0"), true);
    assert.equal(encodeCrashApplies(record, "1002:744c:33.0"), false);
    assert.equal(encodeCrashApplies(record, ""), true);
    assert.equal(encodeCrashApplies({ at: 1 }, "1002:744c:33.0"), true);
    assert.equal(encodeCrashApplies(null, "x"), false);
});
