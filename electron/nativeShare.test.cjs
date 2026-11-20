// Run with: node --test electron/nativeShare.test.cjs
// (vitest only collects src/**, so the Electron-side tests use node's runner.)

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    createFrameParser,
    helperArgs,
    sanitizeConfig,
    clampInt,
} = require("./nativeShare.cjs");

function auFrame({ key = false, ts = 1234567, w = 1920, h = 1080, data }) {
    const body = Buffer.alloc(13);
    body[0] = key ? 1 : 0;
    body.writeBigInt64LE(BigInt(ts), 1);
    body.writeUInt16LE(w, 9);
    body.writeUInt16LE(h, 11);
    const payload = Buffer.from(data);
    const rest = Buffer.concat([Buffer.from([1]), body, payload]);
    const head = Buffer.alloc(4);
    head.writeUInt32LE(rest.length, 0);
    return Buffer.concat([head, rest]);
}

function infoFrame(obj) {
    const json = Buffer.from(JSON.stringify(obj), "utf8");
    const rest = Buffer.concat([Buffer.from([2]), json]);
    const head = Buffer.alloc(4);
    head.writeUInt32LE(rest.length, 0);
    return Buffer.concat([head, rest]);
}

function feed(parser, buf, sizes) {
    const out = [];
    let off = 0;
    for (const size of sizes) {
        if (off >= buf.length) break;
        out.push(...parser.push(buf.subarray(off, off + size)));
        off += size;
    }
    if (off < buf.length) out.push(...parser.push(buf.subarray(off)));
    return out;
}

test("decodes a single access unit", () => {
    const p = createFrameParser();
    const msgs = p.push(
        auFrame({ key: true, ts: 42, w: 1280, h: 720, data: [0, 0, 0, 1] }),
    );
    assert.equal(msgs.length, 1);
    const m = msgs[0];
    assert.equal(m.type, "au");
    assert.equal(m.key, true);
    assert.equal(m.ts, 42);
    assert.equal(m.w, 1280);
    assert.equal(m.h, 720);
    assert.deepEqual([...m.data], [0, 0, 0, 1]);
});

test("non-key access unit has key false", () => {
    const msgs = createFrameParser().push(auFrame({ key: false, data: [9] }));
    assert.equal(msgs[0].key, false);
});

test("decodes info JSON", () => {
    const msgs = createFrameParser().push(
        infoFrame({ event: "started", width: 800, height: 600, fps: 30 }),
    );
    assert.deepEqual(msgs, [
        {
            type: "info",
            info: { event: "started", width: 800, height: 600, fps: 30 },
        },
    ]);
});

test("multiple messages in one chunk", () => {
    const buf = Buffer.concat([
        infoFrame({ event: "started" }),
        auFrame({ key: true, data: [1, 2] }),
        auFrame({ data: [3] }),
        infoFrame({ event: "stats", fps: 29 }),
    ]);
    const msgs = createFrameParser().push(buf);
    assert.deepEqual(
        msgs.map((m) => m.type),
        ["info", "au", "au", "info"],
    );
    assert.deepEqual([...msgs[1].data], [1, 2]);
    assert.deepEqual([...msgs[2].data], [3]);
});

test("split across chunks at every byte boundary", () => {
    const buf = Buffer.concat([
        infoFrame({ event: "started", width: 10 }),
        auFrame({ key: true, ts: -5, data: [7, 8, 9, 10, 11] }),
        infoFrame({ event: "ended", reason: "stop" }),
    ]);
    for (let cut = 1; cut < buf.length; cut++) {
        const p = createFrameParser();
        const got = [
            ...p.push(buf.subarray(0, cut)),
            ...p.push(buf.subarray(cut)),
        ];
        assert.deepEqual(
            got.map((m) => m.type),
            ["info", "au", "info"],
            `cut at ${cut}`,
        );
        assert.equal(got[1].ts, -5);
        assert.deepEqual([...got[1].data], [7, 8, 9, 10, 11]);
        assert.equal(got[2].info.reason, "stop");
    }
});

test("one byte at a time", () => {
    const buf = Buffer.concat([
        auFrame({ data: [1, 2, 3] }),
        infoFrame({ event: "stats" }),
    ]);
    const msgs = feed(createFrameParser(), buf, Array(buf.length).fill(1));
    assert.deepEqual(
        msgs.map((m) => m.type),
        ["au", "info"],
    );
    assert.deepEqual([...msgs[0].data], [1, 2, 3]);
});

test("a partial length prefix waits for more bytes", () => {
    const p = createFrameParser();
    const frame = auFrame({ data: [5] });
    assert.deepEqual(p.push(frame.subarray(0, 2)), []);
    assert.equal(p.push(frame.subarray(2)).length, 1);
});

test("unknown types and malformed info are skipped", () => {
    const unknown = Buffer.from([3, 0, 0, 0, 99, 1, 2]); // type 99, body 2 bytes
    const badJson = Buffer.concat([
        Buffer.from([6, 0, 0, 0, 2]), // type 2 plus the 5 bytes below
        Buffer.from("{nope", "utf8"),
    ]);
    const shortAu = Buffer.from([4, 0, 0, 0, 1, 0, 0, 0]); // header too short
    const good = auFrame({ data: [4] });
    const msgs = createFrameParser().push(
        Buffer.concat([unknown, badJson, shortAu, good]),
    );
    assert.equal(msgs.length, 1);
    assert.deepEqual([...msgs[0].data], [4]);
});

test("a zero or oversized length is a fatal error", () => {
    const zero = createFrameParser().push(Buffer.from([0, 0, 0, 0]));
    assert.equal(zero[0].type, "error");

    const p = createFrameParser({ maxFrame: 100 });
    const big = Buffer.alloc(4);
    big.writeUInt32LE(101, 0);
    const msgs = p.push(Buffer.concat([big, Buffer.alloc(101)]));
    assert.equal(msgs[0].type, "error");
    // After an error the parser stays quiet.
    assert.deepEqual(p.push(auFrame({ data: [1] })), []);
});

test("sanitizeConfig clamps and defaults", () => {
    assert.deepEqual(sanitizeConfig(null), {
        enabled: false,
        fps: 30,
        bitrate: 8000000,
        maxWidth: 1920,
        maxHeight: 1080,
        simulcast: false,
    });
    assert.deepEqual(
        sanitizeConfig({
            enabled: "yes",
            fps: 9999,
            bitrate: 1,
            maxWidth: 10,
            maxHeight: 100000,
            simulcast: "yes",
        }),
        {
            enabled: false,
            fps: 240,
            bitrate: 100000,
            maxWidth: 160,
            maxHeight: 7680,
            simulcast: false,
        },
    );
    assert.equal(sanitizeConfig({ enabled: true }).enabled, true);
    assert.equal(sanitizeConfig({ simulcast: true }).simulcast, true);
    assert.equal(sanitizeConfig({ fps: "abc" }).fps, 30);
    assert.equal(sanitizeConfig({ fps: 0 }).fps, 1);
});

test("clampInt returns the fallback for missing values", () => {
    assert.equal(clampInt(undefined, 1, 5, 3), 3);
    assert.equal(clampInt(null, 1, 5, null), null);
    assert.equal(clampInt(Infinity, 1, 5, 3), 3);
    assert.equal(clampInt(2.6, 1, 5, 3), 3);
});

test("helperArgs only for window sources", () => {
    const cfg = sanitizeConfig({ enabled: true, fps: 60, bitrate: 5000000 });
    assert.deepEqual(helperArgs("window:131234:0", cfg), [
        "--window",
        "131234",
        "--fps",
        "60",
        "--bitrate",
        "5000000",
        "--max-width",
        "1920",
        "--max-height",
        "1080",
        "--cursor",
        "1",
    ]);
    assert.equal(helperArgs("screen:0:0", cfg), null);
    assert.equal(helperArgs("window:0:0", cfg), null);
    assert.equal(helperArgs("window:abc:0", cfg), null);
    assert.equal(helperArgs(undefined, cfg), null);
});
