// Switch hardware acceleration off while a game is running and the GPU keeps
// dying, and back on once the game is gone.
//
// A game holding nearly all of the video memory makes Chromium's GPU process
// fail its allocations and exit over and over (NVIDIA's drivers don't spill
// into system RAM, so there is nothing to wait out). Chromium only reads the
// hardware acceleration setting at startup, so both switches are a relaunch,
// which is why they wait for the end of a call: the window and the call's
// connections go with it.
//
// The pause is remembered in gpu-prefs.json (`gamePausedAt`), read before the
// app is ready; this module decides when to set and clear it and when to
// relaunch. Game state comes from the rich presence game sources, which only
// report once "game detection" is on in Settings.

// This many GPU exits this close together while a game runs start a pause. One
// exit is Chromium restarting the process on its own, which it does fine.
const PAUSE_AFTER_EXITS = 2;
const PAUSE_WINDOW_MS = 60_000;
// A paused run that sees no game for this long ends the pause: the game
// closed while Zam restarted, or detection is off. The scanner passes every
// 15 s (gameScanner.cjs), so a game that is running shows up well before this.
const NO_GAME_RESUME_MS = 2 * 60_000;
// A game that drops out of the scanner for a moment (a launcher handing over
// to the game's own process) doesn't end the pause.
const GAME_GONE_GRACE_MS = 20_000;

/**
 * A presence event from the rich presence sources, as the page gets it, is a
 * game when it is "Playing" (not the "Listening to" of a media player).
 */
function isGamePresence(event) {
    if (event?.source !== "arrpc") return false;
    const id = String(event.presenceId ?? "");
    if (id.startsWith("media-")) return false;
    const type = event.presence?.type;
    return type === undefined || type === 0 || type === 1;
}

/**
 * @param {object} deps
 * @param {() => boolean} deps.enabled the saved option
 * @param {() => boolean} deps.pausedAtLaunch this run started with the GPU off for a pause
 * @param {() => boolean} deps.hardwareAccelerationOn this run has the GPU on
 * @param {() => boolean} deps.callActive
 * @param {(patch: object) => void} deps.writePrefs
 * @param {() => void} deps.relaunch
 * @param {(msg: string) => void} [deps.log]
 * @param {() => number} [deps.now]
 * @param {(fn: () => void, ms: number) => any} [deps.setTimer]
 * @param {(t: any) => void} [deps.clearTimer]
 */
function createGameGpuPause(deps) {
    const {
        enabled,
        pausedAtLaunch,
        hardwareAccelerationOn,
        callActive,
        writePrefs,
        relaunch,
        log = () => {},
        now = Date.now,
        setTimer = setTimeout,
        clearTimer = clearTimeout,
    } = deps;

    const games = new Set(); // presence ids of the games running
    const exits = [];
    let wantPause = false;
    let wantResume = false;
    let goneTimer = null;
    let noGameTimer = null;
    let acted = false;

    const gameRunning = () => games.size > 0;

    function doRelaunch() {
        if (acted) return;
        acted = true;
        relaunch();
    }

    function pause() {
        log("game running and the GPU keeps exiting: restarting without it");
        writePrefs({ gamePausedAt: now() });
        doRelaunch();
    }

    function resume() {
        log("game is gone: restarting with hardware acceleration");
        writePrefs({ gamePausedAt: undefined });
        doRelaunch();
    }

    function flush() {
        if (callActive()) return;
        if (wantPause && gameRunning() && enabled()) pause();
        else if (wantResume && !gameRunning()) resume();
    }

    function armResume() {
        if (!pausedAtLaunch()) return;
        clearTimer(goneTimer);
        goneTimer = setTimer(() => {
            goneTimer = null;
            if (gameRunning()) return;
            wantResume = true;
            flush();
        }, GAME_GONE_GRACE_MS);
    }

    return {
        /** A presence event from the rich presence sources. */
        onPresence(event) {
            if (!isGamePresence(event)) return;
            const id = String(event.presenceId ?? event.app?.id ?? "");
            if (event.presence) {
                games.add(id);
                clearTimer(goneTimer);
                goneTimer = null;
                clearTimer(noGameTimer);
                noGameTimer = null;
                wantResume = false;
            } else {
                games.delete(id);
                if (!gameRunning()) {
                    // A pause held back by a call is for a game that is over.
                    wantPause = false;
                    armResume();
                }
            }
        },

        /** A GPU process exit that wasn't a clean close or a deliberate kill. */
        onGpuExit() {
            if (!enabled() || !hardwareAccelerationOn() || pausedAtLaunch())
                return;
            const t = now();
            exits.push(t);
            while (exits.length && exits[0] < t - PAUSE_WINDOW_MS)
                exits.shift();
            if (exits.length < PAUSE_AFTER_EXITS || !gameRunning()) return;
            wantPause = true;
            flush();
        },

        /** The page says a call started or ended. */
        onCallChange() {
            flush();
        },

        /** Once at startup of a paused run. */
        start() {
            if (!pausedAtLaunch()) return;
            // The option was turned off while paused: nothing keeps the pause.
            if (!enabled()) {
                wantResume = true;
                flush();
                return;
            }
            noGameTimer = setTimer(() => {
                noGameTimer = null;
                if (gameRunning()) return;
                wantResume = true;
                flush();
            }, NO_GAME_RESUME_MS);
        },

        stop() {
            clearTimer(goneTimer);
            clearTimer(noGameTimer);
        },
    };
}

module.exports = {
    createGameGpuPause,
    isGamePresence,
    PAUSE_AFTER_EXITS,
    PAUSE_WINDOW_MS,
    NO_GAME_RESUME_MS,
    GAME_GONE_GRACE_MS,
};
