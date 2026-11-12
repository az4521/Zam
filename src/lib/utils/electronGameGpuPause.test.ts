import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
    createGameGpuPause,
    isGamePresence,
    PAUSE_WINDOW_MS,
    NO_GAME_RESUME_MS,
    GAME_GONE_GRACE_MS,
} = require("../../../electron/gameGpuPause.cjs") as {
    createGameGpuPause: (deps: Record<string, unknown>) => {
        onPresence: (e: unknown) => void;
        onGpuExit: () => void;
        onCallChange: () => void;
        start: () => void;
        stop: () => void;
    };
    isGamePresence: (e: unknown) => boolean;
    PAUSE_WINDOW_MS: number;
    NO_GAME_RESUME_MS: number;
    GAME_GONE_GRACE_MS: number;
};

const game = (id = "g1", on = true) => ({
    source: "arrpc",
    presenceId: id,
    app: { id, name: id },
    presence: on ? { type: 0 } : null,
});

describe("isGamePresence", () => {
    it("counts playing, not listening or other sources", () => {
        expect(isGamePresence(game())).toBe(true);
        expect(
            isGamePresence({
                source: "arrpc",
                presenceId: "media-spotify",
                presence: { type: 2 },
            }),
        ).toBe(false);
        expect(
            isGamePresence({
                source: "arrpc",
                presenceId: "x",
                presence: { type: 2 },
            }),
        ).toBe(false);
        expect(isGamePresence({ ...game(), source: "msc4544" })).toBe(false);
    });
});

describe("createGameGpuPause", () => {
    let t: number;
    let enabled: boolean;
    let paused: boolean;
    let call: boolean;
    let writes: object[];
    let relaunches: number;
    let timers: { at: number; fn: () => void; dead: boolean }[];

    const make = () =>
        createGameGpuPause({
            enabled: () => enabled,
            pausedAtLaunch: () => paused,
            hardwareAccelerationOn: () => !paused,
            callActive: () => call,
            writePrefs: (p: object) => writes.push(p),
            relaunch: () => relaunches++,
            now: () => t,
            setTimer: (fn: () => void, ms: number) => {
                const h = { at: t + ms, fn, dead: false };
                timers.push(h);
                return h;
            },
            clearTimer: (h: { dead: boolean } | null) => {
                if (h) h.dead = true;
            },
        });
    const advance = (ms: number) => {
        t += ms;
        for (const h of [...timers]) {
            if (!h.dead && h.at <= t) {
                h.dead = true;
                h.fn();
            }
        }
    };

    beforeEach(() => {
        t = 1_000_000;
        enabled = true;
        paused = false;
        call = false;
        writes = [];
        relaunches = 0;
        timers = [];
    });

    it("pauses after repeated GPU exits while a game runs", () => {
        const p = make();
        p.onPresence(game());
        p.onGpuExit();
        expect(relaunches).toBe(0);
        advance(1000);
        p.onGpuExit();
        expect(relaunches).toBe(1);
        expect(writes).toEqual([{ gamePausedAt: t }]);
    });

    it("ignores exits with no game, spread out, or the option off", () => {
        let p = make();
        p.onGpuExit();
        p.onGpuExit();
        p.onGpuExit();
        expect(relaunches).toBe(0);

        p = make();
        p.onPresence(game());
        p.onGpuExit();
        advance(PAUSE_WINDOW_MS + 1);
        p.onGpuExit();
        expect(relaunches).toBe(0);

        enabled = false;
        p = make();
        p.onPresence(game());
        p.onGpuExit();
        p.onGpuExit();
        expect(relaunches).toBe(0);
    });

    it("waits for a call to end before restarting", () => {
        const p = make();
        p.onPresence(game());
        call = true;
        p.onGpuExit();
        p.onGpuExit();
        expect(relaunches).toBe(0);
        call = false;
        p.onCallChange();
        expect(relaunches).toBe(1);
    });

    it("drops a pause held by a call when the game ends", () => {
        const p = make();
        p.onPresence(game());
        call = true;
        p.onGpuExit();
        p.onGpuExit();
        p.onPresence(game("g1", false));
        call = false;
        p.onCallChange();
        expect(relaunches).toBe(0);
    });

    it("resumes after the game has been gone for a while", () => {
        paused = true;
        const p = make();
        p.start();
        p.onPresence(game());
        p.onPresence(game("g1", false));
        advance(GAME_GONE_GRACE_MS - 1);
        expect(relaunches).toBe(0);
        advance(2);
        expect(relaunches).toBe(1);
        expect(writes).toEqual([{ gamePausedAt: undefined }]);
    });

    it("keeps the pause when the game comes straight back", () => {
        paused = true;
        const p = make();
        p.start();
        p.onPresence(game("a"));
        p.onPresence(game("a", false));
        advance(GAME_GONE_GRACE_MS - 1);
        p.onPresence(game("b"));
        advance(GAME_GONE_GRACE_MS * 3);
        expect(relaunches).toBe(0);
    });

    it("ends a pause that never sees a game", () => {
        paused = true;
        const p = make();
        p.start();
        advance(NO_GAME_RESUME_MS - 1);
        expect(relaunches).toBe(0);
        advance(2);
        expect(relaunches).toBe(1);
    });

    it("ends a pause at once when the option is off", () => {
        paused = true;
        enabled = false;
        make().start();
        expect(relaunches).toBe(1);
    });

    it("does not pause again while paused", () => {
        paused = true;
        const p = make();
        p.start();
        p.onPresence(game());
        p.onGpuExit();
        p.onGpuExit();
        expect(relaunches).toBe(0);
    });
});
