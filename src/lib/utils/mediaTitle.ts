/**
 * Names a media player in Chromium's DevTools Media panel. The panel labels
 * each player with its frame title, which Chromium reads from the document's
 * title when the player is created, so every player in this single-page app
 * shows up with the same name. Call audio and video are easy to lose among
 * each other (one player per voice, per share, per tile), so the document
 * title is borrowed for the moment each one is created.
 *
 * The player is created a task after the source is set, and the element's
 * `loadstart` follows it. Jobs run one at a time so a second element can't
 * pick up the first one's title, and the real title is put back after each.
 */

/** Longest a job holds the title when the element never fires loadstart. */
const HOLD_MAX_MS = 150;

const RELEASE_EVENTS = ["loadstart", "emptied", "error"];

let tail: Promise<void> = Promise.resolve();

/** `title` is what DevTools shows for the player `fn` starts on `el`. `fn`
 *  must set the element's source (directly or through LiveKit's `attach`).
 *  Resolves once `fn` has run, which is not immediately if other players
 *  are still being named ahead of it. */
export function runWithMediaTitle(
    el: HTMLMediaElement,
    title: string,
    fn: () => void,
): Promise<void> {
    const prev = tail;
    let release!: () => void;
    tail = new Promise<void>((resolve) => (release = resolve));
    return prev.then(() => {
        const real = document.title;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = () => {
            clearTimeout(timer);
            for (const ev of RELEASE_EVENTS) el.removeEventListener(ev, finish);
            document.title = real;
            release();
        };
        timer = setTimeout(finish, HOLD_MAX_MS);
        for (const ev of RELEASE_EVENTS) el.addEventListener(ev, finish);
        document.title = title;
        try {
            fn();
        } catch (err) {
            finish();
            throw err;
        }
    });
}
