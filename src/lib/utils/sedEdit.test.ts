import { describe, expect, it } from "vitest";
import { applySedCommand, parseSedCommand } from "./sedEdit";

describe("parseSedCommand", () => {
    it("parses with and without the trailing slash", () => {
        const cmd = {
            pattern: "teh",
            replacement: "the",
            global: false,
            ignoreCase: false,
        };
        expect(parseSedCommand("s/teh/the/")).toEqual(cmd);
        expect(parseSedCommand("s/teh/the")).toEqual(cmd);
        expect(parseSedCommand("  s/teh/the/  ")).toEqual(cmd);
    });

    it("reads the flags", () => {
        expect(parseSedCommand("s/a/b/g")).toMatchObject({
            global: true,
            ignoreCase: false,
        });
        expect(parseSedCommand("s/a/b/gi")).toMatchObject({
            global: true,
            ignoreCase: true,
        });
    });

    it("allows an empty replacement", () => {
        expect(parseSedCommand("s/very //")).toMatchObject({
            pattern: "very ",
            replacement: "",
        });
    });

    it("unescapes slashes, backslashes and line breaks", () => {
        expect(parseSedCommand(String.raw`s/a\/b/c\\d\ne/`)).toMatchObject({
            pattern: "a/b",
            replacement: "c\\d\ne",
        });
        expect(parseSedCommand(String.raw`s/\d/x/`)?.pattern).toBe("\\d");
    });

    it("leaves ordinary messages alone", () => {
        for (const text of [
            "s/",
            "s//x/",
            "s/a",
            "s/a/b/x",
            "s/a/b/ and more",
            "see s/a/b/",
            "S/a/b/",
            "/s/a/b/",
            "hello",
        ])
            expect(parseSedCommand(text), text).toBeNull();
    });
});

describe("applySedCommand", () => {
    const sed = (text: string) => parseSedCommand(text)!;

    it("replaces the first occurrence by default", () => {
        expect(applySedCommand("a a a", sed("s/a/b/"))).toBe("b a a");
    });

    it("replaces every occurrence with g", () => {
        expect(applySedCommand("a a a", sed("s/a/b/g"))).toBe("b b b");
    });

    it("ignores case with i", () => {
        expect(applySedCommand("Hello", sed("s/hello/bye/"))).toBeNull();
        expect(applySedCommand("Hello", sed("s/hello/bye/i"))).toBe("bye");
    });

    it("matches literally", () => {
        expect(applySedCommand("a.c abc", sed("s/a.c/x/g"))).toBe("x abc");
        expect(applySedCommand("(x)", sed("s/(x)/y/"))).toBe("y");
    });

    it("keeps $ patterns in the replacement literal", () => {
        expect(applySedCommand("cost", sed("s/cost/$&$1/"))).toBe("$&$1");
    });

    it("returns null when the pattern is absent", () => {
        expect(applySedCommand("hello", sed("s/bye/x/"))).toBeNull();
    });
});
