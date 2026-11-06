import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const {
    createFakeDiscord,
    fakeName,
} = require("../../../electron/fakeDiscord.cjs");

function rig(over: Record<string, unknown> = {}) {
    const dir = mkdtempSync(join(tmpdir(), "fake-discord-"));
    const spawned: string[][] = [];
    const fake = createFakeDiscord({
        userDataDir: dir,
        platform: "win32",
        env: { SystemRoot: process.env.SystemRoot ?? "C:\Windows" },
        spawnProcess: (cmd: string, args: string[]) => {
            spawned.push([cmd, ...args]);
            return Object.assign(new EventEmitter(), { pid: 4242 });
        },
        realRunning: async () => false,
        isOurs: async () => true,
        ...over,
    });
    return {
        dir,
        spawned,
        fake,
        done: () => rmSync(dir, { recursive: true, force: true }),
    };
}

describe("fakeDiscord", () => {
    it("names the process per platform", () => {
        expect(fakeName("win32")).toBe("Discord.exe");
        expect(fakeName("linux")).toBe("discord");
        expect(fakeName("darwin")).toBe("Discord");
    });

    it.skipIf(process.platform !== "win32")(
        "starts one only when no real Discord runs, and not twice",
        async () => {
            const a = rig();
            await a.fake.start();
            await a.fake.start();
            expect(a.spawned).toHaveLength(1);
            expect(a.spawned[0][0]).toMatch(/Discord\.exe$/);
            expect(a.fake.status().running).toBe(true);
            await a.fake.stop();
            expect(a.fake.status().running).toBe(false);
            a.done();

            const b = rig({ realRunning: async () => true });
            await b.fake.start();
            expect(b.spawned).toHaveLength(0);
            b.done();
        },
    );

    // Sets up the Linux symlink to sleep, which Windows cannot do.
    it.skipIf(process.platform === "win32")(
        "in a Flatpak waits for host access, then runs it on the host",
        async () => {
            const a = rig({ platform: "linux", inFlatpak: true });
            await a.fake.start();
            expect(a.spawned).toHaveLength(0);
            expect(a.fake.status().needsPermission).toBe(true);

            a.fake.setHostAccess(true);
            expect(a.fake.status().needsPermission).toBe(false);
            await a.fake.start();
            expect(a.spawned).toHaveLength(1);
            expect(a.spawned[0].slice(0, 3)).toEqual([
                "flatpak-spawn",
                "--host",
                "--watch-bus",
            ]);
            expect(a.spawned[0][3]).toMatch(/fake-discord.discord$/);
            a.done();
        },
    );
});
