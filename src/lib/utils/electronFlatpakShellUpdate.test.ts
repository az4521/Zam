import { describe, it, expect, vi } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const {
    createFlatpakShellUpdate,
    AFTER_UPDATE_FLAG,
    NEW_VERSION_START_MS,
} = require(join(__dirname, "../../../electron/flatpakShellUpdate.cjs"));

type Result = "done" | "empty";

function setup(
    opts: {
        update?: (onProgress: (f: number) => void) => Promise<Result>;
        repoVersion?: string | null;
        failed?: string[];
        hostLaunch?: (args: string[]) => Promise<void>;
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
        ...(opts.hostLaunch ? { hostLaunch: opts.hostLaunch } : {}),
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
        const { shell, monitor, settle } = setup();
        await expect(shell.restart()).rejects.toThrow();
        await shell.install();
        const restarting = shell.restart();
        await settle();
        expect(monitor.spawnLatest).toHaveBeenCalledWith([
            "zam",
            AFTER_UPDATE_FLAG,
        ]);
        shell.newVersionStarted();
        await expect(restarting).resolves.toBe(true);
        expect(shell.restartFailed()).toBe(false);
    });

    it("stays when the new version never starts", async () => {
        vi.useFakeTimers();
        try {
            const { shell, monitor } = setup();
            await shell.install();
            const restarting = shell.restart();
            // A second click while waiting does not spawn again.
            const again = shell.restart();
            await vi.advanceTimersByTimeAsync(NEW_VERSION_START_MS);
            await expect(restarting).resolves.toBe(false);
            await expect(again).resolves.toBe(false);
            expect(monitor.spawnLatest).toHaveBeenCalledTimes(1);
            expect(shell.restartFailed()).toBe(true);
            // A late start changes nothing.
            shell.newVersionStarted();
        } finally {
            vi.useRealTimers();
        }
    });

    it("a failed spawn throws and can be retried", async () => {
        const { shell, monitor } = setup();
        await shell.install();
        monitor.spawnLatest.mockRejectedValueOnce(new Error("no portal"));
        await expect(shell.restart()).rejects.toThrow("no portal");
        const restarting = shell.restart();
        await new Promise((r) => setTimeout(r, 0));
        shell.newVersionStarted();
        await expect(restarting).resolves.toBe(true);
    });

    describe("with a host launcher", () => {
        it("starts on the host first and leaves the portal alone", async () => {
            const hostLaunch = vi.fn(async () => {});
            const { shell, monitor, settle } = setup({ hostLaunch });
            await shell.install();
            const restarting = shell.restart();
            await settle();
            expect(hostLaunch).toHaveBeenCalledWith([AFTER_UPDATE_FLAG]);
            shell.newVersionStarted();
            await expect(restarting).resolves.toBe(true);
            expect(monitor.spawnLatest).not.toHaveBeenCalled();
        });

        it("falls back to the portal when the host cannot be asked", async () => {
            const hostLaunch = vi.fn(async () => {
                throw new Error("no host access");
            });
            const { shell, monitor, settle } = setup({ hostLaunch });
            await shell.install();
            const restarting = shell.restart();
            await settle();
            expect(monitor.spawnLatest).toHaveBeenCalledTimes(1);
            shell.newVersionStarted();
            await expect(restarting).resolves.toBe(true);
        });

        it("tries the portal when the host's start never shows up, then gives up", async () => {
            vi.useFakeTimers();
            try {
                const hostLaunch = vi.fn(async () => {});
                const { shell, monitor } = setup({ hostLaunch });
                await shell.install();
                const restarting = shell.restart();
                await vi.advanceTimersByTimeAsync(NEW_VERSION_START_MS);
                expect(monitor.spawnLatest).toHaveBeenCalledTimes(1);
                await vi.advanceTimersByTimeAsync(NEW_VERSION_START_MS);
                await expect(restarting).resolves.toBe(false);
                expect(shell.restartFailed()).toBe(true);
            } finally {
                vi.useRealTimers();
            }
        });

        it("throws when neither way could be asked", async () => {
            const { shell, monitor } = setup({
                hostLaunch: async () => {
                    throw new Error("no host access");
                },
            });
            monitor.spawnLatest.mockRejectedValueOnce(new Error("no portal"));
            await shell.install();
            await expect(shell.restart()).rejects.toThrow("no portal");
            expect(shell.restartFailed()).toBe(false);
        });
    });
});
