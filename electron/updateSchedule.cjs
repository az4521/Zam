// When the desktop app checks for updates in the background. Pure (timers and
// clock are passed in, no Electron imports) so it can be unit tested; main.cjs
// wires it to electron-updater and powerMonitor.
//
// A desktop app is often left running for days, so one check at launch meant
// a release went unnoticed until the next restart. Instead:
//   - first check shortly after launch, so it never races startup;
//   - then every CHECK_INTERVAL_MS while the app runs;
//   - and after the computer wakes from sleep, when the last check is old
//     enough (timers don't advance while asleep, so the interval alone could
//     wait most of a day longer than it says). The short delay gives the
//     network a moment to come back first.

const FIRST_CHECK_DELAY_MS = 10 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const RESUME_MIN_GAP_MS = 60 * 60 * 1000;
const RESUME_CHECK_DELAY_MS = 30 * 1000;

/**
 * @param {{
 *   check: () => void,
 *   now?: () => number,
 *   setTimer?: (fn: () => void, ms: number) => unknown,
 *   clearTimer?: (handle: unknown) => void,
 * }} opts
 */
function createUpdateSchedule({
    check,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
}) {
    let timer = null;
    let lastCheckAt = null;

    function schedule(ms) {
        if (timer !== null) clearTimer(timer);
        timer = setTimer(run, ms);
    }

    function run() {
        timer = null;
        lastCheckAt = now();
        // Reschedule first, so a check that throws can't stop later ones.
        schedule(CHECK_INTERVAL_MS);
        check();
    }

    return {
        start() {
            schedule(FIRST_CHECK_DELAY_MS);
        },
        /** The computer woke from sleep. */
        onResume() {
            if (lastCheckAt === null) return; // the launch check is still due
            if (now() - lastCheckAt < RESUME_MIN_GAP_MS) return;
            schedule(RESUME_CHECK_DELAY_MS);
        },
        stop() {
            if (timer !== null) clearTimer(timer);
            timer = null;
        },
    };
}

module.exports = {
    createUpdateSchedule,
    FIRST_CHECK_DELAY_MS,
    CHECK_INTERVAL_MS,
    RESUME_MIN_GAP_MS,
    RESUME_CHECK_DELAY_MS,
};
