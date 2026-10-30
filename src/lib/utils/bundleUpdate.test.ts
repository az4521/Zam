import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";
import { createHash, generateKeyPairSync } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";

const require = createRequire(import.meta.url);
const {
    packBundle,
    unpackBundle,
    signManifest,
    verifyManifest,
    isSafeEntryPath,
} = require("../../../electron/bundleFormat.cjs");
const {
    createBundleUpdater,
    compareVersions,
} = require("../../../electron/bundleUpdater.cjs");

const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const PRIVATE = keys.privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
const PUBLIC = keys.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zam-bundle-test-"));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function site(name: string, files: Record<string, string>): string {
    const dir = path.join(tmp, name);
    for (const [p, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
        fs.writeFileSync(path.join(dir, p), body);
    }
    return dir;
}

function sha512(buf: Buffer): string {
    return createHash("sha512").update(buf).digest("base64");
}

describe("bundle format", () => {
    it("round-trips a folder", async () => {
        const src = site("src", {
            "index.html": "<html>hi</html>",
            "_app/immutable/a.js": "let a = 1;",
        });
        const out = path.join(tmp, "out");
        await unpackBundle(await packBundle(src), out);
        expect(fs.readFileSync(path.join(out, "index.html"), "utf8")).toBe(
            "<html>hi</html>",
        );
        expect(
            fs.readFileSync(path.join(out, "_app/immutable/a.js"), "utf8"),
        ).toBe("let a = 1;");
    });

    function rawArchive(index: unknown[], data: string): Buffer {
        const idx = Buffer.from(JSON.stringify(index));
        const len = Buffer.alloc(4);
        len.writeUInt32BE(idx.length);
        return zlib.gzipSync(
            Buffer.concat([Buffer.from("ZB1\n"), len, idx, Buffer.from(data)]),
        );
    }

    it("refuses paths that leave the folder", async () => {
        for (const p of ["../evil", "/abs", "a/../../b", "a\\b", "C:/x", ""]) {
            const out = path.join(tmp, "o-" + Math.random());
            await expect(
                unpackBundle(rawArchive([{ p, s: 1 }], "x"), out),
            ).rejects.toThrow();
            expect(isSafeEntryPath(p)).toBe(false);
        }
    });

    it("refuses a truncated archive and one with no index.html", async () => {
        await expect(
            unpackBundle(
                rawArchive([{ p: "index.html", s: 50 }], "short"),
                path.join(tmp, "a"),
            ),
        ).rejects.toThrow(/truncated/);
        await expect(
            unpackBundle(
                rawArchive([{ p: "other.html", s: 1 }], "x"),
                path.join(tmp, "b"),
            ),
        ).rejects.toThrow(/index\.html/);
        await expect(
            unpackBundle(
                zlib.gzipSync(Buffer.from("nope")),
                path.join(tmp, "c"),
            ),
        ).rejects.toThrow();
    });
});

describe("manifest signature", () => {
    const manifest = {
        version: "1.39.0",
        shellHash: "abc",
        androidShellHash: "def",
        file: "zam-bundle-1.39.0.zbundle",
        sha512: "h",
        size: 10,
    };

    it("verifies what was signed and nothing else", () => {
        const signed = {
            ...manifest,
            signature: signManifest(manifest, PRIVATE),
        };
        expect(verifyManifest(signed, PUBLIC)).toBe(true);
        for (const change of [
            { version: "9.9.9" },
            { shellHash: "other" },
            { androidShellHash: "other" },
            { sha512: "x" },
            { size: 11 },
            { file: "evil.zbundle" },
        ])
            expect(verifyManifest({ ...signed, ...change }, PUBLIC)).toBe(
                false,
            );
    });

    it("rejects another key and malformed manifests", () => {
        const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
            .publicKey.export({ format: "der", type: "spki" })
            .toString("base64");
        const signed = {
            ...manifest,
            signature: signManifest(manifest, PRIVATE),
        };
        expect(verifyManifest(signed, other)).toBe(false);
        expect(
            verifyManifest({ ...signed, signature: undefined }, PUBLIC),
        ).toBe(false);
        expect(verifyManifest(null, PUBLIC)).toBe(false);
    });
});

describe("compareVersions", () => {
    it("orders numerically and puts pre-releases below the release", () => {
        expect(compareVersions("1.10.0", "1.9.9")).toBe(1);
        expect(compareVersions("1.38.0", "1.38.0")).toBe(0);
        expect(compareVersions("1.38.0", "1.39.0")).toBe(-1);
        expect(compareVersions("1.39.0-beta", "1.39.0")).toBe(-1);
    });
});

describe("bundle updater", () => {
    const PREFIX = "https://github.com/az4521/Zam/releases/download/v1/";
    const SHELL = "a".repeat(64);

    type Release = Awaited<ReturnType<typeof release>>;

    async function release(version: string, shellHash = SHELL) {
        const archive = await packBundle(
            site(`rel-${version}`, { "index.html": `ui ${version}` }),
        );
        const manifest: Record<string, unknown> = {
            version,
            shellHash,
            androidShellHash: "d".repeat(64),
            file: `zam-bundle-${version}.zbundle`,
            sha512: sha512(archive),
            size: archive.length,
        };
        manifest.signature = signManifest(manifest, PRIVATE);
        return { archive, manifest };
    }

    function feedFor(rel: Release | null) {
        return {
            assets: rel
                ? [
                      {
                          name: "zam-bundle.json",
                          browser_download_url: PREFIX + "zam-bundle.json",
                      },
                      {
                          name: rel.manifest.file,
                          browser_download_url: PREFIX + rel.manifest.file,
                      },
                  ]
                : [],
        };
    }

    function updaterFor(
        rel: Release | null,
        over: Record<string, unknown> = {},
        shellHash = SHELL,
        shellVersion = "1.38.0",
    ) {
        const dir = path.join(tmp, "web-bundles");
        return {
            dir,
            make: () =>
                createBundleUpdater({
                    dir,
                    shellVersion,
                    shellHash,
                    publicKey: PUBLIC,
                    releaseUrl: "feed",
                    assetUrlPrefix: PREFIX,
                    fetchJson: async (url: string) =>
                        url === "feed" ? feedFor(rel) : rel!.manifest,
                    download: async (
                        _u: string,
                        dest: string,
                        o: { onProgress: (n: number) => void },
                    ) => {
                        fs.writeFileSync(dest, rel!.archive);
                        o.onProgress(1);
                        return {
                            sha512: sha512(rel!.archive),
                            size: rel!.archive.length,
                        };
                    },
                    ...over,
                }),
        };
    }

    it("finds, stages and applies a newer bundle for this shell", async () => {
        const { make, dir } = updaterFor(await release("1.39.0"));
        const u = make();
        u.activeRoot({ applyStaged: false });
        const found = await u.check();
        expect(found).toMatchObject({ kind: "bundle", staged: false });
        await u.download(found, () => {});
        expect(u.stagedVersion()).toBe("1.39.0");
        // Staged only: still serving the packed site.
        expect(u.currentVersion()).toBe("1.38.0");
        const root = u.apply("1.39.0");
        expect(fs.readFileSync(path.join(root, "index.html"), "utf8")).toBe(
            "ui 1.39.0",
        );
        // The next launch serves it, once the page has confirmed it loaded.
        u.markReady();
        expect(make().activeRoot({ applyStaged: false })).toBe(
            path.join(dir, "1.39.0"),
        );
    });

    it("applies a staged bundle at launch only when asked to", async () => {
        const { make, dir } = updaterFor(await release("1.39.0"));
        const u = make();
        u.activeRoot({ applyStaged: false });
        await u.download(await u.check(), () => {});
        expect(make().activeRoot({ applyStaged: false })).toBeNull();
        // A staged bundle survives a launch that did not apply it.
        expect(fs.existsSync(path.join(dir, "1.39.0"))).toBe(true);
        expect(make().activeRoot({ applyStaged: true })).toBe(
            path.join(dir, "1.39.0"),
        );
    });

    it("sends a release for a different shell to the installer", async () => {
        const { make } = updaterFor(await release("1.39.0", "b".repeat(64)));
        expect(await make().check()).toEqual({
            kind: "shell",
            version: "1.39.0",
        });
    });

    it("ignores a release that is not newer, even if validly signed", async () => {
        const { make } = updaterFor(await release("1.38.0"));
        expect(await make().check()).toEqual({ kind: "none" });
    });

    it("does nothing when the release has no bundle", async () => {
        expect(await updaterFor(null).make().check()).toEqual({
            kind: "none",
        });
    });

    it("rejects a manifest that does not verify", async () => {
        const rel = await release("1.39.0");
        rel.manifest.version = "1.40.0";
        await expect(updaterFor(rel).make().check()).rejects.toThrow(
            /signature/,
        );
    });

    it("rejects assets that are not on the release host", async () => {
        const rel = await release("1.39.0");
        const { make } = updaterFor(rel, {
            fetchJson: async (url: string) =>
                url === "feed"
                    ? {
                          assets: [
                              {
                                  name: "zam-bundle.json",
                                  browser_download_url:
                                      "https://evil.example/m",
                              },
                          ],
                      }
                    : rel.manifest,
        });
        await expect(make().check()).rejects.toThrow(/release host/);
    });

    it("refuses a download that does not match the signed hash", async () => {
        const rel = await release("1.39.0");
        const { make, dir } = updaterFor(rel, {
            download: async (_u: string, dest: string) => {
                fs.writeFileSync(dest, "tampered");
                return { sha512: "nope", size: rel.archive.length };
            },
        });
        const u = make();
        u.activeRoot({ applyStaged: false });
        await expect(u.download(await u.check(), () => {})).rejects.toThrow(
            /manifest/,
        );
        expect(u.stagedVersion()).toBeNull();
        expect(fs.readdirSync(dir).filter((n) => n.startsWith("."))).toEqual(
            [],
        );
    });

    it("drops a bundle whose page never loaded, and never offers it again", async () => {
        const { make } = updaterFor(await release("1.39.0"));
        const u = make();
        u.activeRoot({ applyStaged: false });
        await u.download(await u.check(), () => {});
        u.apply("1.39.0");
        // No markReady(): the next launch finds the attempt marker.
        const next = make();
        expect(next.activeRoot({ applyStaged: true })).toBeNull();
        expect(next.currentVersion()).toBe("1.38.0");
        expect(await next.check()).toEqual({ kind: "none" });
    });

    it("stops using a bundle once the installed shell is as new", async () => {
        const rel = await release("1.39.0");
        const u = updaterFor(rel).make();
        u.activeRoot({ applyStaged: false });
        await u.download(await u.check(), () => {});
        u.apply("1.39.0");
        u.markReady();
        const reinstalled = updaterFor(rel, {}, SHELL, "1.39.0").make();
        expect(reinstalled.activeRoot({ applyStaged: true })).toBeNull();
    });

    it("ignores staged bundles built for another shell", async () => {
        const rel = await release("1.39.0");
        const u = updaterFor(rel).make();
        u.activeRoot({ applyStaged: false });
        await u.download(await u.check(), () => {});
        const other = updaterFor(rel, {}, "c".repeat(64)).make();
        expect(other.activeRoot({ applyStaged: true })).toBeNull();
    });
});
