// Run with: node --test electron/linkPage.test.cjs

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    fetchLinkPage,
    isPublicAddress,
    USER_AGENT,
    MAX_HTML_BYTES,
    MAX_IMAGE_BYTES,
    MAX_REDIRECTS,
} = require("./linkPage.cjs");

const PUBLIC_HOST_IP = "93.184.216.34";

// Fake deps. `routes` maps a URL to a Response (or a function of the init).
// Unknown URLs get a 404. Every fetch call is recorded.
function fakeDeps(routes, extra = {}) {
    const calls = [];
    const deps = {
        fetch: async (url, init) => {
            calls.push({ url, init });
            const route = routes[url];
            if (!route) return new Response("nope", { status: 404 });
            return typeof route === "function" ? route(init) : route;
        },
        lookup: async () => [{ address: PUBLIC_HOST_IP, family: 4 }],
        ...extra,
    };
    return { deps, calls };
}

function html(body, type = "text/html; charset=utf-8") {
    return new Response(body, {
        status: 200,
        headers: { "content-type": type },
    });
}

function redirect(location, status = 302) {
    return new Response(null, { status, headers: { location } });
}

test("isPublicAddress accepts public addresses", () => {
    assert.equal(isPublicAddress("8.8.8.8"), true);
    assert.equal(isPublicAddress("2606:4700::1"), true);
    assert.equal(isPublicAddress("::ffff:8.8.8.8"), true);
    assert.equal(isPublicAddress("::ffff:0808:0808"), true);
});

test("isPublicAddress rejects private, reserved and invalid addresses", () => {
    const bad = [
        "0.0.0.0",
        "10.1.2.3",
        "100.64.0.1",
        "100.127.255.255",
        "127.0.0.1",
        "169.254.10.10",
        "172.16.0.1",
        "172.31.255.255",
        "192.0.0.5",
        "192.0.2.1",
        "192.168.1.1",
        "198.18.0.1",
        "198.19.255.255",
        "198.51.100.7",
        "203.0.113.9",
        "224.0.0.1",
        "240.0.0.1",
        "255.255.255.255",
        "::",
        "::1",
        "fc00::1",
        "fd12:3456::1",
        "fe80::1",
        "ff02::1",
        "2001:db8::1",
        "::ffff:127.0.0.1",
        "::ffff:10.0.0.1",
        "::ffff:7f00:1",
        "::ffff:c0a8:0101",
        "not an ip",
        "1.2.3",
        "",
    ];
    for (const ip of bad) assert.equal(isPublicAddress(ip), false, ip);
    assert.equal(isPublicAddress(null), false);
    assert.equal(isPublicAddress(undefined), false);
});

test("rejects non-http schemes and mode values without fetching", async () => {
    const { deps, calls } = fakeDeps({});
    assert.equal(
        await fetchLinkPage("ftp://example.com/a", "page", deps),
        null,
    );
    assert.equal(await fetchLinkPage("file:///etc/passwd", "page", deps), null);
    assert.equal(
        await fetchLinkPage("https://example.com/", "video", deps),
        null,
    );
    assert.equal(calls.length, 0);
});

test("rejects URLs with credentials", async () => {
    const { deps, calls } = fakeDeps({});
    assert.equal(
        await fetchLinkPage("https://user:pw@example.com/", "page", deps),
        null,
    );
    assert.equal(calls.length, 0);
});

test("rejects a host resolving to loopback", async () => {
    const { deps, calls } = fakeDeps(
        { "https://evil.example/": html("hi") },
        { lookup: async () => [{ address: "127.0.0.1", family: 4 }] },
    );
    assert.equal(
        await fetchLinkPage("https://evil.example/", "page", deps),
        null,
    );
    assert.equal(calls.length, 0);
});

test("rejects a host when any resolved address is private", async () => {
    const { deps, calls } = fakeDeps(
        { "https://mixed.example/": html("hi") },
        {
            lookup: async () => [
                { address: PUBLIC_HOST_IP, family: 4 },
                { address: "10.0.0.2", family: 4 },
            ],
        },
    );
    assert.equal(
        await fetchLinkPage("https://mixed.example/", "page", deps),
        null,
    );
    assert.equal(calls.length, 0);
});

test("rejects a literal private IP without a lookup", async () => {
    let looked = false;
    const { deps } = fakeDeps(
        {},
        {
            lookup: async () => {
                looked = true;
                return [];
            },
        },
    );
    assert.equal(await fetchLinkPage("http://[::1]:8080/", "page", deps), null);
    assert.equal(
        await fetchLinkPage("http://192.168.0.10/", "page", deps),
        null,
    );
    assert.equal(looked, false);
});

test("rejects a redirect hop to a private host", async () => {
    const { deps, calls } = fakeDeps({
        "https://example.com/": redirect("http://10.0.0.5/admin"),
    });
    assert.equal(
        await fetchLinkPage("https://example.com/", "page", deps),
        null,
    );
    assert.equal(calls.length, 1);
});

test("follows a public redirect and reports the final URL", async () => {
    const { deps, calls } = fakeDeps({
        "https://example.com/start": redirect("/final"),
        "https://example.com/final": html("<title>ok</title>"),
    });
    const result = await fetchLinkPage(
        "https://example.com/start",
        "page",
        deps,
    );
    assert.deepEqual(result, {
        kind: "html",
        finalUrl: "https://example.com/final",
        html: "<title>ok</title>",
    });
    assert.equal(calls.length, 2);
});

test("caps redirects at MAX_REDIRECTS", async () => {
    const { deps, calls } = fakeDeps({
        "https://loop.example/": redirect("https://loop.example/"),
    });
    assert.equal(
        await fetchLinkPage("https://loop.example/", "page", deps),
        null,
    );
    assert.equal(calls.length, MAX_REDIRECTS + 1);
});

test("accepts exactly MAX_REDIRECTS redirects before the page", async () => {
    const routes = {};
    for (let i = 0; i < MAX_REDIRECTS; i++) {
        routes[`https://chain.example/${i}`] = redirect(`/${i + 1}`);
    }
    routes[`https://chain.example/${MAX_REDIRECTS}`] = html("done");
    const { deps, calls } = fakeDeps(routes);
    const result = await fetchLinkPage("https://chain.example/0", "page", deps);
    assert.equal(result?.kind, "html");
    assert.equal(calls.length, MAX_REDIRECTS + 1);
});

test("sends the User-Agent and Accept headers with manual redirects", async () => {
    const { deps, calls } = fakeDeps({
        "https://example.com/": html("<p>x</p>"),
    });
    await fetchLinkPage("https://example.com/", "page", deps);
    const init = calls[0].init;
    assert.equal(init.headers["User-Agent"], USER_AGENT);
    assert.match(init.headers.Accept, /text\/html/);
    assert.equal(init.redirect, "manual");
    assert.equal(init.credentials, "omit");
});

test("page mode returns html", async () => {
    const { deps } = fakeDeps({
        "https://example.com/": html("<h1>hello</h1>"),
    });
    assert.deepEqual(
        await fetchLinkPage("https://example.com/", "page", deps),
        {
            kind: "html",
            finalUrl: "https://example.com/",
            html: "<h1>hello</h1>",
        },
    );
});

test("html is truncated to MAX_HTML_BYTES and the first bytes are kept", async () => {
    const body = Buffer.alloc(MAX_HTML_BYTES + 5000, "a");
    const { deps } = fakeDeps({
        "https://big.example/": html(body),
    });
    const result = await fetchLinkPage("https://big.example/", "page", deps);
    assert.equal(result?.kind, "html");
    assert.equal(result.html.length, MAX_HTML_BYTES);
    assert.equal(result.html, "a".repeat(MAX_HTML_BYTES));
});

test("image mode rejects html", async () => {
    const { deps } = fakeDeps({
        "https://example.com/": html("<p>x</p>"),
    });
    assert.equal(
        await fetchLinkPage("https://example.com/", "image", deps),
        null,
    );
});

test("image mode returns base64 image bytes", async () => {
    const { deps } = fakeDeps({
        "https://example.com/a.png": new Response(Buffer.from([1, 2, 3]), {
            status: 200,
            headers: { "content-type": "image/png; charset=binary" },
        }),
    });
    assert.deepEqual(
        await fetchLinkPage("https://example.com/a.png", "image", deps),
        {
            kind: "image",
            finalUrl: "https://example.com/a.png",
            contentType: "image/png",
            base64: "AQID",
        },
    );
});

test("image over MAX_IMAGE_BYTES gives null", async () => {
    const { deps } = fakeDeps({
        "https://example.com/huge.jpg": new Response(
            Buffer.alloc(MAX_IMAGE_BYTES + 1),
            { status: 200, headers: { "content-type": "image/jpeg" } },
        ),
    });
    assert.equal(
        await fetchLinkPage("https://example.com/huge.jpg", "image", deps),
        null,
    );
});

test("svg is rejected in both modes", async () => {
    const svg = () =>
        new Response("<svg></svg>", {
            status: 200,
            headers: { "content-type": "image/svg+xml" },
        });
    const { deps } = fakeDeps({ "https://example.com/x.svg": svg });
    assert.equal(
        await fetchLinkPage("https://example.com/x.svg", "image", deps),
        null,
    );
    assert.equal(
        await fetchLinkPage("https://example.com/x.svg", "page", deps),
        null,
    );
});

test("non-2xx final response gives null", async () => {
    const { deps } = fakeDeps({
        "https://example.com/gone": new Response("<p>gone</p>", {
            status: 404,
            headers: { "content-type": "text/html" },
        }),
        "https://example.com/err": new Response("x", {
            status: 500,
            headers: { "content-type": "text/html" },
        }),
    });
    assert.equal(
        await fetchLinkPage("https://example.com/gone", "page", deps),
        null,
    );
    assert.equal(
        await fetchLinkPage("https://example.com/err", "page", deps),
        null,
    );
});

test("unknown content type gives null", async () => {
    const { deps } = fakeDeps({
        "https://example.com/data": new Response("{}", {
            status: 200,
            headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(
        await fetchLinkPage("https://example.com/data", "page", deps),
        null,
    );
    assert.equal(
        await fetchLinkPage("https://example.com/data", "image", deps),
        null,
    );
});

test("a hung request is cut off by the timeout", async () => {
    const { deps } = fakeDeps(
        {},
        {
            timeoutMs: 20,
            fetch: () => new Promise(() => {}),
        },
    );
    assert.equal(
        await fetchLinkPage("https://slow.example/", "page", deps),
        null,
    );
});

test("a throwing fetch gives null instead of rejecting", async () => {
    const { deps } = fakeDeps(
        {},
        {
            fetch: async () => {
                throw new Error("network down");
            },
        },
    );
    assert.equal(
        await fetchLinkPage("https://example.com/", "page", deps),
        null,
    );
});
