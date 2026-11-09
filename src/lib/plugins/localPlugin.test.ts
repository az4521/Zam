import { describe, it, expect } from "vitest";
import {
    filesFromList,
    filesUnder,
    findPluginDirs,
    readLocalPlugin,
} from "./localPlugin";
import {
    emptyPersistedState,
    parsePersistedState,
    serializePersistedState,
} from "./pluginPersist";

const MANIFEST = {
    id: "dev.example.hello",
    name: "Hello",
    version: "0.1.0",
    description: "d",
    author: "me",
    entry: "dist/index.js",
};

function folder(files: Record<string, string>): Map<string, Blob> {
    return new Map(Object.entries(files).map(([k, v]) => [k, new Blob([v])]));
}

describe("readLocalPlugin", () => {
    it("reads manifest, bundle and assets", async () => {
        const out = await readLocalPlugin(
            folder({
                "manifest.json": JSON.stringify({
                    ...MANIFEST,
                    assets: [
                        { path: "model.bin", sha256: "0".repeat(64), size: 1 },
                    ],
                }),
                "dist/index.js": "export function onload() {}",
                "model.bin": "abc",
            }),
        );
        expect(out.manifest.id).toBe("dev.example.hello");
        expect(out.code).toContain("onload");
        // Not checksummed: the author is still editing it.
        expect(new Uint8Array(out.assets.get("model.bin")!).length).toBe(3);
    });

    it("needs a manifest.json in the folder", async () => {
        await expect(
            readLocalPlugin(folder({ "sub/manifest.json": "{}" })),
        ).rejects.toThrow(/manifest\.json/);
    });

    it("rejects bad JSON and invalid manifests", async () => {
        await expect(
            readLocalPlugin(folder({ "manifest.json": "{nope" })),
        ).rejects.toThrow(/valid JSON/);
        await expect(
            readLocalPlugin(folder({ "manifest.json": "{}" })),
        ).rejects.toThrow(/id/);
    });

    it("rejects a missing or empty entry file and missing assets", async () => {
        const m = JSON.stringify(MANIFEST);
        await expect(
            readLocalPlugin(folder({ "manifest.json": m })),
        ).rejects.toThrow(/dist\/index\.js/);
        await expect(
            readLocalPlugin(
                folder({ "manifest.json": m, "dist/index.js": "  " }),
            ),
        ).rejects.toThrow(/empty/);
        await expect(
            readLocalPlugin(
                folder({
                    "manifest.json": JSON.stringify({
                        ...MANIFEST,
                        assets: [
                            { path: "a.bin", sha256: "0".repeat(64), size: 1 },
                        ],
                    }),
                    "dist/index.js": "x",
                }),
            ),
        ).rejects.toThrow(/a\.bin/);
    });
});

describe("findPluginDirs", () => {
    it("treats a folder with a top manifest.json as one plugin", () => {
        expect(
            findPluginDirs(
                folder({ "manifest.json": "{}", "sub/manifest.json": "{}" }),
            ),
        ).toEqual([""]);
    });

    it("finds every plugin folder in a repo, not those nested in one", () => {
        const files = folder({
            "index.json": "[]",
            "plugins/a/manifest.json": "{}",
            "plugins/a/dist/manifest.json": "{}",
            "plugins/b/manifest.json": "{}",
            "src/x.ts": "",
        });
        expect(findPluginDirs(files)).toEqual(["plugins/a/", "plugins/b/"]);
        expect([...filesUnder(files, "plugins/b/").keys()]).toEqual([
            "manifest.json",
        ]);
    });

    it("finds nothing when there is no manifest", () => {
        expect(findPluginDirs(folder({ "a.txt": "" }))).toEqual([]);
    });
});

describe("filesFromList", () => {
    function file(rel: string): File {
        const f = new File(["x"], rel.split("/").pop()!);
        Object.defineProperty(f, "webkitRelativePath", { value: rel });
        return f;
    }

    it("strips the picked folder's name and skips node_modules/.git", () => {
        const m = filesFromList([
            file("plug/manifest.json"),
            file("plug/dist/index.js"),
            file("plug/node_modules/x/index.js"),
            file("plug/.git/HEAD"),
        ]);
        expect([...m.keys()].sort()).toEqual([
            "dist/index.js",
            "manifest.json",
        ]);
    });
});

describe("persisted local plugins", () => {
    it("round-trips source: local", () => {
        const s = emptyPersistedState();
        s.plugins["dev.example.hello"] = {
            enabled: true,
            source: "local",
            manifest: MANIFEST,
        };
        const back = parsePersistedState(serializePersistedState(s));
        expect(back.plugins["dev.example.hello"].source).toBe("local");
        expect(back.plugins["dev.example.hello"].enabled).toBe(true);
    });
});
