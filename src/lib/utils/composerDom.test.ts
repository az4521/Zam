import { afterEach, describe, expect, it } from "vitest";
import {
    caretOffset,
    editorText,
    modelLength,
    pastedPlainText,
    replaceKeepingImages,
    selectedLength,
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

/** The clone-based implementations this file used before the live walker.
 *  Kept here as the reference the walker must match exactly. */
function cloneCaretOffset(root: HTMLElement, fallback: number): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return fallback;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) return fallback;
    const preCaret = range.cloneRange();
    preCaret.selectNodeContents(root);
    preCaret.setEnd(range.endContainer, range.endOffset);
    return modelLength(preCaret.cloneContents());
}

function cloneSelectedLength(root: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.endContainer)) return 0;
    return modelLength(range.cloneContents());
}

/** Every boundary point in `node`'s subtree, in document order. */
function boundaryPoints(node: Node): [Node, number][] {
    const points: [Node, number][] = [];
    const visit = (n: Node) => {
        if (n.nodeType === Node.TEXT_NODE) {
            for (let i = 0; i <= (n.textContent?.length ?? 0); i++)
                points.push([n, i]);
            return;
        }
        for (let i = 0; i <= n.childNodes.length; i++) points.push([n, i]);
        for (const child of Array.from(n.childNodes)) visit(child);
    };
    visit(node);
    return points;
}

function selectRange(start: [Node, number], end: [Node, number]): void {
    const range = document.createRange();
    range.setStart(start[0], start[1]);
    range.setEnd(end[0], end[1]);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

describe("live walker matches the clone-based model length", () => {
    // Composer shapes: plain text, line breaks, nested spans, emoji images,
    // mention pills, block wrappers, a trailing <br>, and astral characters.
    const composers = [
        "hello world",
        "line one<br>line two",
        "line one<br>line two<br>",
        "<br><br>x<br>",
        "a<span>bc<span>de</span>f</span><br>g",
        'hi <img alt=":x:" src="x.png">there <img alt=":y:" src="y.png">!',
        '<span class="pill" contenteditable="false">@alice</span> hi <span class="pill">@bob</span>',
        "<div>one</div><div>two<br></div><div><br></div>",
        "α😀 multi-unit<span>✓</span>end",
    ];

    // The composer sits between text outside it, so selections can start
    // outside the root (selectedLength counts whatever the range touches).
    function build(html: string): { root: HTMLElement; outside: Text } {
        const wrap = document.createElement("div");
        const before = document.createTextNode("outside-before");
        const root = document.createElement("div");
        root.innerHTML = html;
        const after = document.createElement("span");
        after.textContent = "tail";
        wrap.append(before, root, after);
        document.body.append(wrap);
        return { root, outside: before };
    }

    afterEach(() => {
        document.body.innerHTML = "";
        window.getSelection()?.removeAllRanges();
    });

    it.each(composers)("caretOffset agrees at every point of %j", (html) => {
        const { root } = build(html);
        for (const point of boundaryPoints(root)) {
            selectRange(point, point);
            expect(caretOffset(root, -1)).toBe(cloneCaretOffset(root, -1));
        }
    });

    it.each(composers)(
        "selectedLength agrees on every selection of %j",
        (html) => {
            const { root, outside } = build(html);
            const points = boundaryPoints(root);
            for (const start of points) {
                for (const end of points) {
                    selectRange(start, end);
                    expect(selectedLength(root)).toBe(
                        cloneSelectedLength(root),
                    );
                }
            }
            // Selections that start outside the composer and end inside it.
            const outsidePoints: [Node, number][] = [
                [outside, 0],
                [outside, 5],
                [outside, outside.textContent!.length],
            ];
            for (const start of outsidePoints) {
                for (const end of points) {
                    selectRange(start, end);
                    expect(selectedLength(root)).toBe(
                        cloneSelectedLength(root),
                    );
                }
            }
        },
    );

    it("counts a caret after a <br> and inside a later span", () => {
        // "first" (5) + <br> (1) + "second" (6) + "3" (1) = 13.
        const { root } = build("first<br>second<span>3<br>x</span>");
        const digit = root.lastChild!.firstChild!;
        selectRange([digit, 1], [digit, 1]);
        expect(caretOffset(root, -1)).toBe(13);
        expect(caretOffset(root, -1)).toBe(cloneCaretOffset(root, -1));
    });

    it("returns the fallback and 0 when the selection is outside the composer", () => {
        const { root, outside } = build("abc");
        selectRange([outside, 2], [outside, 4]);
        expect(caretOffset(root, 7)).toBe(7);
        expect(selectedLength(root)).toBe(0);
    });
});
