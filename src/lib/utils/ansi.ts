/**
 * ANSI colour code blocks (```ansi), as Discord renders them: SGR escape
 * sequences (`ESC[...m`) inside the block set colours and styles. Turned into
 * escaped text in styled spans; the styles are built from parsed numbers
 * only, so nothing from the message reaches an attribute verbatim.
 *
 * Faint (2) is ignored, as Discord does: its colour picker writes `2;31m`
 * for plain red.
 *
 * The ESC byte itself is optional: copy-paste and some bridges drop it,
 * leaving `[31m`. Only applied inside an `ansi` block, where that reading is
 * what the author meant.
 */

// Discord's palette for the basic 8 colours (Solarized-based), so blocks
// written for Discord look the same here.
const FG_BASIC = [
    "#4f545c",
    "#dc322f",
    "#859900",
    "#b58900",
    "#268bd2",
    "#d33682",
    "#2aa198",
    "#ffffff",
];
const BG_BASIC = [
    "#002b36",
    "#cb4b16",
    "#586e75",
    "#657b83",
    "#839496",
    "#6c71c4",
    "#93a1a1",
    "#fdf6e3",
];
// Bright variants (90-97 / 100-107), xterm's.
const BRIGHT = [
    "#7f7f7f",
    "#ff5555",
    "#55ff55",
    "#ffff55",
    "#5c5cff",
    "#ff55ff",
    "#55ffff",
    "#ffffff",
];

/** xterm 256-colour palette entry. */
function color256(n: number): string | null {
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    if (n < 8) return FG_BASIC[n];
    if (n < 16) return BRIGHT[n - 8];
    if (n < 232) {
        const i = n - 16;
        const level = (v: number) => (v === 0 ? 0 : 55 + v * 40);
        return rgb(
            level(Math.floor(i / 36)),
            level(Math.floor(i / 6) % 6),
            level(i % 6),
        );
    }
    const g = 8 + (n - 232) * 10;
    return rgb(g, g, g);
}

function rgb(r: number, g: number, b: number): string | null {
    const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= 255;
    return ok(r) && ok(g) && ok(b) ? `rgb(${r}, ${g}, ${b})` : null;
}

interface Style {
    fg: string | null;
    bg: string | null;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
}

const plain = (): Style => ({
    fg: null,
    bg: null,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
});

/** Read an extended colour (`5;n` or `2;r;g;b`) starting at codes[i]; returns
 *  the colour and how many codes it used. */
function extendedColor(
    codes: number[],
    i: number,
): { color: string | null; used: number } {
    if (codes[i] === 5) return { color: color256(codes[i + 1]), used: 2 };
    if (codes[i] === 2)
        return {
            color: rgb(codes[i + 1], codes[i + 2], codes[i + 3]),
            used: 4,
        };
    return { color: null, used: 0 };
}

function apply(style: Style, codes: number[]): Style {
    const s = { ...style };
    if (codes.length === 0) return plain();
    for (let i = 0; i < codes.length; i++) {
        const c = codes[i];
        if (c === 0) Object.assign(s, plain());
        else if (c === 1) s.bold = true;
        else if (c === 3) s.italic = true;
        else if (c === 4) s.underline = true;
        else if (c === 9) s.strike = true;
        else if (c === 22) s.bold = false;
        else if (c === 23) s.italic = false;
        else if (c === 24) s.underline = false;
        else if (c === 29) s.strike = false;
        else if (c >= 30 && c <= 37) s.fg = FG_BASIC[c - 30];
        else if (c >= 90 && c <= 97) s.fg = BRIGHT[c - 90];
        else if (c === 39) s.fg = null;
        else if (c >= 40 && c <= 47) s.bg = BG_BASIC[c - 40];
        else if (c >= 100 && c <= 107) s.bg = BRIGHT[c - 100];
        else if (c === 49) s.bg = null;
        else if (c === 38 || c === 48) {
            const { color, used } = extendedColor(codes, i + 1);
            if (color) {
                if (c === 38) s.fg = color;
                else s.bg = color;
            }
            i += used;
        }
    }
    return s;
}

function css(s: Style): string {
    const parts: string[] = [];
    if (s.fg) parts.push(`color: ${s.fg}`);
    if (s.bg) parts.push(`background-color: ${s.bg}`);
    if (s.bold) parts.push("font-weight: bold");
    if (s.italic) parts.push("font-style: italic");
    const lines = [s.underline && "underline", s.strike && "line-through"]
        .filter(Boolean)
        .join(" ");
    if (lines) parts.push(`text-decoration: ${lines}`);
    return parts.join("; ");
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// SGR only; other escape sequences (cursor moves etc.) are dropped.
const SEQUENCE = /\x1b?\[([0-9;]*)m|\x1b\[[0-9;?]*[A-Za-z]/g;

/** Render ANSI-coloured text as HTML. */
export function ansiToHtml(text: string): string {
    let out = "";
    let style = plain();
    let last = 0;
    const emit = (chunk: string) => {
        if (!chunk) return;
        const rule = css(style);
        out += rule
            ? `<span style="${rule}">${escapeHtml(chunk)}</span>`
            : escapeHtml(chunk);
    };
    for (const m of text.matchAll(SEQUENCE)) {
        emit(text.slice(last, m.index));
        last = m.index! + m[0].length;
        if (m[1] === undefined) continue;
        const codes = m[1] === "" ? [] : m[1].split(";").map(Number);
        style = apply(style, codes);
    }
    emit(text.slice(last));
    return out;
}
