// Run with: node --test electron/discordAttachments.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    isDiscordAttachmentUrl,
    normaliseProxyBase,
    refreshAttachmentUrls,
    downloadAttachment,
} = require("./discordAttachments.cjs");

const CDN = "https://cdn.discordapp.com/attachments/1/2/cat.gif";

function attUrl(i) {
    return `https://cdn.discordapp.com/attachments/1/2/g${i}.gif?ex=1&is=2&hm=3`;
}

// A fetch stub that records calls and answers each with the next response
// from `responses` (a function gets the call's parsed body).
function stubFetch(responses) {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return typeof next === "function" ? next(init) : next;
    };
    return { fetchImpl, calls };
}

function jsonRes(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

// Echoes every requested url back as refreshed with a new signature.
function echoRefresh(init) {
    const { urls } = JSON.parse(init.body);
    return jsonRes({
        urls: urls.map((original) => ({
            original,
            refreshed: `${original.split("?")[0]}?ex=9&is=9&hm=9`,
        })),
    });
}

// --- isDiscordAttachmentUrl --------------------------------------------------

test("attachment urls: cdn and media hosts, both path prefixes", () => {
    assert.equal(isDiscordAttachmentUrl(CDN), true);
    assert.equal(
        isDiscordAttachmentUrl(
            "https://media.discordapp.net/ephemeral-attachments/a/b.gif?ex=1",
        ),
        true,
    );
});

test("attachment urls: rejects other schemes, hosts, paths and long urls", () => {
    assert.equal(isDiscordAttachmentUrl(CDN.replace("https", "http")), false);
    assert.equal(isDiscordAttachmentUrl(undefined), false);
    assert.equal(isDiscordAttachmentUrl("not a url"), false);
    assert.equal(
        isDiscordAttachmentUrl("https://evilcdn.discordapp.com/attachments/a"),
        false,
    );
    assert.equal(
        isDiscordAttachmentUrl("https://cdn.discordapp.com/emojis/1.gif"),
        false,
    );
    assert.equal(
        isDiscordAttachmentUrl("https://discord.com/channels/1/2/3"),
        false,
    );
    assert.equal(
        isDiscordAttachmentUrl(
            "https://cdn.discordapp.com/attachments/" + "a".repeat(2050),
        ),
        false,
    );
});

// --- normaliseProxyBase ------------------------------------------------------

test("proxy base: https is kept with its path, trailing slashes and query stripped", () => {
    assert.equal(
        normaliseProxyBase("https://refresh.example.com/sub/"),
        "https://refresh.example.com/sub",
    );
    assert.equal(
        normaliseProxyBase("  https://refresh.example.com//?x=1#frag "),
        "https://refresh.example.com",
    );
});

test("proxy base: http only for localhost, 127.0.0.1 and [::1]", () => {
    assert.equal(
        normaliseProxyBase("http://localhost:8787/"),
        "http://localhost:8787",
    );
    assert.equal(
        normaliseProxyBase("http://127.0.0.1:8787"),
        "http://127.0.0.1:8787",
    );
    assert.equal(normaliseProxyBase("http://[::1]:8787"), "http://[::1]:8787");
    assert.equal(normaliseProxyBase("http://refresh.example.com"), null);
});

test("proxy base: rejects credentials, other schemes and non-strings", () => {
    assert.equal(
        normaliseProxyBase("https://user:pw@refresh.example.com"),
        null,
    );
    assert.equal(normaliseProxyBase("https://user@refresh.example.com"), null);
    assert.equal(normaliseProxyBase("ftp://refresh.example.com"), null);
    assert.equal(normaliseProxyBase("refresh.example.com"), null);
    assert.equal(normaliseProxyBase(42), null);
});

// --- refreshAttachmentUrls ---------------------------------------------------

test("refresh: bad proxy url never fetches", async () => {
    const { fetchImpl, calls } = stubFetch([]);
    assert.deepEqual(
        await refreshAttachmentUrls("http://remote.example", [CDN], fetchImpl),
        { ok: false, error: "bad-proxy-url" },
    );
    assert.equal(calls.length, 0);
});

test("refresh: filters non-attachment urls, dedupes, and maps refreshed links", async () => {
    const { fetchImpl, calls } = stubFetch([echoRefresh]);
    const r = await refreshAttachmentUrls(
        "https://refresh.example.com/",
        [CDN, CDN, "https://discord.com/x", attUrl(1)],
        fetchImpl,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://refresh.example.com/refresh");
    assert.equal(calls[0].init.method, "POST");
    assert.equal(calls[0].init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
        urls: [CDN, attUrl(1)],
    });
    assert.deepEqual(r, {
        ok: true,
        refreshed: {
            [CDN]: "https://cdn.discordapp.com/attachments/1/2/cat.gif?ex=9&is=9&hm=9",
            [attUrl(1)]:
                "https://cdn.discordapp.com/attachments/1/2/g1.gif?ex=9&is=9&hm=9",
        },
    });
});

test("refresh: empty input makes no request", async () => {
    const { fetchImpl, calls } = stubFetch([]);
    assert.deepEqual(
        await refreshAttachmentUrls(
            "https://refresh.example.com",
            [],
            fetchImpl,
        ),
        { ok: true, refreshed: {} },
    );
    assert.equal(calls.length, 0);
});

test("refresh: 120 urls go out as three chunks of 50, 50 and 20", async () => {
    const urls = Array.from({ length: 120 }, (_, i) => attUrl(i));
    const { fetchImpl, calls } = stubFetch([
        echoRefresh,
        echoRefresh,
        echoRefresh,
    ]);
    const r = await refreshAttachmentUrls(
        "https://refresh.example.com",
        urls,
        fetchImpl,
    );
    assert.equal(calls.length, 3);
    const sizes = calls.map((c) => JSON.parse(c.init.body).urls.length);
    assert.deepEqual(sizes, [50, 50, 20]);
    assert.equal(Object.keys(r.refreshed).length, 120);
});

test("refresh: entries not requested or with bogus refreshed links are dropped", async () => {
    const { fetchImpl } = stubFetch([
        jsonRes({
            urls: [
                { original: CDN, refreshed: CDN + "?ex=1" },
                {
                    original: "https://cdn.discordapp.com/attachments/x.gif",
                    refreshed: CDN,
                },
                {
                    original: attUrl(1),
                    refreshed: "https://evil.example/x.gif",
                },
                { original: attUrl(2), refreshed: 5 },
                "junk",
                null,
            ],
        }),
    ]);
    const r = await refreshAttachmentUrls(
        "https://refresh.example.com",
        [CDN, attUrl(1), attUrl(2)],
        fetchImpl,
    );
    assert.deepEqual(r, {
        ok: true,
        refreshed: { [CDN]: CDN + "?ex=1" },
    });
});

test("refresh: 429 maps to rate-limited and stops further chunks", async () => {
    const urls = Array.from({ length: 60 }, (_, i) => attUrl(i));
    const { fetchImpl, calls } = stubFetch([
        echoRefresh,
        new Response("slow down", { status: 429 }),
        echoRefresh,
    ]);
    assert.deepEqual(
        await refreshAttachmentUrls(
            "https://refresh.example.com",
            urls,
            fetchImpl,
        ),
        { ok: false, error: "rate-limited", status: 429 },
    );
    assert.equal(calls.length, 2);
});

test("refresh: other non-2xx maps to http-error with status", async () => {
    const { fetchImpl } = stubFetch([new Response("no", { status: 503 })]);
    assert.deepEqual(
        await refreshAttachmentUrls(
            "https://refresh.example.com",
            [CDN],
            fetchImpl,
        ),
        { ok: false, error: "http-error", status: 503 },
    );
});

test("refresh: a thrown fetch maps to unreachable", async () => {
    const { fetchImpl } = stubFetch([new TypeError("fetch failed")]);
    assert.deepEqual(
        await refreshAttachmentUrls(
            "https://refresh.example.com",
            [CDN],
            fetchImpl,
        ),
        { ok: false, error: "unreachable" },
    );
});

test("refresh: invalid json or wrong shape maps to bad-response", async () => {
    const bad = stubFetch([new Response("<html>", { status: 200 })]);
    assert.deepEqual(
        await refreshAttachmentUrls(
            "https://refresh.example.com",
            [CDN],
            bad.fetchImpl,
        ),
        { ok: false, error: "bad-response" },
    );
    const shape = stubFetch([jsonRes({ urls: "nope" })]);
    assert.deepEqual(
        await refreshAttachmentUrls(
            "https://refresh.example.com",
            [CDN],
            shape.fetchImpl,
        ),
        { ok: false, error: "bad-response" },
    );
});

// --- downloadAttachment ------------------------------------------------------

function streamRes(parts, headers = {}) {
    const stream = new ReadableStream({
        start(controller) {
            for (const p of parts) controller.enqueue(p);
            controller.close();
        },
    });
    return new Response(stream, { status: 200, headers });
}

test("download: bad url never fetches", async () => {
    const { fetchImpl, calls } = stubFetch([]);
    assert.deepEqual(
        await downloadAttachment("https://example.com/a.gif", fetchImpl),
        { ok: false, error: "bad-url" },
    );
    assert.equal(calls.length, 0);
});

test("download: returns bytes, lowercased bare content type and name", async () => {
    const body = new TextEncoder().encode("GIF89a");
    const { fetchImpl } = stubFetch([
        new Response(body, {
            status: 200,
            headers: { "Content-Type": "Image/GIF; charset=binary" },
        }),
    ]);
    const r = await downloadAttachment(CDN, fetchImpl);
    assert.equal(r.ok, true);
    assert.deepEqual(Array.from(r.data), Array.from(body));
    assert.equal(r.contentType, "image/gif");
    assert.equal(r.name, "cat.gif");
});

test("download: declared content-length over the cap is too-large", async () => {
    const { fetchImpl } = stubFetch([
        new Response("x", {
            status: 200,
            headers: { "content-length": "999" },
        }),
    ]);
    assert.deepEqual(
        await downloadAttachment(CDN, fetchImpl, { maxBytes: 10 }),
        { ok: false, error: "too-large" },
    );
});

test("download: streamed body over the cap is too-large", async () => {
    const { fetchImpl } = stubFetch([
        streamRes([new Uint8Array(6), new Uint8Array(6)]),
    ]);
    assert.deepEqual(
        await downloadAttachment(CDN, fetchImpl, { maxBytes: 10 }),
        { ok: false, error: "too-large" },
    );
});

test("download: streamed body under the cap is joined in order", async () => {
    const { fetchImpl } = stubFetch([
        streamRes([new Uint8Array([1, 2]), new Uint8Array([3])]),
    ]);
    const r = await downloadAttachment(CDN, fetchImpl, { maxBytes: 10 });
    assert.equal(r.ok, true);
    assert.deepEqual(Array.from(r.data), [1, 2, 3]);
    assert.equal(r.contentType, "");
});

test("download: non-2xx is http-error, thrown fetch is unreachable", async () => {
    const a = stubFetch([new Response("gone", { status: 404 })]);
    assert.deepEqual(await downloadAttachment(CDN, a.fetchImpl), {
        ok: false,
        error: "http-error",
        status: 404,
    });
    const b = stubFetch([new TypeError("offline")]);
    assert.deepEqual(await downloadAttachment(CDN, b.fetchImpl), {
        ok: false,
        error: "unreachable",
    });
});

test("download: file names are decoded and sanitised", async () => {
    const cases = [
        ["/attachments/1/2/my%20cat.gif", "my cat.gif"],
        ["/attachments/1/2/bad%2Fname.gif", "badname.gif"],
        ["/attachments/1/2/%E0%A4%A.gif", "%E0%A4%A.gif"],
        ["/attachments/1/2/ctrl%01%7Fx.gif", "ctrlx.gif"],
        ["/attachments/1/2/" + "a".repeat(300), "a".repeat(200)],
        ["/attachments/1/2/%5C%2F", "discord-gif"],
    ];
    for (const [path, want] of cases) {
        const { fetchImpl } = stubFetch([new Response("x", { status: 200 })]);
        const r = await downloadAttachment(
            "https://cdn.discordapp.com" + path,
            fetchImpl,
        );
        assert.equal(r.ok, true, path);
        assert.equal(r.name, want, path);
    }
});
