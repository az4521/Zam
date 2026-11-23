import { describe, expect, it } from "vitest";
import {
    editorText,
    pastedPlainText,
    replaceKeepingImages,
} from "./composerDom";

function clipboard(plain: string): DataTransfer {
    return {
        getData: (type: string) => (type === "text/plain" ? plain : ""),
    } as DataTransfer;
}

describe("pastedPlainText", () => {
    // Reported 2026-11-03: pasting multiline text on Windows doubled every
    // line break, because the clipboard's "\r\n" left a "\r" in the model.
    it("normalizes CRLF and lone CR to LF", () => {
        expect(pastedPlainText(clipboard("a\r\nb\r\n\r\nc\rd"))).toBe(
            "a\nb\n\nc\nd",
        );
    });

    it("leaves LF text alone", () => {
        expect(pastedPlainText(clipboard("a\nb\n"))).toBe("a\nb\n");
    });
});

describe("replaceKeepingImages", () => {
    const emote = (src: string, token: string) =>
        `<span class="composer-custom-emoji"><img src="${src}" alt="">${token}</span>`;

    it("keeps the same <img> element for an emote across re-renders", () => {
        const root = document.createElement("div");
        replaceKeepingImages(root, `${emote("a.png", ":a:")} hi`);
        const before = root.querySelector("img");
        replaceKeepingImages(root, `${emote("a.png", ":a:")} hi!`);
        expect(root.querySelector("img")).toBe(before);
        expect(root.textContent).toBe(":a: hi!");
    });

    it("matches repeated emotes one to one and makes new ones fresh", () => {
        const root = document.createElement("div");
        replaceKeepingImages(
            root,
            `${emote("a.png", ":a:")}${emote("b.png", ":b:")}`,
        );
        const [a, b] = Array.from(root.querySelectorAll("img"));
        replaceKeepingImages(
            root,
            `${emote("a.png", ":a:")}${emote("a.png", ":a:")}${emote("b.png", ":b:")}`,
        );
        const imgs = Array.from(root.querySelectorAll("img"));
        expect(imgs).toHaveLength(3);
        expect(imgs[0]).toBe(a);
        expect(imgs[1]).not.toBe(a);
        expect(imgs[2]).toBe(b);
    });

    it("drops images whose emote is gone", () => {
        const root = document.createElement("div");
        replaceKeepingImages(root, emote("a.png", ":a:"));
        replaceKeepingImages(root, "plain");
        expect(root.querySelector("img")).toBeNull();
        expect(root.textContent).toBe("plain");
    });

    it("keeps an image the media healer swapped to a blob URL", () => {
        const root = document.createElement("div");
        const src = "https://hs.example/_matrix/client/v1/media/download/x/y";
        replaceKeepingImages(root, emote(src, ":a:"));
        const healed = root.querySelector("img")!;
        healed.dataset.mediaHealed = src;
        healed.src = "blob:https://app.example/1";
        replaceKeepingImages(root, `${emote(src, ":a:")} hi`);
        const img = root.querySelector("img");
        expect(img).toBe(healed);
        expect(img?.src).toBe("blob:https://app.example/1");
    });
});
