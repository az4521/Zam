import { describe, expect, it, vi } from "vitest";
import {
    buildBundledEntry,
    metaFromHomeserver,
    parseOpenGraph,
    readBundledPreview,
} from "./bundledPreview";
import { createPreviewBundler, type BundlerDeps } from "./previewBundler";
import { urlsToPreview, withUrlPreviewHints } from "./urlPreviews";

const URL_A = "https://a.example/post";
const FILE = {
    url: "mxc://hs.example/abcDEF123",
    key: {
        kty: "oct",
        key_ops: ["encrypt", "decrypt"],
        alg: "A256CTR",
        k: "kkk",
        ext: true,
    },
    iv: "ivv",
    hashes: { sha256: "hhh" },
    v: "v2",
};

describe("parseOpenGraph", () => {
    it("reads OpenGraph, decodes entities and resolves relative images", () => {
        const html = `<html><head>
            <meta property="og:title" content="Tom &amp; Jerry &#8217;s">
            <meta content='Desc' name="og:description">
            <meta property="og:site_name" content="Site">
            <meta property="og:image" content="/img/cat.png">
            <meta property="og:image:width" content="640">
            <title>ignored</title></head><body>
            <meta property="og:title" content="body tag ignored"></body>`;
        const m = parseOpenGraph(html, "https://a.example/x/post");
        expect(m.title).toBe("Tom & Jerry ’s");
        expect(m.description).toBe("Desc");
        expect(m.siteName).toBe("Site");
        expect(m.image).toBe("https://a.example/img/cat.png");
        expect(m.imageWidth).toBe(640);
        expect(m.url).toBe("https://a.example/x/post");
    });

    it("falls back to twitter tags, <title> and meta description", () => {
        const html = `<head><title>Plain &lt;title&gt;</title>
            <meta name="description" content="d">
            <meta name="twitter:image" content="https://cdn.example/i.jpg"></head>`;
        const m = parseOpenGraph(html, URL_A);
        expect(m.title).toBe("Plain <title>");
        expect(m.description).toBe("d");
        expect(m.image).toBe("https://cdn.example/i.jpg");
    });

    it("drops a non-web image URL", () => {
        const html = `<meta property="og:image" content="javascript:alert(1)">`;
        expect(parseOpenGraph(html, URL_A).image).toBeUndefined();
    });
});

describe("readBundledPreview", () => {
    const content = (entries: unknown[]) => ({
        "com.beeper.linkpreviews": entries,
    });

    it("reads a plain-image entry", () => {
        const p = readBundledPreview(
            content([
                {
                    matched_url: URL_A,
                    "og:title": "T",
                    "og:image": "mxc://hs.example/media1",
                    "og:image:width": 100,
                    "og:image:height": "50",
                    "matrix:image:size": 1234,
                },
            ]),
            URL_A,
        );
        expect(p).toMatchObject({
            title: "T",
            imageMxc: "mxc://hs.example/media1",
            imageWidth: 100,
            imageHeight: 50,
            imageSize: 1234,
        });
    });

    it("reads an encrypted image (unstable and stable names)", () => {
        for (const key of ["beeper:image:encryption", "matrix:image:encrypted"])
            expect(
                readBundledPreview(
                    content([{ matched_url: URL_A, [key]: FILE }]),
                    URL_A,
                )?.imageFile?.url,
            ).toBe(FILE.url);
    });

    it("rejects third-party images and malformed files", () => {
        expect(
            readBundledPreview(
                content([
                    {
                        matched_url: URL_A,
                        "og:image": "https://evil.example/x.png",
                    },
                ]),
                URL_A,
            ),
        ).toBeNull();
        expect(
            readBundledPreview(
                content([
                    {
                        matched_url: URL_A,
                        "beeper:image:encryption": {
                            ...FILE,
                            url: "https://x",
                        },
                    },
                ]),
                URL_A,
            ),
        ).toBeNull();
    });

    it("a matched-url-only entry is not a bundled preview", () => {
        expect(
            readBundledPreview(content([{ matched_url: URL_A }]), URL_A),
        ).toBeNull();
    });

    it("caps text and ignores a bad og:url", () => {
        const p = readBundledPreview(
            content([
                {
                    "matrix:matched_url": URL_A,
                    "og:title": "x".repeat(1000),
                    "og:url": "javascript:alert(1)",
                },
            ]),
            URL_A,
        );
        expect(p?.title?.length).toBe(300);
        expect(p?.canonicalUrl).toBeUndefined();
    });
});

describe("buildBundledEntry", () => {
    it("builds plain and encrypted entries", () => {
        expect(
            buildBundledEntry(
                URL_A,
                { title: "T" },
                {
                    uploaded: { url: "mxc://hs/x" },
                    size: 10,
                    type: "image/png",
                    width: 2,
                    height: 3,
                },
            ),
        ).toEqual({
            matched_url: URL_A,
            "og:title": "T",
            "og:image": "mxc://hs/x",
            "matrix:image:size": 10,
            "og:image:type": "image/png",
            "og:image:width": 2,
            "og:image:height": 3,
        });
        const enc = buildBundledEntry(
            URL_A,
            {},
            {
                uploaded: { file: FILE },
                size: 10,
            },
        );
        expect(enc["beeper:image:encryption"]).toBe(FILE);
        expect(enc["og:image"]).toBeUndefined();
    });

    it("round-trips through the reader", () => {
        const entry = buildBundledEntry(
            URL_A,
            { title: "T" },
            {
                uploaded: { file: FILE },
                size: 10,
            },
        );
        const content = withUrlPreviewHints(
            { msgtype: "m.text", body: `see ${URL_A}` },
            new Map([[URL_A, entry]]),
        );
        expect(urlsToPreview(content, `see ${URL_A}`)).toEqual([URL_A]);
        expect(readBundledPreview(content, URL_A)?.imageFile?.url).toBe(
            FILE.url,
        );
    });
});

describe("metaFromHomeserver", () => {
    it("keeps the homeserver's mxc image", () => {
        expect(
            metaFromHomeserver(
                {
                    "og:title": "T",
                    "og:image": "mxc://hs/i",
                    "matrix:image:size": 5,
                },
                URL_A,
            ),
        ).toMatchObject({ imageMxc: "mxc://hs/i", imageSize: 5 });
        expect(metaFromHomeserver({ error: "x" }, URL_A)).toBeNull();
        expect(metaFromHomeserver({}, URL_A)).toBeNull();
    });
});

describe("withUrlPreviewHints with bundles", () => {
    it("adds no list when nothing was generated or suppressed", () => {
        const c = { msgtype: "m.text", body: URL_A };
        expect(withUrlPreviewHints(c, new Map())).toBe(c);
    });

    it("a URL without a bundle gets a matched-url-only entry", () => {
        const B = "https://b.example/";
        const out = withUrlPreviewHints(
            { msgtype: "m.text", body: `${URL_A} ${B}` },
            new Map([[URL_A, { matched_url: URL_A, "og:title": "T" }]]),
        );
        expect(out["com.beeper.linkpreviews"]).toEqual([
            { matched_url: URL_A, "og:title": "T" },
            { matched_url: B },
        ]);
    });
});

function deps(over: Partial<BundlerDeps> = {}): BundlerDeps {
    return {
        fetchPage: null,
        homeserverPreview: vi.fn(async () => null),
        upload: vi.fn(async () => ({ url: "mxc://hs/up" })),
        ...over,
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("previewBundler", () => {
    it("uses the device page and uploads its image into the room", async () => {
        const fetchPage = vi.fn(async (url: string, mode: string) =>
            mode === "page"
                ? {
                      kind: "html" as const,
                      finalUrl: url,
                      html: `<meta property="og:title" content="T"><meta property="og:image" content="https://a.example/i.png">`,
                  }
                : {
                      kind: "image" as const,
                      finalUrl: url,
                      contentType: "image/png",
                      base64: btoa("PNGDATA"),
                  },
        );
        const d = deps({ fetchPage });
        const b = createPreviewBundler(d);
        expect(b.ready([URL_A], "!r")).toEqual(new Map());
        await b.prepare(URL_A, "!r");
        expect(d.upload).toHaveBeenCalledWith(
            "!r",
            expect.any(Uint8Array),
            "image/png",
        );
        expect(d.homeserverPreview).not.toHaveBeenCalled();
        expect(b.ready([URL_A], "!r").get(URL_A)).toMatchObject({
            matched_url: URL_A,
            "og:title": "T",
            "og:image": "mxc://hs/up",
            "matrix:image:size": 7,
        });
        // Another room uploads its own copy; the page is not fetched again.
        await b.prepare(URL_A, "!other");
        expect(d.upload).toHaveBeenCalledTimes(2);
        expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    it("falls back to the homeserver when the device finds nothing", async () => {
        const d = deps({
            fetchPage: vi.fn(async () => null),
            homeserverPreview: vi.fn(async () => ({
                "og:title": "HS",
                "og:image": "mxc://hs/i",
            })),
        });
        const b = createPreviewBundler(d);
        await b.prepare(URL_A, "!r");
        expect(d.upload).not.toHaveBeenCalled();
        expect(b.ready([URL_A], "!r").get(URL_A)).toMatchObject({
            "og:title": "HS",
            "og:image": "mxc://hs/i",
        });
    });

    it("keeps the text when the image upload fails", async () => {
        const d = deps({
            fetchPage: vi.fn(async (url: string, mode: string) =>
                mode === "page"
                    ? {
                          kind: "html" as const,
                          finalUrl: url,
                          html: `<meta property="og:title" content="T"><meta property="og:image" content="https://a.example/i.png">`,
                      }
                    : {
                          kind: "image" as const,
                          finalUrl: url,
                          contentType: "image/png",
                          base64: btoa("x"),
                      },
            ),
            upload: vi.fn(async () => {
                throw new Error("nope");
            }),
        });
        const b = createPreviewBundler(d);
        await b.prepare(URL_A, "!r");
        expect(b.ready([URL_A], "!r").get(URL_A)).toEqual({
            matched_url: URL_A,
            "og:title": "T",
            "og:url": URL_A,
        });
    });

    it("leaves out links with no preview anywhere", async () => {
        const b = createPreviewBundler(deps());
        await b.prepare(URL_A, "!r");
        await flush();
        expect(b.ready([URL_A], "!r").size).toBe(0);
    });

    it("collect waits for links still being prepared", async () => {
        const d = deps({
            homeserverPreview: vi.fn(async () => ({ "og:title": "HS" })),
        });
        const b = createPreviewBundler(d);
        const got = await b.collect([URL_A], "!r", 1000);
        expect(got.get(URL_A)).toMatchObject({ "og:title": "HS" });
    });
});
