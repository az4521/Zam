import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire(import.meta.url);
const { BUNDLE_PUBLIC_KEY } = require("../../../electron/bundleKey.cjs");

describe("web bundle public key", () => {
    it("is the same in the desktop and Android apps", () => {
        const java = fs.readFileSync(
            path.resolve(
                __dirname,
                "../../../android/app/src/main/java/moe/crafty/matrix/WebBundleKey.java",
            ),
            "utf8",
        );
        const match = java.match(/PUBLIC_KEY\s*=\s*"([^"]+)"/);
        expect(match?.[1]).toBe(BUNDLE_PUBLIC_KEY);
    });
});
