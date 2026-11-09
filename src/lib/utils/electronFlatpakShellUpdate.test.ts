import { describe, it, expect, vi } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { createFlatpakShellUpdate, AFTER_UPDATE_FLAG } = require(
    join(__dirname, "../../../electron/flatpakShellUpdate.cjs"),
);

type Result = "done" | "empty";

function setup(
    opts: {
        update?: (onProgress: (f: number) => void) => Promise<Result>;
        repoVersion?: string | null;
        failed?: string[];
    } = {},
) {
    const statuses: Record<string, unknown>[] = [];
    const monitor = {
        update: vi.fn(opts.update ?? (async () => "done" as Result)),
        spawnLatest: vi.fn(async () => {}),
    };
    const shell = createFlatpakShellUpdate({
        monitor,
        runningVersion: "1.55.2",
        sendStatus: (s: Record<string, unknown>) => statuses.push(s),
        isFailed: (v: string) => (opts.failed ?? []).includes(v),
        repoVersion: async () => opts.repoVersion ?? null,
    });
    const settle = () => new Promise((r) => setTimeout(r, 0));
    return { shell, monitor, statuses, settle };
}

describe("flatpakShellUpdate", () => {
    it("offers a manual check without installing", async () => {
        const { shell, monitor, statuses, settle } = setup();
        shell.offer("1.56.0", { manual: true, auto: true });
        await settle();
        expect(monitor.update).not.toHaveBeenCalled();
        expect(statuses).toEqual([
            {
                kind: "shell",
                version: "1.56.0",
                phase: "available",
                installFailed: false,
            },
        ]);
    });

    it("installs on a background check with automatic updates, with progress", async () => {
        const { shell, statuses, settle } = setup({
            update: async (onProgress) => {
                onProgress(0.5);
                onProgress(0.5);
                onProgress(1);
                return "done";
            },
        });
        shell.offer("1.56.0", { manual: false, auto: true });
        await settle();
        expect(statuses.map((s) => [s.phase, s.percent])).toEqual([
            ["available", undefined],
            ["downloading", 0],
            ["downloading", 50],
            ["downloading", 100],
            ["downloaded", undefined],
        ]);
        expect(shell.isInstalled()).toBe(true);
        expect(statuses.at(-1)?.version).toBe("1.56.0");
    });

    it("does not install on its own with automatic updates off, or a failed version", async () => {
        for (const [auto, failed] of [
            [false, []],
            [true, ["1.56.0"]],
        ] as const) {
            const { shell, monitor, statuses, settle } = setup({
                failed: [...failed],
            });
            shell.offer("1.56.0", { manual: false, auto });
            await settle();
            expect(monitor.update).not.toHaveBeenCalled();
            expect(statuses.at(-1)?.phase).toBe("available");
        }
    });

    it("says a published-too-early release is not in the repo yet", async () => {
        const { shell, statuses, settle } = setup({
            update: async () => "empty",
            repoVersion: "1.55.2",
        });
        await shell.install();
        await settle();
        expect(statuses.at(-1)?.phase).toBe("error");
        expect(shell.isInstalled()).toBe(false);
    });

    it("treats nothing-to-install as installed when the repo is already newer", async () => {
        const { shell, statuses } = setup({
            update: async () => "empty",
            repoVersion: "1.56.0",
        });
        shell.offer("1.56.0", { manual: true, auto: false });
        await shell.install();
        expect(statuses.at(-1)).toMatchObject({
            phase: "downloaded",
            version: "1.56.0",
        });
    });

    it("sends the system tools' way for new permissions or a refusal", async () => {
        for (const dbusName of [
            "org.freedesktop.DBus.Error.NotSupported",
            "org.freedesktop.DBus.Error.AccessDenied",
        ]) {
            const { shell, statuses } = setup({
                update: async () => {
                    throw Object.assign(new Error("no"), { dbusName });
                },
            });
            await shell.install();
            expect(statuses.at(-1)).toMatchObject({
                phase: "unsupported",
                manual: "flatpak",
            });
        }
    });

    it("reports other failures as errors", async () => {
        const { shell, statuses } = setup({
            update: async () => {
                throw Object.assign(new Error("network down"), {
                    dbusName: "org.freedesktop.DBus.Error.Failed",
                });
            },
        });
        await shell.install();
        expect(statuses.at(-1)).toMatchObject({
            phase: "error",
            message: "network down",
        });
    });

    it("an update already installed by the system only needs a restart", async () => {
        const { shell, monitor, statuses } = setup();
        shell.updateAvailable({
            runningCommit: "a",
            localCommit: "b",
            remoteCommit: "b",
        });
        shell.offer("1.56.0", { manual: false, auto: true });
        expect(monitor.update).not.toHaveBeenCalled();
        expect(statuses.at(-1)).toMatchObject({
            phase: "downloaded",
            version: "1.56.0",
        });
    });

    it("a newer remote alone is not installed yet", () => {
        const { shell } = setup();
        shell.updateAvailable({
            runningCommit: "a",
            localCommit: "a",
            remoteCommit: "b",
        });
        expect(shell.isInstalled()).toBe(false);
    });

    it("restarts into the latest version only once one is installed", async () => {
        const { shell, monitor } = setup();
        await expect(shell.restart()).rejects.toThrow();
        await shell.install();
        await shell.restart();
        expect(monitor.spawnLatest).toHaveBeenCalledWith([
            "zam",
            AFTER_UPDATE_FLAG,
        ]);
    });
});
