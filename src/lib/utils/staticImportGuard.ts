/** Source-level detection of a STATIC dependency on a module.
 *
 *  "Static" means it survives to runtime and pulls the module into the
 *  importing chunk: `import …from "m"`, a bare `import "m"`, a re-export,
 *  or `require("m")`. Type-only forms (`import type …`, `typeof import(…)`)
 *  and dynamic `import("m")` are erased or split out and do not count.
 *
 *  Note `import { type X } from "m"` DOES count: TypeScript keeps the
 *  import statement, so the module still lands in the chunk.
 *
 *  This is a guard, not a compiler. Where it is unsure it errs toward
 *  reporting a static import, because a false alarm is loud and fixable
 *  while a miss silently restores the megabyte the branch removed.
 */
export function hasStaticImport(source: string, specifier: string): boolean {
    const code = stripComments(source);
    const spec = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // "m" or "m/subpath", any quote style. Anchored on both quotes so
    // "not-m", "m-extra" and "@scope/m" cannot match.
    const from = `["'\`]${spec}(?:/[^"'\`]*)?["'\`]`;

    // A statement-position keyword: not a property (`obj.import`), not part
    // of a longer word (`reimport`), not the first thing inside a string.
    // Covers newline, `;`, `{`, and a Svelte `<script>` tag's `>`.
    const kw = `(?<![\\w$.'"\`])`;

    // The clause between `import`/`export` and `from`. Restricted to the
    // characters an import clause can actually contain — crucially NOT
    // quotes or `;`, so the match can never run off the end of one import
    // statement and pick up the specifier of the next one. (A whole-file
    // `[\s\S]*?` does exactly that, and reads `import x from "a";` +
    // `import type * as y from "m";` as a static import of "m".)
    const clause = `[\\w$*,{}\\s]*?`;

    // `import`/`export` … `from "m"` — but not `import type`/`export type`.
    // The lookahead spans the whitespace so it cannot be backtracked past.
    const importFrom = new RegExp(
        `${kw}(?:import|export)\\b(?!\\s*type\\b)${clause}\\bfrom\\s*${from}`,
    );
    // Bare side-effect import: `import "m"`. A quote must follow directly,
    // which is what separates it from dynamic `import("m")`.
    const bare = new RegExp(`${kw}import\\b\\s*${from}`);
    // require("m")
    const req = new RegExp(`\\brequire\\s*\\(\\s*${from}\\s*\\)`);

    return importFrom.test(code) || bare.test(code) || req.test(code);
}

/** Blank out line, block and HTML comments while leaving string and
 *  template literals byte-identical — the specifiers we are looking for live
 *  in those. Matching literals first is what stops an apostrophe inside a
 *  comment, or a `//` inside a URL string, from derailing the scan.
 *
 *  Quoted-string alternatives stop at a newline (a JS string literal cannot
 *  span one unescaped), so a stray quote can only ever swallow the rest of
 *  its own line. The only text this ever REMOVES is text matched as a
 *  comment; string bodies are returned untouched. Comments become a space so
 *  that removing one can never fuse two identifiers together. */
function stripComments(source: string): string {
    return source.replace(
        /("(?:[^"\\\n]|\\.)*")|('(?:[^'\\\n]|\\.)*')|(`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*/g,
        (_match: string, dq?: string, sq?: string, tpl?: string) =>
            dq ?? sq ?? tpl ?? " ",
    );
}
