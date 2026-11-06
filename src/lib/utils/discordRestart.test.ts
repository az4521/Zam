import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
    restartDiscord,
    runningInstalls,
    flatpakAdapter,
    parseUnixProcesses,
} = require("../../../electron/discordRestart.cjs");

describe("restartDiscord", () => {
    const base = () => {
        const calls: string[] = [];
        return {
            calls,
            opts: {
                adapter: {
                    find: async () => [{ name: "Discord" }],
                    stop: async (d: { name: string }) =>
                        void calls.push(`stop ${d.name}`),
                    alive: async () => false,
                    start: (d: { name: string }) =>
                        void calls.push(`start ${d.name}`),
                },
                rebind: async () => void calls.push("rebind"),
            },
        };
    };

    it("closes Discord, rebinds, then starts it again, in that order", async () => {
        const { calls, opts } = base();
        expect(await restartDiscord(opts)).toEqual({ ok: true });
        expect(calls).toEqual(["stop Discord", "rebind", "start Discord"]);
    });

    it("starts Discord again even if rebinding fails", async () => {
        const { calls, opts } = base();
        opts.rebind = async () => {
            throw new Error("nope");
        };
        expect(await restartDiscord(opts)).toEqual({
            ok: false,
            error: "nope",
        });
        expect(calls).toEqual(["stop Discord", "start Discord"]);
    });

    it("does nothing with no Discord running or on an unknown system", async () => {
        const { calls, opts } = base();
        opts.adapter.find = async () => [];
        expect((await restartDiscord(opts)).ok).toBe(false);
        expect(
            (await restartDiscord({ rebind: opts.rebind, platform: "freebsd" }))
                .ok,
        ).toBe(false);
        expect(calls).toEqual([]);
    });
});

describe("Windows installs", () => {
    it("only offers variants that run and have an Update.exe", async () => {
        const list = await runningInstalls({
            env: { LOCALAPPDATA: "C:/L" },
            exists: (p: string) => p.includes("DiscordPTB"),
            tasklist: async () =>
                ['"Discord.exe","1"', '"DiscordPTB.exe","2"'].join("\n"),
        });
        expect(list.map((i: { name: string }) => i.name)).toEqual([
            "DiscordPTB",
        ]);
    });
});

describe("parseUnixProcesses", () => {
    it("finds the main Linux process, not helpers, Flatpak or Snap", () => {
        const ps = [
            "  10 /usr/share/discord/Discord",
            "  11 /usr/share/discord/Discord --type=zygote",
            "  12 /usr/share/discord/Discord --type=renderer --x",
            "  20 /app/discord/Discord",
            "  30 /snap/discord/1/usr/share/discord/Discord",
            "  40 /opt/discord-ptb/DiscordPTB --flag",
            "  50 vim Discord",
        ].join("\n");
        expect(parseUnixProcesses(ps, "linux")).toEqual([
            { name: "Discord", pid: 10, exe: "/usr/share/discord/Discord" },
            { name: "DiscordPTB", pid: 40, exe: "/opt/discord-ptb/DiscordPTB" },
        ]);
    });

    it("finds the main macOS process by its app name", () => {
        const ps = [
            "  1 /Applications/Discord.app/Contents/MacOS/Discord",
            "  2 /Applications/Discord.app/Contents/Frameworks/Discord Helper.app/Contents/MacOS/Discord Helper --type=gpu-process",
            "  3 /Applications/Discord PTB.app/Contents/MacOS/Discord PTB",
        ].join("\n");
        expect(parseUnixProcesses(ps, "darwin")).toEqual([
            { name: "Discord", pid: 1, app: "Discord" },
            { name: "Discord PTB", pid: 3, app: "Discord PTB" },
        ]);
    });
});

describe("Flatpak Discord", () => {
    it("is restarted through the host, not by name on this side", async () => {
        const { calls, opts } = (() => {
            const calls: string[] = [];
            return {
                calls,
                opts: {
                    inFlatpak: true,
                    adapter: {
                        find: async () => [{ name: "com.discordapp.Discord" }],
                        stop: async () => void calls.push("kill"),
                        alive: async () => false,
                        start: () => void calls.push("run"),
                    },
                    rebind: async () => void calls.push("rebind"),
                },
            };
        })();
        expect(await restartDiscord(opts)).toEqual({ ok: true });
        expect(calls).toEqual(["kill", "rebind", "run"]);
        // With no adapter given it goes through flatpak-spawn, which does not
        // exist here, so nothing is found (and nothing is killed).
        expect(await flatpakAdapter.find()).toEqual([]);
        expect(
            (await restartDiscord({ inFlatpak: true, rebind: opts.rebind })).ok,
        ).toBe(false);
    });
});
