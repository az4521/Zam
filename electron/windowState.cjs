// Window size / position / maximised state, remembered across launches.
// Pure helpers (no Electron imports) so they can be unit tested; main.cjs
// does the reading, writing and BrowserWindow wiring.

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

function isFiniteNumber(v) {
    return typeof v === "number" && Number.isFinite(v);
}

/**
 * Parse the saved state file's text. Anything malformed falls back to the
 * defaults rather than throwing: a corrupt file must never stop the app from
 * opening a window.
 */
function parseWindowState(text) {
    const fallback = {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        maximized: false,
    };
    let raw;
    try {
        raw = JSON.parse(text);
    } catch {
        return fallback;
    }
    if (!raw || typeof raw !== "object") return fallback;
    const out = { ...fallback };
    if (isFiniteNumber(raw.width) && raw.width > 0) out.width = raw.width;
    if (isFiniteNumber(raw.height) && raw.height > 0) out.height = raw.height;
    if (isFiniteNumber(raw.x) && isFiniteNumber(raw.y)) {
        out.x = raw.x;
        out.y = raw.y;
    }
    out.maximized = raw.maximized === true;
    return out;
}

/**
 * Drop a saved position that is no longer on any display (a monitor was
 * unplugged, resolution changed), so the window isn't restored off-screen.
 * The window counts as visible when at least a 100x50 corner of its title
 * area overlaps some display's work area. Width and height are clamped to
 * the largest work area so it never opens bigger than the screen.
 *
 * `workAreas` is a list of {x, y, width, height} rectangles.
 */
function fitToDisplays(state, workAreas) {
    const out = { ...state };
    if (workAreas.length) {
        const maxW = Math.max(...workAreas.map((a) => a.width));
        const maxH = Math.max(...workAreas.map((a) => a.height));
        out.width = Math.min(out.width, maxW);
        out.height = Math.min(out.height, maxH);
    }
    if (isFiniteNumber(out.x) && isFiniteNumber(out.y)) {
        const visible = workAreas.some(
            (a) =>
                out.x + 100 > a.x &&
                out.x < a.x + a.width - 100 &&
                out.y + 50 > a.y &&
                out.y < a.y + a.height - 50,
        );
        if (!visible) {
            delete out.x;
            delete out.y;
        }
    }
    return out;
}

module.exports = {
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    parseWindowState,
    fitToDisplays,
};
