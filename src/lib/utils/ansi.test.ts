import { describe, it, expect } from "vitest";
import { ansiToHtml } from "./ansi";

const ESC = "\x1b";

describe("ansiToHtml", () => {
    it("colours text with the basic palette and resets", () => {
        expect(ansiToHtml(`${ESC}[31mred${ESC}[0m plain`)).toBe(
            '<span style="color: #dc322f">red</span> plain',
        );
    });

    it("handles 24-bit backgrounds, with or without the ESC byte", () => {
        const html = `<span style="background-color: rgb(255, 27, 0)">o</span>`;
        expect(ansiToHtml(`${ESC}[48;2;255;27;0mo`)).toBe(html);
        expect(ansiToHtml("[48;2;255;27;0mo")).toBe(html);
    });

    it("combines styles and keeps them across codes", () => {
        expect(ansiToHtml(`${ESC}[1;4;32mA${ESC}[24mB`)).toBe(
            '<span style="color: #859900; font-weight: bold; text-decoration: underline">A</span>' +
                '<span style="color: #859900; font-weight: bold">B</span>',
        );
    });

    it("supports the 256-colour palette", () => {
        expect(ansiToHtml(`${ESC}[38;5;196mx`)).toBe(
            '<span style="color: rgb(255, 0, 0)">x</span>',
        );
        expect(ansiToHtml(`${ESC}[38;5;244mx`)).toBe(
            '<span style="color: rgb(128, 128, 128)">x</span>',
        );
    });

    it("escapes text and ignores invalid colours and other sequences", () => {
        expect(ansiToHtml(`${ESC}[38;2;999;0;0m<b>${ESC}[2K&`)).toBe(
            "&lt;b&gt;&amp;",
        );
    });

    it("treats an empty code as reset", () => {
        expect(ansiToHtml(`${ESC}[31ma${ESC}[mb`)).toBe(
            '<span style="color: #dc322f">a</span>b',
        );
    });
});
