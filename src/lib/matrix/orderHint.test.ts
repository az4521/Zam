import { describe, it, expect } from "vitest";
import { ORDER_HINT_KEY, addOrderHints, placeAfterHints } from "./orderHint";

const ev = (id: string, after?: string) => ({
    getId: () => id,
    getContent: () => (after ? { [ORDER_HINT_KEY]: after } : {}),
});
const order = (events: ReturnType<typeof ev>[]) =>
    placeAfterHints(events).map((e) => e.getId());

describe("placeAfterHints", () => {
    it("leaves a timeline without hints alone", () => {
        const events = [ev("a"), ev("b")];
        expect(placeAfterHints(events)).toBe(events);
    });

    it("moves an answer below the question the server put it above", () => {
        expect(order([ev("answer", "question"), ev("question")])).toEqual([
            "question",
            "answer",
        ]);
    });

    it("leaves a message already below its hint", () => {
        expect(order([ev("x"), ev("m", "x"), ev("y")])).toEqual([
            "x",
            "m",
            "y",
        ]);
    });

    it("keeps the server's order between messages with the same hint", () => {
        expect(order([ev("x"), ev("m2", "x"), ev("m1", "x")])).toEqual([
            "x",
            "m2",
            "m1",
        ]);
    });

    it("ignores a hint for an event it doesn't have", () => {
        expect(order([ev("a", "gone"), ev("b")])).toEqual(["a", "b"]);
    });

    it("ignores a hint pointing far below", () => {
        const filler = Array.from({ length: 60 }, (_, i) => ev(`f${i}`));
        expect(order([ev("m", "x"), ...filler, ev("x")])[0]).toBe("m");
    });

    it("doesn't loop when two messages name each other", () => {
        expect(order([ev("a", "b"), ev("b", "a")])).toEqual(["a", "b"]);
    });
});

describe("addOrderHints", () => {
    const fake = () => {
        const sent: unknown[][] = [];
        const client = {
            getRoom: (id: string) => ({ roomId: id }),
            sendMessage: async (...args: unknown[]) => {
                sent.push(args);
            },
        };
        return { client, sent };
    };

    it("adds the bottom event's id to a message", async () => {
        const { client, sent } = fake();
        addOrderHints(client as never, () => "$tail");
        await client.sendMessage("!r", { body: "hi" });
        expect(sent[0][1]).toEqual({ body: "hi", [ORDER_HINT_KEY]: "$tail" });
    });

    it("finds the content after a thread id", async () => {
        const { client, sent } = fake();
        addOrderHints(client as never, () => "$tail");
        await client.sendMessage("!r", "$thread", { body: "hi" });
        expect(sent[0][2]).toEqual({ body: "hi", [ORDER_HINT_KEY]: "$tail" });
    });

    it("adds nothing while switched off", async () => {
        const { client, sent } = fake();
        addOrderHints(
            client as never,
            () => "$tail",
            () => false,
        );
        const content = { body: "hi" };
        await client.sendMessage("!r", content);
        expect(sent[0][1]).toBe(content);
    });

    it("leaves an edit alone", async () => {
        const { client, sent } = fake();
        addOrderHints(client as never, () => "$tail");
        const edit = { body: "* hi", "m.new_content": { body: "hi" } };
        await client.sendMessage("!r", edit);
        expect(sent[0][1]).toBe(edit);
    });
});
