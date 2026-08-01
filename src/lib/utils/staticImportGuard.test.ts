import { describe, it, expect } from "vitest";
import { hasStaticImport } from "./staticImportGuard";

const M = "livekit-client";

describe("hasStaticImport", () => {
    it.each([
        ['import { Room } from "livekit-client";', "named"],
        ["import { Room } from 'livekit-client';", "single quotes"],
        ['import Room from "livekit-client";', "default"],
        ['import * as lk from "livekit-client";', "namespace"],
        ['import "livekit-client";', "side effect"],
        ['export { Room } from "livekit-client";', "re-export"],
        ['export * from "livekit-client";', "star re-export"],
        ['const lk = require("livekit-client");', "require"],
        ['import {\n    Room,\n} from "livekit-client";', "multiline"],
        [
            'import { type Room, Track } from "livekit-client";',
            "inline type + value",
        ],
    ])("matches %s (%s)", (source) => {
        expect(hasStaticImport(source, M)).toBe(true);
    });

    it.each([
        ['import type { Room } from "livekit-client";', "type-only import"],
        ['import type * as lk from "livekit-client";', "type-only namespace"],
        ['export type { Room } from "livekit-client";', "type-only re-export"],
        ['const lk = await import("livekit-client");', "dynamic import"],
        ['type M = typeof import("livekit-client");', "typeof import"],
        ['// import { Room } from "livekit-client";', "commented out"],
        ['import { Room } from "livekit-client-extra";', "different specifier"],
        ['import { Room } from "not-livekit-client";', "specifier suffix"],
    ])("does not match %s (%s)", (source) => {
        expect(hasStaticImport(source, M)).toBe(false);
    });

    it("matches a specifier with a subpath", () => {
        expect(
            hasStaticImport(
                'import hljs from "highlight.js/lib/common";',
                "highlight.js",
            ),
        ).toBe(true);
    });

    // --- Widened coverage -------------------------------------------------
    // The cases above all describe a one-line file. Real re-additions land in
    // a file that already has imports, is indented inside a Svelte <script>,
    // and is checked out with CRLF endings. A matcher that only handles the
    // shapes above passes its own suite and still misses the regression.

    it.each([
        // The realistic mutant: a re-added import BELOW the existing ones.
        [
            'import { onMount } from "svelte";\nimport { Room } from "livekit-client";\n',
            "re-added below other imports",
        ],
        [
            'import { onMount } from "svelte";\r\nimport { Room } from "livekit-client";\r\n',
            "CRLF working tree",
        ],
        [
            '<script lang="ts">\n    import { Room } from "livekit-client";\n</script>\n',
            "indented in a Svelte script block",
        ],
        ['import Room, { Track } from "livekit-client";', "default + named"],
        ['import Room, * as lk from "livekit-client";', "default + namespace"],
        ['import * as lk from "livekit-client"', "no trailing semicolon"],
        ['import { Room } from "livekit-client/dist/room";', "subpath"],
        ['export * as lk from "livekit-client";', "namespace re-export"],
        [
            'export { Room as LkRoom } from "livekit-client";',
            "renamed re-export",
        ],
        [
            'import typeRoom from "livekit-client";',
            "binding whose name starts with type",
        ],
        ['const { Room } = require("livekit-client");', "destructured require"],
        ['import{Room}from"livekit-client";', "no whitespace"],
        [
            'import {\n    // the room\n    Room,\n} from "livekit-client";',
            "comment inside the clause",
        ],
        [
            'import type { Room } from "livekit-client";\nimport { Track } from "livekit-client";',
            "type-only import plus a real one",
        ],
    ])("matches %s (%s)", (source) => {
        expect(hasStaticImport(source, M)).toBe(true);
    });

    it.each([
        // The exact shape of client.ts today. A whole-file `[\s\S]*?` between
        // the keyword and `from` runs off the end of the first statement and
        // reads this as a static import of livekit-client.
        [
            'import { VerificationMethod } from "matrix-js-sdk/lib/types";\nimport type * as LivekitClient from "livekit-client";\n',
            "type-only namespace after a real import",
        ],
        [
            'import { foo } from "./a";\ntype M = typeof import("livekit-client");\n',
            "typeof import after a real import",
        ],
        [
            'import { foo } from "./a";\nconst lk = await import("livekit-client");\n',
            "dynamic import after a real import",
        ],
        [
            'import { lazyModule } from "./lazyModule";\nconst livekit = lazyModule<LivekitModule>(() => import("livekit-client"));\n',
            "lazyModule seam after a real import",
        ],
        [
            'import { foo } from "./a";\n/*\nimport { Room } from "livekit-client";\n*/\n',
            "block-commented import",
        ],
        [
            "/** Structural on purpose: it keeps this file free of a static\n *  `livekit-client` import. */\nexport interface Fake {}\n",
            "doc-comment prose naming the module",
        ],
        [
            'const x = 1; // import { Room } from "livekit-client";',
            "trailing line comment",
        ],
        [
            '<!-- was: import { Room } from "livekit-client"; -->\n<div></div>\n',
            "HTML-commented import",
        ],
        [
            'const lk = await import(\n    "livekit-client",\n);',
            "dynamic import split across lines",
        ],
        ['export type * from "livekit-client";', "type-only star re-export"],
        [
            'import { Room } from "@livekit/components-react";',
            "scoped lookalike",
        ],
        ['console.log("livekit-client");', "bare string mention"],
        ['const NAME = "livekit-client";', "string constant"],
        [
            'const url = "https://example.com/livekit-client";',
            "specifier inside a URL string",
        ],
    ])("does not match %s (%s)", (source) => {
        expect(hasStaticImport(source, M)).toBe(false);
    });

    describe("specifier boundaries", () => {
        const H = "highlight.js";

        it.each([
            ['import hljs from "highlight.js";', "exact"],
            ['import hljs from "highlight.js/lib/core";', "deep subpath"],
        ])("matches %s (%s)", (source) => {
            expect(hasStaticImport(source, H)).toBe(true);
        });

        it.each([
            // The `.` must be escaped, or `highlight-js` matches too.
            ['import hljs from "highlight-js";', "dot is literal"],
            ['import hljs from "highlightxjs";', "dot is not a wildcard"],
            [
                'import hljs from "highlight.jsx";',
                "no separator after the specifier",
            ],
            [
                'import H from "@types/highlight.js";',
                "specifier is only a subpath",
            ],
        ])("does not match %s (%s)", (source) => {
            expect(hasStaticImport(source, H)).toBe(false);
        });
    });
});
