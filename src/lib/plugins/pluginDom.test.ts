// jsdom has no CSS.escape (the app runs in browsers that do), so messageElement
// needs a stub here; the escape below only has to survive ids with no quotes.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    regionElement,
    messageElement,
    observeDom,
    styleElement,
} from "./pluginDom";
import type { Disposable, DomObserver } from "./types";

const tracked: Disposable[] = [];
const track = <T extends Disposable>(d: T): T => {
    tracked.push(d);
    return d;
};

/** Let the MutationObserver microtask run and the stubbed frame fire. */
const frame = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
    vi.stubGlobal("CSS", {
        escape: (s: string) => s.replace(/["\\]/g, "\\$&"),
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
        setTimeout(() => cb(0), 0),
    );
    document.body.innerHTML = "";
});

afterEach(() => {
    while (tracked.length) tracked.pop()?.dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
});

describe("regionElement", () => {
    it("finds a named region", () => {
        document.body.innerHTML = `<div data-zam-region="timeline" id="t"></div>`;
        expect(regionElement("timeline")?.id).toBe("t");
    });

    it("returns null for a region not on the page", () => {
        expect(regionElement("composer")).toBeNull();
    });

    it("returns null for a name that is not a known region", () => {
        document.body.innerHTML = `<div data-zam-region="nope"></div>`;
        expect(regionElement("nope" as never)).toBeNull();
    });
});

describe("messageElement", () => {
    it("finds a message row inside the timeline region", () => {
        document.body.innerHTML = `
            <div data-zam-region="timeline">
                <div data-event-id="$a" id="row"></div>
            </div>`;
        expect(messageElement("$a")?.id).toBe("row");
    });

    it("ignores a row with the same id outside the timeline", () => {
        document.body.innerHTML = `
            <div data-zam-region="room-list">
                <div data-event-id="$a"></div>
            </div>`;
        expect(messageElement("$a")).toBeNull();
    });

    it("returns null for an empty or unknown event id", () => {
        document.body.innerHTML = `<div data-zam-region="timeline"><div data-event-id="$a"></div></div>`;
        expect(messageElement("")).toBeNull();
        expect(messageElement("$missing")).toBeNull();
    });
});

describe("observeDom", () => {
    it("calls added immediately for matches already on the page", () => {
        document.body.innerHTML = `<p class="hit"></p><p class="hit"></p>`;
        const added = vi.fn();
        track(observeDom(".hit", { added }));
        expect(added).toHaveBeenCalledTimes(2);
    });

    it("calls added for a newly inserted node after a frame", async () => {
        const added = vi.fn();
        track(observeDom(".hit", { added }));
        const el = document.createElement("p");
        el.className = "hit";
        document.body.appendChild(el);
        expect(added).not.toHaveBeenCalled();
        await frame();
        expect(added).toHaveBeenCalledWith(el);
    });

    it("runs the cleanup when the matched node is removed", async () => {
        document.body.innerHTML = `<p class="hit"></p>`;
        const cleanup = vi.fn();
        track(observeDom(".hit", { added: () => cleanup }));
        document.querySelector(".hit")?.remove();
        await frame();
        expect(cleanup).toHaveBeenCalledOnce();
    });

    it("runs the cleanup on dispose and does not run it twice", async () => {
        document.body.innerHTML = `<p class="hit"></p>`;
        const cleanup = vi.fn();
        const d = observeDom(".hit", { added: () => cleanup });
        d.dispose();
        expect(cleanup).toHaveBeenCalledOnce();
        d.dispose();
        document.querySelector(".hit")?.remove();
        await frame();
        expect(cleanup).toHaveBeenCalledOnce();
    });

    it("stops calling added after dispose", async () => {
        const added = vi.fn();
        const d = observeDom(".hit", { added });
        d.dispose();
        const el = document.createElement("p");
        el.className = "hit";
        document.body.appendChild(el);
        await frame();
        expect(added).not.toHaveBeenCalled();
    });

    it("tolerates an added callback that throws", () => {
        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        document.body.innerHTML = `<p class="hit"></p>`;
        const observer: DomObserver = {
            added() {
                throw new Error("boom");
            },
        };
        track(observeDom(".hit", observer));
        expect(err).toHaveBeenCalled();
    });

    it("throws for an invalid selector", () => {
        expect(() => observeDom("[", { added: () => {} })).toThrow();
    });
});

describe("styleElement", () => {
    it("sets plain and custom properties", () => {
        const el = document.createElement("div");
        track(styleElement(el, { transform: "scale(2)", "--x": "10px" }));
        expect(el.style.transform).toBe("scale(2)");
        expect(el.style.getPropertyValue("--x")).toBe("10px");
    });

    it("restores the previous values on dispose", () => {
        const el = document.createElement("div");
        el.style.setProperty("color", "red");
        el.style.setProperty("--x", "1px");
        const d = styleElement(el, { color: "blue", "--x": "2px" });
        expect(el.style.color).toBe("blue");
        d.dispose();
        expect(el.style.color).toBe("red");
        expect(el.style.getPropertyValue("--x")).toBe("1px");
    });

    it("removes properties that were not set before", () => {
        const el = document.createElement("div");
        const d = styleElement(el, { "--x": "3px", "margin-top": "4px" });
        d.dispose();
        expect(el.style.getPropertyValue("--x")).toBe("");
        expect(el.style.marginTop).toBe("");
        expect(el.getAttribute("style") ?? "").toBe("");
    });

    it("restores an !important priority", () => {
        const el = document.createElement("div");
        el.style.setProperty("color", "red", "important");
        const d = styleElement(el, { color: "blue" });
        d.dispose();
        expect(el.style.getPropertyValue("color")).toBe("red");
        expect(el.style.getPropertyPriority("color")).toBe("important");
    });
});
