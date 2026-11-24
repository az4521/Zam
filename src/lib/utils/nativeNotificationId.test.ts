import { describe, expect, it } from "vitest";
import {
    javaStringHash,
    nativeNotificationIds,
    nativeNotificationKey,
} from "./nativeNotificationId";

describe("javaStringHash", () => {
    it("matches Java's String.hashCode()", () => {
        // Values computed with Java: "".hashCode() == 0, "hello" == 99162322,
        // "!abc:example.org" == 501476103,
        // "@a:hs|!r:hs" == 755448252 (checked with jshell).
        expect(javaStringHash("")).toBe(0);
        expect(javaStringHash("hello")).toBe(99162322);
        expect(javaStringHash("!abc:example.org")).toBe(501476103);
        expect(javaStringHash("@a:hs|!r:hs")).toBe(755448252);
    });
});

describe("nativeNotificationIds", () => {
    it("keys by account and room, keeping the legacy room-only id", () => {
        expect(nativeNotificationKey("@a:hs", "!r:hs")).toBe("@a:hs|!r:hs");
        expect(nativeNotificationIds("@a:hs", "!r:hs")).toEqual([
            javaStringHash("@a:hs|!r:hs"),
            javaStringHash("!r:hs"),
        ]);
    });

    it("gives two accounts in one room different ids", () => {
        expect(nativeNotificationIds("@a:hs", "!r:hs")[0]).not.toBe(
            nativeNotificationIds("@b:hs", "!r:hs")[0],
        );
    });

    it("falls back to the room id with no account", () => {
        expect(nativeNotificationIds(null, "!r:hs")).toEqual([
            javaStringHash("!r:hs"),
        ]);
    });
});
