import { describe, it, expect } from "vitest";
import {
    rendererProblem,
    findRenderer,
    rendererEventTypes,
} from "./pluginRenderers";
import type { MessageRenderer } from "./types";

const render = () => {};
const byType = (eventType: string): MessageRenderer => ({
    eventType,
    render,
});
const byMsgtype = (msgtype: string): MessageRenderer => ({
    msgtype,
    render,
});

describe("rendererProblem", () => {
    it("accepts a custom event type and a custom msgtype", () => {
        expect(rendererProblem(byType("com.example.superreact"))).toBeNull();
        expect(rendererProblem(byMsgtype("com.example.x"))).toBeNull();
    });

    it("refuses a renderer without a render function", () => {
        expect(
            rendererProblem({ eventType: "com.example.x" } as MessageRenderer),
        ).toMatch(/render function/);
    });

    it("requires exactly one of eventType or msgtype", () => {
        const neither = { render } as MessageRenderer;
        const both = {
            eventType: "com.example.x",
            msgtype: "com.example.y",
            render,
        };
        expect(rendererProblem(neither)).toMatch(/exactly one/);
        expect(rendererProblem(both)).toMatch(/exactly one/);
    });

    it("refuses an empty string as the type", () => {
        expect(rendererProblem(byType(""))).toMatch(/non-empty/);
        expect(rendererProblem(byMsgtype(""))).toMatch(/non-empty/);
    });

    it("refuses m.-namespaced event types and msgtypes", () => {
        expect(rendererProblem(byType("m.room.message"))).toMatch(
            /standard Matrix type/,
        );
        expect(rendererProblem(byMsgtype("m.text"))).toMatch(
            /standard Matrix type/,
        );
    });

    it("refuses the unstable poll start type", () => {
        expect(
            rendererProblem(byType("org.matrix.msc3381.poll.start")),
        ).toMatch(/rendered by Zam/);
    });

    it("refuses the stable poll start type as an m. type", () => {
        // The m. prefix check runs first, so this is refused either way.
        expect(rendererProblem(byType("m.poll.start"))).toMatch(
            /standard Matrix type/,
        );
    });

    it("refuses the file offer type", () => {
        expect(rendererProblem(byType("moe.crafty.matrix.file_offer"))).toMatch(
            /rendered by Zam/,
        );
    });

    it.each([
        "org.matrix.msc3401.call.member",
        "org.matrix.msc4075.call.notify",
    ])("refuses the call type %s", (type) => {
        expect(rendererProblem(byType(type))).toMatch(/rendered by Zam/);
    });

    it("refuses the m.call.notify type as an m. type", () => {
        expect(rendererProblem(byType("m.call.notify"))).toMatch(
            /standard Matrix type/,
        );
    });
});

describe("findRenderer", () => {
    it("matches by eventType", () => {
        const a = byType("com.example.a");
        const b = byType("com.example.b");
        expect(findRenderer([a, b], "com.example.b", undefined)).toBe(b);
    });

    it("matches a msgtype only for m.room.message", () => {
        const r = byMsgtype("com.example.x");
        expect(findRenderer([r], "m.room.message", "com.example.x")).toBe(r);
        expect(findRenderer([r], "com.example.other", "com.example.x")).toBe(
            null,
        );
    });

    it("does not match a msgtype renderer on a different msgtype", () => {
        const r = byMsgtype("com.example.x");
        expect(findRenderer([r], "m.room.message", "com.example.y")).toBeNull();
    });

    it("lets the first registered renderer win", () => {
        const first = byType("com.example.x");
        const second = byType("com.example.x");
        expect(findRenderer([first, second], "com.example.x", undefined)).toBe(
            first,
        );
    });

    it("returns null when nothing matches", () => {
        expect(findRenderer([], "com.example.x", undefined)).toBeNull();
        expect(
            findRenderer([byType("com.example.a")], "com.example.b", undefined),
        ).toBeNull();
    });
});

describe("rendererEventTypes", () => {
    it("collects only the eventTypes, not msgtypes", () => {
        const types = rendererEventTypes([
            byType("com.example.a"),
            byMsgtype("com.example.m"),
            byType("com.example.b"),
            byType("com.example.a"),
        ]);
        expect([...types].sort()).toEqual(["com.example.a", "com.example.b"]);
    });

    it("is empty with no renderers", () => {
        expect(rendererEventTypes([]).size).toBe(0);
    });
});
