import { describe, it, expect, beforeEach } from "vitest";
import {
    customCssBlockedByUrl,
    removeStyleSheet,
    setStyleSheet,
} from "./customCss";

const sheets = () =>
    Array.from(document.head.querySelectorAll("style[data-zam-css]")).map(
        (el) => [el.getAttribute("data-zam-css"), el.textContent],
    );

beforeEach(() => {
    for (const el of document.head.querySelectorAll("style[data-zam-css]"))
        el.remove();
});

describe("setStyleSheet", () => {
    it("adds one element per owner and updates it in place", () => {
        setStyleSheet("user", "a{}");
        setStyleSheet("plugin:x", "b{}");
        setStyleSheet("user", "c{}");
        expect(sheets()).toEqual([
            ["user", "c{}"],
            ["plugin:x", "b{}"],
        ]);
    });

    it("removes the sheet when the css is empty or blank", () => {
        setStyleSheet("user", "a{}");
        setStyleSheet("user", "  \n");
        expect(sheets()).toEqual([]);
        setStyleSheet("user", "a{}");
        removeStyleSheet("user");
        expect(sheets()).toEqual([]);
    });

    it("treats the css as text, never markup", () => {
        setStyleSheet("user", "</style><script>boom()</script>");
        expect(document.head.querySelector("script")).toBeNull();
        expect(sheets()).toHaveLength(1);
    });
});

describe("customCssBlockedByUrl", () => {
    it("is true only with ?nocustomcss", () => {
        expect(customCssBlockedByUrl()).toBe(false);
        history.replaceState(null, "", "/?nocustomcss");
        expect(customCssBlockedByUrl()).toBe(true);
        history.replaceState(null, "", "/");
    });
});
