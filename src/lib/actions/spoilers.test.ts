import { describe, it, expect, afterEach } from "vitest";
import { spoilers } from "./spoilers";

// Every test mounts into the shared jsdom document, and several reuse
// `id="inner"`. `element.querySelector("#id")` resolves through the document's
// id cache and then checks containment, so a leftover `#inner` from an earlier
// test makes a later test's lookup return null. Clear the body between tests.
afterEach(() => {
    document.body.innerHTML = "";
});

function mount(html: string) {
    const node = document.createElement("div");
    node.innerHTML = html;
    document.body.appendChild(node);
    const handle = spoilers(node);
    return { node, handle };
}

function click(el: Element) {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("spoilers action", () => {
    it("toggles revealed on a spoiler that was present at mount", () => {
        const { node } = mount(`<span data-mx-spoiler>secret</span>`);
        const span = node.querySelector("[data-mx-spoiler]")!;
        expect(span.classList.contains("revealed")).toBe(false);
        click(span);
        expect(span.classList.contains("revealed")).toBe(true);
        click(span);
        expect(span.classList.contains("revealed")).toBe(false);
    });

    it("toggles a spoiler added AFTER mount (the case the observer existed for)", () => {
        const { node } = mount(`<span>plain</span>`);
        node.innerHTML = `<span data-mx-spoiler>late secret</span>`;
        const span = node.querySelector("[data-mx-spoiler]")!;
        click(span);
        expect(span.classList.contains("revealed")).toBe(true);
    });

    it("toggles when the click lands on a descendant of the spoiler", () => {
        const { node } = mount(
            `<span data-mx-spoiler><b id="inner">secret</b></span>`,
        );
        click(node.querySelector("#inner")!);
        expect(
            node
                .querySelector("[data-mx-spoiler]")!
                .classList.contains("revealed"),
        ).toBe(true);
    });

    it("toggles every spoiler ancestor, matching per-element listener bubbling", () => {
        const { node } = mount(
            `<span data-mx-spoiler id="outer"><span data-mx-spoiler id="inner">x</span></span>`,
        );
        click(node.querySelector("#inner")!);
        expect(
            node.querySelector("#inner")!.classList.contains("revealed"),
        ).toBe(true);
        expect(
            node.querySelector("#outer")!.classList.contains("revealed"),
        ).toBe(true);
    });

    it("ignores a click that hits no spoiler", () => {
        const { node } = mount(
            `<span data-mx-spoiler>a</span><span id="plain">b</span>`,
        );
        click(node.querySelector("#plain")!);
        expect(
            node
                .querySelector("[data-mx-spoiler]")!
                .classList.contains("revealed"),
        ).toBe(false);
    });

    it("does not toggle the action's own node even if it is marked", () => {
        const node = document.createElement("div");
        node.dataset.mxSpoiler = "";
        node.innerHTML = `<b id="inner">x</b>`;
        document.body.appendChild(node);
        spoilers(node);
        click(node.querySelector("#inner")!);
        expect(node.classList.contains("revealed")).toBe(false);
    });

    it("stops toggling after destroy", () => {
        const { node, handle } = mount(`<span data-mx-spoiler>secret</span>`);
        handle.destroy();
        const span = node.querySelector("[data-mx-spoiler]")!;
        click(span);
        expect(span.classList.contains("revealed")).toBe(false);
    });

    it("installs no MutationObserver and no per-element listener", () => {
        const { node } = mount(`<span data-mx-spoiler>secret</span>`);
        const span = node.querySelector<HTMLElement>("[data-mx-spoiler]")!;
        // The old implementation branded each span; nothing should be branded now.
        expect(span.dataset.spoilerReady).toBeUndefined();
        // A click that does NOT bubble reaches no delegated listener on `node`,
        // proving the toggle is delegated rather than attached to the span.
        span.dispatchEvent(new MouseEvent("click", { bubbles: false }));
        expect(span.classList.contains("revealed")).toBe(false);
    });
});
