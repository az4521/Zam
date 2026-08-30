import { describe, it, expect, beforeEach, vi } from "vitest";
import { bodyImageGallery } from "./bodyImageGallery";

function media(src: string, alt = ""): HTMLImageElement {
    const img = document.createElement("img");
    img.setAttribute("src", src);
    if (alt) img.setAttribute("alt", alt);
    return img;
}
function twemoji(): HTMLImageElement {
    const img = document.createElement("img");
    img.setAttribute("src", "/twemoji/svg/1f600.svg");
    img.className = "twemoji";
    return img;
}
function emote(): HTMLImageElement {
    const img = document.createElement("img");
    img.setAttribute("src", "https://hs/_matrix/e");
    img.setAttribute("data-mx-emoticon", "");
    return img;
}
/** Fire a real bubbling click and report whether the default was prevented. */
function clickOn(el: Element, init: MouseEventInit = {}): boolean {
    const ev = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init,
    });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
}

describe("bodyImageGallery action", () => {
    let node: HTMLDivElement;
    let onOpen: ReturnType<typeof vi.fn>;
    beforeEach(() => {
        document.body.innerHTML = "";
        node = document.createElement("div");
        document.body.appendChild(node);
        onOpen = vi.fn();
        // jsdom leaves selection collapsed by default → the guard passes.
    });

    it("opens the gallery at the clicked media image's index", () => {
        const a = media("A", "cat");
        const b = media("B");
        node.append(a, twemoji(), b);
        const handle = bodyImageGallery(node, { onOpen });
        const prevented = clickOn(b);
        expect(onOpen).toHaveBeenCalledTimes(1);
        const [images, index] = onOpen.mock.calls[0];
        expect(images).toEqual([
            { src: "A", alt: "cat" },
            { src: "B", alt: "" },
        ]);
        expect(index).toBe(1);
        expect(prevented).toBe(true);
        handle.destroy();
    });

    it("ignores a click on a Twemoji emoji image", () => {
        const t = twemoji();
        node.append(media("A"), t);
        bodyImageGallery(node, { onOpen });
        const prevented = clickOn(t);
        expect(onOpen).not.toHaveBeenCalled();
        expect(prevented).toBe(false);
    });

    it("ignores a click on a custom emote image", () => {
        const e = emote();
        node.append(media("A"), e);
        bodyImageGallery(node, { onOpen });
        clickOn(e);
        expect(onOpen).not.toHaveBeenCalled();
    });

    it("ignores a non-image click and a modified click", () => {
        const a = media("A");
        node.append(a, document.createTextNode("hi"));
        bodyImageGallery(node, { onOpen });
        clickOn(node); // clicked the container, not an image
        expect(onOpen).not.toHaveBeenCalled();
        clickOn(a, { ctrlKey: true }); // modified click on the image
        expect(onOpen).not.toHaveBeenCalled();
    });

    it("does not hijack a click while text is selected", () => {
        const a = media("A");
        node.append(a, document.createTextNode("selectable text"));
        bodyImageGallery(node, { onOpen });
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);
        const prevented = clickOn(a);
        expect(onOpen).not.toHaveBeenCalled();
        expect(prevented).toBe(false);
        sel.removeAllRanges();
    });

    it("update swaps the callback and destroy removes the listener", () => {
        const a = media("A");
        node.append(a);
        const handle = bodyImageGallery(node, { onOpen });
        const onOpen2 = vi.fn();
        handle.update({ onOpen: onOpen2 });
        clickOn(a);
        expect(onOpen).not.toHaveBeenCalled();
        expect(onOpen2).toHaveBeenCalledTimes(1);
        handle.destroy();
        onOpen2.mockClear();
        clickOn(a);
        expect(onOpen2).not.toHaveBeenCalled();
    });
});
