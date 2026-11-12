import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { detectInstallSource } = require("../../../electron/installSource.cjs");

const base = { env: {}, platform: "win32", resourcesDir: "r", exeDir: "e" };
const noFile = () => {
    throw new Error("ENOENT");
};
const markerAt = (dir: string, text: string) => (file: string) => {
    if (file.startsWith(dir)) return text;
    throw new Error("ENOENT");
};

describe("detectInstallSource", () => {
    it("treats a plain install as the installer", () => {
        expect(detectInstallSource({ ...base, readFile: noFile })).toEqual({
            id: "installer",
            managed: false,
        });
    });

    it("detects format-based sources from the environment", () => {
        const at = (env: object, platform = "linux") =>
            detectInstallSource({ ...base, platform, env, readFile: noFile })
                .id;
        expect(at({ FLATPAK_ID: "x" })).toBe("flatpak");
        expect(at({ PORTABLE_EXECUTABLE_FILE: "x" }, "win32")).toBe("portable");
        expect(at({ APPIMAGE: "x" })).toBe("appimage");
        expect(at({}, "darwin")).toBe("dmg");
    });

    it("reads a package manager from the marker file", () => {
        expect(
            detectInstallSource({
                ...base,
                readFile: markerAt("r", " WinGet\n"),
            }),
        ).toEqual({ id: "winget", managed: true, manager: "winget" });
        expect(
            detectInstallSource({ ...base, readFile: markerAt("e", "scoop") })
                .manager,
        ).toBe("Scoop");
    });

    it("reads a package manager from the environment", () => {
        const s = detectInstallSource({
            ...base,
            env: { ZAM_INSTALL_SOURCE: "aur" },
            readFile: noFile,
        });
        expect(s).toMatchObject({ id: "aur", managed: true });
    });

    it("ignores a marker naming an unknown source", () => {
        expect(
            detectInstallSource({
                ...base,
                readFile: markerAt("r", "<script>"),
            }).managed,
        ).toBe(false);
    });

    it("lets a package manager mark a portable or AppImage copy", () => {
        const s = detectInstallSource({
            ...base,
            env: { APPIMAGE: "x" },
            readFile: markerAt("r", "nix"),
        });
        expect(s.id).toBe("nix");
    });
});
