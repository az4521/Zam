import { describe, it, expect } from "vitest";
import { normalizeSharePayload } from "./sharePayload";

describe("normalizeSharePayload", () => {
    it("web: joins title, text, url with newlines", () => {
        expect(
            normalizeSharePayload({
                source: "web",
                title: "Cool",
                text: "look at this",
                url: "https://x.dev",
            }),
        ).toEqual({ kind: "text", text: "Cool\nlook at this\nhttps://x.dev" });
    });

    it("web: drops url when text already contains it", () => {
        expect(
            normalizeSharePayload({
                source: "web",
                text: "see https://x.dev now",
                url: "https://x.dev",
            }),
        ).toEqual({ kind: "text", text: "see https://x.dev now" });
    });

    it("android: joins subject and text", () => {
        expect(
            normalizeSharePayload({
                source: "android",
                subject: "Subj",
                text: "body",
            }),
        ).toEqual({ kind: "text", text: "Subj\nbody" });
    });

    it("files present → kind files with caption and files passthrough", () => {
        const f = { name: "a.png" };
        expect(
            normalizeSharePayload({
                source: "web",
                text: "caption",
                files: [f],
            }),
        ).toEqual({ kind: "files", text: "caption", files: [f] });
    });

    it("files with empty caption → kind files, empty text", () => {
        const f = { name: "a.png" };
        expect(
            normalizeSharePayload({ source: "android", files: [f] }),
        ).toEqual({ kind: "files", text: "", files: [f] });
    });

    it("drops falsy file entries", () => {
        const f = { name: "a.png" };
        expect(
            normalizeSharePayload({
                source: "web",
                files: [null as unknown, f, undefined as unknown],
            }),
        ).toEqual({ kind: "files", text: "", files: [f] });
    });

    it("empty share → null", () => {
        expect(
            normalizeSharePayload({ source: "web", text: "  ", url: "" }),
        ).toBeNull();
        expect(normalizeSharePayload({ source: "android" })).toBeNull();
    });

    it("trims and skips blank pieces", () => {
        expect(
            normalizeSharePayload({
                source: "web",
                title: "  ",
                text: " hi ",
                url: "",
            }),
        ).toEqual({ kind: "text", text: "hi" });
    });
});
