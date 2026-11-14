// Draws the emoji picker's Twemoji into one PNG sprite sheet per category
// (static/twemoji/sheets/) plus a manifest (src/lib/data/emojiSheets.json).
//
// Why: every Twemoji SVG shown through an <img> makes the browser build a
// separate SVG document on the main thread. The picker grid shows thousands of
// them, and scrolling it janked on every new row (measured: ~1 frame in 3 over
// 33 ms with SVGs, none with the same grid drawn from text). Sheets are a
// handful of PNGs that decode off the main thread.
//
// Run it again whenever the vendored Twemoji or `unicode-emoji-json` changes;
// emojiSprites.test.ts fails until you do. The output is committed, so builds
// need nothing extra.
//
// Uses an installed Chrome as the rasterizer (no extra dependency): it opens
// the running dev server, imports the app's own emoji list and Twemoji file
// mapping, and draws each SVG onto a canvas.
//
//   npm run dev                      (in another terminal)
//   node scripts/build-emoji-sheets.mjs <dev server url> [chrome path]
//
// e.g. node scripts/build-emoji-sheets.mjs http://localhost:5173
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
    mkdtempSync,
    mkdirSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const CELL = 64; // px per emoji in the sheet: crisp at 2x for a ~32px cell
const PAD = 2; // transparent margin so neighbours never bleed when scaled
const COLS = 16;

const root = fileURLToPath(new URL("../", import.meta.url));
const SHEET_DIR = join(root, "static", "twemoji", "sheets");
const MANIFEST = join(root, "src", "lib", "data", "emojiSheets.json");

const devUrl = process.argv[2];
const chromePath =
    process.argv[3] ??
    {
        win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
        darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    }[process.platform] ??
    "google-chrome";
if (!devUrl) {
    console.error(
        "usage: node scripts/build-emoji-sheets.mjs <dev server url> [chrome path]",
    );
    process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9341;
const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "emoji-sheets-"))}`,
    "--no-first-run",
    "about:blank",
]);

try {
    let target;
    for (let i = 0; i < 100 && !target; i++) {
        await sleep(200);
        try {
            const list = await (
                await fetch(`http://127.0.0.1:${PORT}/json`)
            ).json();
            target = list.find((t) => t.type === "page");
        } catch {
            /* not up yet */
        }
    }
    if (!target) throw new Error("Chrome did not start");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.id && pending.has(d.id)) pending.get(d.id)(d);
    };
    const send = (method, params = {}) =>
        new Promise((r) => {
            pending.set(++id, r);
            ws.send(JSON.stringify({ id, method, params }));
        });
    const evaluate = async (expr) => {
        const r = await send("Runtime.evaluate", {
            expression: `(async () => { ${expr} })()`,
            awaitPromise: true,
            returnByValue: true,
        });
        if (r.result?.exceptionDetails)
            throw new Error(
                r.result.exceptionDetails.exception?.description ??
                    "page error",
            );
        return r.result.result.value;
    };

    // Any same-origin page will do: only its module loader is used.
    await send("Page.navigate", { url: new URL("/", devUrl).href });
    await sleep(3000);

    const sheets = await evaluate(`
        const { EMOJI_CATEGORIES } = await import("/src/lib/data/emojis.ts");
        const { renderEmoji } = await import("/src/lib/utils/twemoji.ts");
        const CELL = ${CELL}, PAD = ${PAD}, COLS = ${COLS};
        const load = (src) => new Promise((res) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = src;
        });
        const out = [];
        for (const cat of EMOJI_CATEGORIES) {
            // The exact file the app would show for each emoji; null when it
            // renders as text (the (c) (R) TM symbols) or has no SVG.
            const imgs = await Promise.all(cat.emojis.map((e) => {
                const m = renderEmoji(e.emoji, "x").match(/src="([^"]+)"/);
                return m ? load(m[1]) : null;
            }));
            const rows = Math.ceil(cat.emojis.length / COLS);
            const canvas = document.createElement("canvas");
            canvas.width = COLS * CELL;
            canvas.height = rows * CELL;
            const ctx = canvas.getContext("2d");
            const emojis = [];
            imgs.forEach((img, i) => {
                if (!img) { emojis.push(""); return; }
                const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
                ctx.drawImage(img, x + PAD, y + PAD, CELL - 2 * PAD, CELL - 2 * PAD);
                emojis.push(cat.emojis[i].emoji);
            });
            const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let bin = "";
            for (let i = 0; i < bytes.length; i += 0x8000)
                bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            out.push({ id: cat.id, rows, emojis, png: btoa(bin) });
        }
        return out;
    `);
    ws.close();

    mkdirSync(SHEET_DIR, { recursive: true });
    for (const f of readdirSync(SHEET_DIR))
        if (f.endsWith(".png")) rmSync(join(SHEET_DIR, f));

    const manifest = { cell: CELL, pad: PAD, cols: COLS, sheets: [] };
    let total = 0;
    for (const s of sheets) {
        const png = Buffer.from(s.png, "base64");
        // Content-hashed name: /twemoji/ is served immutable, so a changed
        // sheet must never reuse an old URL.
        const hash = createHash("sha256")
            .update(png)
            .digest("hex")
            .slice(0, 10);
        const file = `${s.id}.${hash}.png`;
        writeFileSync(join(SHEET_DIR, file), png);
        total += png.length;
        manifest.sheets.push({ file, rows: s.rows, emojis: s.emojis });
        const drawn = s.emojis.filter(Boolean).length;
        console.log(
            `${file}  ${drawn}/${s.emojis.length} emoji  ${(png.length / 1024).toFixed(0)} KB`,
        );
    }
    writeFileSync(MANIFEST, JSON.stringify(manifest) + "\n");
    console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
} finally {
    chrome.kill();
}
