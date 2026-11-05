import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const {
    PACK_PATH,
    isPackedPath,
    packTwemoji,
    openTwemojiPack,
} = require("../../../electron/twemojiPack.cjs");
const {
    packBundle,
    unpackBundle,
} = require("../../../electron/bundleFormat.cjs");

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zam-twemoji-test-"));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function svgDir(count: number): Record<string, string> {
    const dir = path.join(tmp, "svg");
    fs.mkdirSync(dir, { recursive: true });
    const files: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
        const name = (0x1f300 + i).toString(16);
        files[name] = `<svg id="${name}">${"x".repeat(i)}</svg>`;
        fs.writeFileSync(path.join(dir, `${name}.svg`), files[name]);
    }
    return files;
}

describe("twemoji pack", () => {
    it("returns every file across chunks, byte for byte", () => {
        // More than one chunk (128 files each), with a partial last one.
        const files = svgDir(300);
        const file = path.join(tmp, "svg.pack");
        fs.writeFileSync(file, packTwemoji(path.join(tmp, "svg")));
        const pack = openTwemojiPack(file);
        for (const [name, body] of Object.entries(files))
            expect(pack.get(name).toString("utf8")).toBe(body);
        // And again in reverse, past the chunk cache.
        for (const [name, body] of Object.entries(files).reverse())
            expect(pack.get(name).toString("utf8")).toBe(body);
    });

    it("answers null for names it does not hold", () => {
        svgDir(3);
        const file = path.join(tmp, "svg.pack");
        fs.writeFileSync(file, packTwemoji(path.join(tmp, "svg")));
        const pack = openTwemojiPack(file);
        expect(pack.get("ffff")).toBeNull();
        expect(pack.get("__proto__")).toBeNull();
        expect(pack.get("constructor")).toBeNull();
    });

    it("is null without a pack, so the server falls back to loose files", () => {
        expect(openTwemojiPack(path.join(tmp, "missing.pack"))).toBeNull();
        fs.writeFileSync(path.join(tmp, "junk.pack"), "not a pack");
        expect(openTwemojiPack(path.join(tmp, "junk.pack"))).toBeNull();
    });

    it("marks only the loose SVGs as packed", () => {
        expect(isPackedPath("twemoji/svg/1f600.svg")).toBe(true);
        expect(isPackedPath(PACK_PATH)).toBe(false);
        expect(isPackedPath("twemoji/README.md")).toBe(false);
        expect(isPackedPath("_app/immutable/a.svg")).toBe(false);
    });
});

describe("unpacking a bundle with a twemoji pack", () => {
    it("leaves out the loose SVGs the pack covers", async () => {
        const site = path.join(tmp, "site");
        fs.mkdirSync(path.join(site, "twemoji", "svg"), { recursive: true });
        fs.writeFileSync(path.join(site, "index.html"), "<html></html>");
        fs.writeFileSync(
            path.join(site, "twemoji", "svg", "1f600.svg"),
            "<svg/>",
        );
        fs.writeFileSync(path.join(site, PACK_PATH), "pack");
        const out = path.join(tmp, "out");
        await unpackBundle(await packBundle(site), out, {
            skip: (p: string, all: Set<string>) =>
                all.has(PACK_PATH) && isPackedPath(p),
        });
        expect(fs.existsSync(path.join(out, "index.html"))).toBe(true);
        expect(fs.existsSync(path.join(out, PACK_PATH))).toBe(true);
        expect(
            fs.existsSync(path.join(out, "twemoji", "svg", "1f600.svg")),
        ).toBe(false);
    });
});
