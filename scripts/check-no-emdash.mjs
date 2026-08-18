#!/usr/bin/env node
/**
 * Permanent guard: fail the build if an em dash (U+2014) appears in a UI string
 * anywhere under src/. Em dashes belong in our prose (comments, docs, memory),
 * NOT in the strings we render to users — this keeps them out for good.
 *
 * What it flags: em dashes inside string/template literals (in .ts/.js and in
 * <script> blocks) and inside Svelte markup text/attributes.
 * What it ignores: comments (JS // and block, HTML <!-- -->, CSS block),
 * regex/other bare code, test files, and — by construction — runtime
 * user-generated content (other users' messages never live in source).
 *
 * Wired into `npm run build` and runnable directly via `npm run check:emdash`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EM = "—"; // — em dash

const SKIP_SUFFIX = [".test.ts", ".test.js", ".spec.ts", ".spec.js", ".d.ts"];
const SCAN_SUFFIX = [".svelte", ".ts", ".js"];

function walk(dir, out) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            walk(full, out);
        } else if (
            SCAN_SUFFIX.some((s) => entry.endsWith(s)) &&
            !SKIP_SUFFIX.some((s) => entry.endsWith(s))
        ) {
            out.push(full);
        }
    }
    return out;
}

function matchOpenTag(s, i, name) {
    if (s[i] !== "<") return false;
    if (s.slice(i + 1, i + 1 + name.length).toLowerCase() !== name)
        return false;
    const after = s[i + 1 + name.length];
    return after === undefined || /[\s>/]/.test(after);
}

function matchCloseTag(s, i, name) {
    if (s[i] !== "<" || s[i + 1] !== "/") return false;
    if (s.slice(i + 2, i + 2 + name.length).toLowerCase() !== name)
        return false;
    const after = s[i + 2 + name.length];
    return after === undefined || /[\s>]/.test(after);
}

// Scan a JS/TS region. Flags em dashes only inside '', "", `` literals so that
// regexes, comments, and bare code can never trip a false positive. Regex
// literals are tracked (via the standard prev-significant-char heuristic) so a
// pattern like /['"]/ can't desync the string state and misflag later comments.
// When `isScript`, stops at the region's </script> and reports it so the Svelte
// driver can resume.
function scanJsRegion(content, start, startLine, isScript, record) {
    const n = content.length;
    let i = start;
    let line = startLine;
    let state = "CODE"; // CODE | LINE | BLOCK | SQ | DQ | TPL | REGEX
    let prevSig = ""; // last non-whitespace char seen in CODE
    let inClass = false; // inside a [...] char class of a regex
    // Brace depth per active ${ } template-expression, so nested templates and
    // ${expr} that contain strings/regex/braces parse without desyncing.
    const exprDepth = [];
    while (i < n) {
        const c = content[i];
        const c2 = content[i + 1];
        if (c === "\n") {
            line++;
            i++;
            if (state === "LINE") state = "CODE";
            continue;
        }
        if (state === "LINE") {
            i++;
            continue;
        }
        if (state === "BLOCK") {
            if (c === "*" && c2 === "/") {
                state = "CODE";
                i += 2;
            } else i++;
            continue;
        }
        if (state === "REGEX") {
            if (c === "\\") {
                i += 2;
            } else {
                if (c === "[") inClass = true;
                else if (c === "]") inClass = false;
                else if (c === "/" && !inClass) {
                    state = "CODE";
                    prevSig = "/";
                }
                i++;
            }
            continue;
        }
        if (state === "SQ" || state === "DQ") {
            if (c === "\\") {
                if (content[i + 1] === "\n") line++;
                i += 2;
                continue;
            }
            if (
                (state === "SQ" && c === "'") ||
                (state === "DQ" && c === '"')
            ) {
                state = "CODE";
                prevSig = c;
            } else if (c === EM) record(line);
            i++;
            continue;
        }
        if (state === "TPL") {
            if (c === "\\") {
                if (content[i + 1] === "\n") line++;
                i += 2;
                continue;
            }
            if (c === "`") {
                state = "CODE";
                prevSig = "`";
            } else if (c === "$" && c2 === "{") {
                exprDepth.push(0);
                state = "CODE";
                i += 2;
                continue;
            } else if (c === EM) record(line);
            i++;
            continue;
        }
        // state === "CODE"
        if (isScript && matchCloseTag(content, i, "script")) {
            return { i, line, closed: true };
        }
        if (c === "/" && c2 === "/") {
            state = "LINE";
            i += 2;
            continue;
        }
        if (c === "/" && c2 === "*") {
            state = "BLOCK";
            i += 2;
            continue;
        }
        if (c === "/" && !/[\w$)\]]/.test(prevSig)) {
            // A `/` not preceded by a value is a regex literal, not division.
            state = "REGEX";
            inClass = false;
            prevSig = "/";
            i++;
            continue;
        }
        if (c === "'") {
            state = "SQ";
            prevSig = "'";
        } else if (c === '"') {
            state = "DQ";
            prevSig = '"';
        } else if (c === "`") {
            state = "TPL";
            prevSig = "`";
        } else if (c === "{") {
            if (exprDepth.length) exprDepth[exprDepth.length - 1]++;
            prevSig = c;
        } else if (c === "}") {
            if (exprDepth.length && exprDepth[exprDepth.length - 1] === 0) {
                exprDepth.pop();
                state = "TPL";
            } else if (exprDepth.length) {
                exprDepth[exprDepth.length - 1]--;
                prevSig = c;
            } else prevSig = c;
        } else if (!/\s/.test(c)) {
            prevSig = c;
        }
        i++;
    }
    return { i, line, closed: false };
}

function scanStyleRegion(content, start, startLine, record) {
    const n = content.length;
    let i = start;
    let line = startLine;
    while (i < n) {
        const c = content[i];
        if (c === "\n") {
            line++;
            i++;
            continue;
        }
        if (matchCloseTag(content, i, "style")) {
            return { i, line, closed: true };
        }
        if (c === "/" && content[i + 1] === "*") {
            const end = content.indexOf("*/", i + 2);
            const stop = end === -1 ? n : end + 2;
            for (let k = i; k < stop; k++) if (content[k] === "\n") line++;
            i = stop;
            continue;
        }
        if (c === EM) record(line);
        i++;
    }
    return { i, line, closed: false };
}

function skipTagOpen(content, i, line) {
    const gt = content.indexOf(">", i);
    const stop = gt === -1 ? content.length : gt + 1;
    for (let k = i; k < stop; k++) if (content[k] === "\n") line++;
    return { i: stop, line, selfClose: gt !== -1 && content[gt - 1] === "/" };
}

// Scan a Svelte markup expression `{ ... }` (event handler, {#if}, {@const},
// interpolation) as JS: skip its comments and flag em dashes only in its string
// literals, so a `//` comment inside an inline handler can't be misflagged.
// `i` starts at the opening `{`; returns just past the matching `}`.
function scanMarkupExpr(content, start, startLine, record) {
    const n = content.length;
    let i = start;
    let line = startLine;
    let depth = 0;
    let state = "CODE"; // CODE | LINE | BLOCK | SQ | DQ | TPL
    while (i < n) {
        const c = content[i];
        const c2 = content[i + 1];
        if (c === "\n") {
            line++;
            i++;
            if (state === "LINE") state = "CODE";
            continue;
        }
        if (state === "LINE") {
            i++;
            continue;
        }
        if (state === "BLOCK") {
            if (c === "*" && c2 === "/") {
                state = "CODE";
                i += 2;
            } else i++;
            continue;
        }
        if (state === "SQ" || state === "DQ" || state === "TPL") {
            if (c === "\\") {
                if (content[i + 1] === "\n") line++;
                i += 2;
                continue;
            }
            if (
                (state === "SQ" && c === "'") ||
                (state === "DQ" && c === '"') ||
                (state === "TPL" && c === "`")
            ) {
                state = "CODE";
            } else if (c === EM) record(line);
            i++;
            continue;
        }
        // CODE. No regex tracking here: regex literals are rare in markup
        // expressions, and skipping it keeps `{/if}`'s leading slash harmless.
        if (c === "/" && c2 === "/") {
            state = "LINE";
            i += 2;
            continue;
        }
        if (c === "/" && c2 === "*") {
            state = "BLOCK";
            i += 2;
            continue;
        }
        if (c === "'") state = "SQ";
        else if (c === '"') state = "DQ";
        else if (c === "`") state = "TPL";
        else if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) return { i: i + 1, line };
        }
        i++;
    }
    return { i, line };
}

function scanSvelte(content, record) {
    const n = content.length;
    let i = 0;
    let line = 1;
    while (i < n) {
        const c = content[i];
        if (c === "\n") {
            line++;
            i++;
            continue;
        }
        if (c === "<") {
            if (content.startsWith("<!--", i)) {
                const end = content.indexOf("-->", i + 4);
                const stop = end === -1 ? n : end + 3;
                for (let k = i; k < stop; k++) if (content[k] === "\n") line++;
                i = stop;
                continue;
            }
            if (matchOpenTag(content, i, "script")) {
                const o = skipTagOpen(content, i, line);
                i = o.i;
                line = o.line;
                if (!o.selfClose) {
                    const r = scanJsRegion(content, i, line, true, record);
                    i = r.i;
                    line = r.line;
                    if (r.closed) {
                        const cl = skipTagOpen(content, i, line);
                        i = cl.i;
                        line = cl.line;
                    }
                }
                continue;
            }
            if (matchOpenTag(content, i, "style")) {
                const o = skipTagOpen(content, i, line);
                i = o.i;
                line = o.line;
                if (!o.selfClose) {
                    const r = scanStyleRegion(content, i, line, record);
                    i = r.i;
                    line = r.line;
                    if (r.closed) {
                        const cl = skipTagOpen(content, i, line);
                        i = cl.i;
                        line = cl.line;
                    }
                }
                continue;
            }
        }
        // A `{...}` expression: parse it as JS so its comments are exempt.
        if (c === "{") {
            const r = scanMarkupExpr(content, i, line, record);
            i = r.i;
            line = r.line;
            continue;
        }
        // Markup text / attributes: em dash here is UI.
        if (c === EM) record(line);
        i++;
    }
}

function checkFile(file) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    const hits = [];
    const record = (line) => {
        hits.push({
            line,
            text: (lines[line - 1] ?? "").replace(/\r$/, "").trim(),
        });
    };
    if (file.endsWith(".svelte")) scanSvelte(content, record);
    else scanJsRegion(content, 0, 1, false, record);
    return hits;
}

const files = walk(SRC, []);
let total = 0;
for (const file of files) {
    const hits = checkFile(file);
    if (hits.length === 0) continue;
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    for (const h of hits) {
        console.log(`${rel}:${h.line}: ${h.text}`);
        total++;
    }
}

if (total > 0) {
    console.error(
        `\nFound ${total} em dash(es) in UI strings. Replace each with a comma, colon, parenthetical, or spaced hyphen. (Comments and user content are exempt; this guard only scans shipped UI strings.)`,
    );
    process.exit(1);
}
console.log("check-no-emdash: no em dashes in UI strings.");
