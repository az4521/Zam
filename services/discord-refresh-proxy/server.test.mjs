import { test } from "node:test";
import assert from "node:assert/strict";
import {
    createServer,
    isValidAttachmentUrl,
    isValidUrlList,
    filterRefreshedUrls,
    parseAllowedOrigins,
    corsAllowOrigin,
} from "./server.mjs";

const GOOD =
    "https://cdn.discordapp.com/attachments/1/2/cat.gif?ex=abc&is=def&hm=123";

test("isValidAttachmentUrl accepts Discord CDN attachment links", () => {
    assert.equal(isValidAttachmentUrl(GOOD), true);
    assert.equal(
        isValidAttachmentUrl(
            "https://media.discordapp.net/ephemeral-attachments/1/2/x.gif",
        ),
        true,
    );
});

test("isValidAttachmentUrl rejects other hosts, schemes and paths", () => {
    assert.equal(
        isValidAttachmentUrl("http://cdn.discordapp.com/attachments/1/2/x.gif"),
        false,
    );
    assert.equal(
        isValidAttachmentUrl("https://evil.example.com/attachments/1/2/x.gif"),
        false,
    );
    assert.equal(
        isValidAttachmentUrl("https://sub.cdn.discordapp.com/attachments/x"),
        false,
    );
    assert.equal(
        isValidAttachmentUrl("https://cdn.discordapp.com/avatars/1/2.png"),
        false,
    );
    assert.equal(
        isValidAttachmentUrl(
            "https://user:pw@cdn.discordapp.com/attachments/x",
        ),
        false,
    );
    assert.equal(isValidAttachmentUrl("not a url"), false);
    assert.equal(isValidAttachmentUrl(""), false);
    assert.equal(isValidAttachmentUrl(42), false);
});

test("isValidAttachmentUrl enforces the 2048 character limit", () => {
    const long = "https://cdn.discordapp.com/attachments/" + "a".repeat(2048);
    assert.equal(isValidAttachmentUrl(long), false);
});

test("isValidUrlList enforces array shape and the 50 entry cap", () => {
    assert.equal(isValidUrlList([GOOD]), true);
    assert.equal(isValidUrlList([]), false);
    assert.equal(isValidUrlList("x"), false);
    assert.equal(isValidUrlList(Array(51).fill(GOOD)), false);
    assert.equal(isValidUrlList(Array(50).fill(GOOD)), true);
    assert.equal(isValidUrlList([GOOD, "https://example.com/x"]), false);
});

test("filterRefreshedUrls keeps only https Discord CDN results", () => {
    const kept = filterRefreshedUrls([
        { original: "a", refreshed: GOOD },
        { original: "b", refreshed: "http://cdn.discordapp.com/attachments/x" },
        { original: "c", refreshed: "https://evil.example.com/attachments/x" },
        { original: "d", refreshed: "javascript:alert(1)" },
        { original: 5, refreshed: GOOD },
        null,
        "junk",
    ]);
    assert.deepEqual(kept, [{ original: "a", refreshed: GOOD }]);
    assert.deepEqual(filterRefreshedUrls("nope"), []);
});

test("parseAllowedOrigins handles unset, wildcard and lists", () => {
    assert.equal(parseAllowedOrigins(undefined), "*");
    assert.equal(parseAllowedOrigins(""), "*");
    assert.equal(parseAllowedOrigins("*"), "*");
    assert.deepEqual(
        parseAllowedOrigins(" https://a.example.com , https://b.example.com ,"),
        ["https://a.example.com", "https://b.example.com"],
    );
});

test("corsAllowOrigin echoes allowed origins and omits others", () => {
    assert.equal(corsAllowOrigin("https://x.example.com", "*"), "*");
    assert.equal(corsAllowOrigin(undefined, "*"), "*");
    const list = ["https://a.example.com"];
    assert.equal(
        corsAllowOrigin("https://a.example.com", list),
        "https://a.example.com",
    );
    assert.equal(corsAllowOrigin("https://b.example.com", list), null);
    assert.equal(corsAllowOrigin(undefined, list), null);
});

// Starts the server on an ephemeral port and runs fn(baseUrl, calls).
async function withServer(fetchImpl, fn, options = {}) {
    const calls = [];
    const recordingFetch = async (url, init) => {
        calls.push({ url, init });
        return fetchImpl(url, init);
    };
    const server = createServer({
        token: "test-token",
        fetchImpl: recordingFetch,
        ...options,
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    try {
        await fn(`http://127.0.0.1:${port}`, calls);
    } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
}

test("GET /health returns ok", async () => {
    await withServer(
        async () => {
            throw new Error("should not be called");
        },
        async (base) => {
            const res = await fetch(`${base}/health`);
            assert.equal(res.status, 200);
            assert.equal(res.headers.get("cache-control"), "no-store");
            assert.equal(res.headers.get("content-type"), "application/json");
            assert.deepEqual(await res.json(), { ok: true });
        },
    );
});

test("POST /refresh round-trips through the stubbed Discord call", async () => {
    const stub = async () =>
        new Response(
            JSON.stringify({
                refreshed_urls: [
                    {
                        original: GOOD,
                        refreshed: GOOD.replace("hm=123", "hm=456"),
                    },
                    {
                        original: "x",
                        refreshed: "https://evil.example.com/attachments/x",
                    },
                ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
        );
    await withServer(stub, async (base, calls) => {
        const res = await fetch(`${base}/refresh`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Origin: "https://app.example.com",
            },
            body: JSON.stringify({ urls: [GOOD] }),
        });
        assert.equal(res.status, 200);
        assert.equal(res.headers.get("access-control-allow-origin"), "*");
        assert.equal(res.headers.get("vary"), "Origin");
        assert.deepEqual(await res.json(), {
            urls: [
                { original: GOOD, refreshed: GOOD.replace("hm=123", "hm=456") },
            ],
        });

        assert.equal(calls.length, 1);
        assert.equal(
            calls[0].url,
            "https://discord.com/api/v10/attachments/refresh-urls",
        );
        assert.equal(calls[0].init.method, "POST");
        assert.equal(calls[0].init.headers.Authorization, "Bot test-token");
        assert.deepEqual(JSON.parse(calls[0].init.body), {
            attachment_urls: [GOOD],
        });
    });
});

test("POST /refresh rejects a bad URL with 400 and never calls Discord", async () => {
    await withServer(
        async () => {
            throw new Error("should not be called");
        },
        async (base, calls) => {
            const res = await fetch(`${base}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    urls: [GOOD, "https://evil.example.com/attachments/x"],
                }),
            });
            assert.equal(res.status, 400);
            assert.deepEqual(await res.json(), { error: "bad-url" });
            assert.equal(calls.length, 0);
        },
    );
});

test("POST /refresh passes a Discord 429 through with retryAfter", async () => {
    const stub = async () =>
        new Response(
            JSON.stringify({ message: "slow down", retry_after: 12.5 }),
            {
                status: 429,
                headers: { "content-type": "application/json" },
            },
        );
    await withServer(stub, async (base) => {
        const res = await fetch(`${base}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: [GOOD] }),
        });
        assert.equal(res.status, 429);
        assert.deepEqual(await res.json(), {
            error: "rate-limited",
            retryAfter: 12.5,
        });
    });
});

test("POST /refresh maps other upstream failures to 502", async () => {
    const stub = async () => new Response("{}", { status: 401 });
    await withServer(stub, async (base) => {
        const res = await fetch(`${base}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: [GOOD] }),
        });
        assert.equal(res.status, 502);
        assert.deepEqual(await res.json(), { error: "upstream", status: 401 });
    });
});

test("POST /refresh with bad JSON is 400 bad-json", async () => {
    await withServer(
        async () => {
            throw new Error("should not be called");
        },
        async (base) => {
            const res = await fetch(`${base}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{not json",
            });
            assert.equal(res.status, 400);
            assert.deepEqual(await res.json(), { error: "bad-json" });
        },
    );
});

test("unknown paths are 404, wrong methods are 405, preflight is 204", async () => {
    await withServer(
        async () => {
            throw new Error("should not be called");
        },
        async (base) => {
            const notFound = await fetch(`${base}/nope`);
            assert.equal(notFound.status, 404);
            assert.deepEqual(await notFound.json(), { error: "not-found" });

            const wrongMethod = await fetch(`${base}/refresh`);
            assert.equal(wrongMethod.status, 405);

            const preflight = await fetch(`${base}/refresh`, {
                method: "OPTIONS",
                headers: { Origin: "https://app.example.com" },
            });
            assert.equal(preflight.status, 204);
            assert.equal(
                preflight.headers.get("access-control-allow-methods"),
                "GET, POST, OPTIONS",
            );
            assert.equal(
                preflight.headers.get("access-control-allow-headers"),
                "Content-Type",
            );
            assert.equal(
                preflight.headers.get("access-control-max-age"),
                "600",
            );
        },
    );
});

test("CORS header is omitted for origins outside the allowlist", async () => {
    await withServer(
        async () => {
            throw new Error("should not be called");
        },
        async (base) => {
            const allowed = await fetch(`${base}/health`, {
                headers: { Origin: "https://app.example.com" },
            });
            assert.equal(
                allowed.headers.get("access-control-allow-origin"),
                "https://app.example.com",
            );

            const denied = await fetch(`${base}/health`, {
                headers: { Origin: "https://evil.example.com" },
            });
            assert.equal(
                denied.headers.get("access-control-allow-origin"),
                null,
            );
            assert.equal(denied.headers.get("vary"), "Origin");
        },
        { allowedOrigins: ["https://app.example.com"] },
    );
});
