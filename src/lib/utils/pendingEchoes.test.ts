import { describe, it, expect } from "vitest";
import {
    classifyPendingEcho,
    dedupeById,
    isLocalEchoId,
} from "./pendingEchoes";

describe("isLocalEchoId", () => {
    it("recognises SDK local echo ids", () => {
        expect(isLocalEchoId("~!room:example.org:m123.4")).toBe(true);
        expect(isLocalEchoId(undefined)).toBe(true);
        expect(isLocalEchoId("$abc")).toBe(false);
    });
});

describe("classifyPendingEcho", () => {
    it("keeps an echo that still has a local id, whatever its status", () => {
        for (const status of ["sending", "not_sent", "queued", "encrypting"]) {
            expect(
                classifyPendingEcho({
                    id: "~!r:x:m1",
                    status,
                    inTimeline: false,
                }),
            ).toBe("keep");
        }
    });

    it("drops a SENT echo whose real copy is already in the timeline", () => {
        expect(
            classifyPendingEcho({
                id: "$real",
                status: "sent",
                inTimeline: true,
            }),
        ).toBe("drop");
    });

    it("drops a NOT_SENT echo carrying a server id (restored after reload)", () => {
        expect(
            classifyPendingEcho({
                id: "$real",
                status: "not_sent",
                inTimeline: false,
            }),
        ).toBe("drop");
    });

    it("keeps a SENT echo still waiting for its remote echo", () => {
        expect(
            classifyPendingEcho({
                id: "$real",
                status: "sent",
                inTimeline: false,
            }),
        ).toBe("keep");
    });
});

describe("dedupeById", () => {
    const id = (x: { id: string }) => x.id;

    it("returns the same array when there are no duplicates", () => {
        const items = [{ id: "a" }, { id: "b" }];
        expect(dedupeById(items, id)).toBe(items);
    });

    it("keeps the first occurrence and preserves order", () => {
        const a1 = { id: "a" };
        const a2 = { id: "a" };
        const b = { id: "b" };
        expect(dedupeById([a1, b, a2], id)).toEqual([a1, b]);
        expect(dedupeById([a1, b, a2], id)[0]).toBe(a1);
    });
});
