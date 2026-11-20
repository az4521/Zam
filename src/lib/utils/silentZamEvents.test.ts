import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CALL_KICK_EVENT_TYPE } from "./callKick";
import { SILENT_ZAM_EVENT_TYPES, isSilentZamEvent } from "./silentZamEvents";

const SW = readFileSync(resolve(process.cwd(), "static/sw.js"), "utf8");
const JAVA = readFileSync(
    resolve(
        process.cwd(),
        "android/app/src/main/java/moe/crafty/matrix/MatrixMessagingService.java",
    ),
    "utf8",
);

describe("isSilentZamEvent", () => {
    it("marks the call kick command as silent", () => {
        expect(isSilentZamEvent(CALL_KICK_EVENT_TYPE)).toBe(true);
    });

    it("leaves messages and call signalling alone", () => {
        expect(isSilentZamEvent("m.room.message")).toBe(false);
        expect(isSilentZamEvent("m.room.encrypted")).toBe(false);
        expect(isSilentZamEvent("org.matrix.msc4075.rtc.notification")).toBe(
            false,
        );
    });

    it("has no duplicate entries", () => {
        expect(new Set(SILENT_ZAM_EVENT_TYPES).size).toBe(
            SILENT_ZAM_EVENT_TYPES.length,
        );
    });
});

describe("native and worker push paths carry the same silent types", () => {
    for (const type of SILENT_ZAM_EVENT_TYPES) {
        it(`sw.js drops ${type} pushes`, () => {
            expect(SW).toContain(`"${type}"`);
        });
        it(`MatrixMessagingService.java drops ${type} pushes`, () => {
            expect(JAVA).toContain(`"${type}"`);
        });
    }
});
