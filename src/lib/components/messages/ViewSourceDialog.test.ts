import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import type { MatrixEvent } from "matrix-js-sdk";
import ViewSourceDialog from "./ViewSourceDialog.svelte";

// jsdom has no Web Animations API, and ModalDialog's fade/scale intro calls
// `element.animate`. An inert stand-in lets the intro sit pending, which is all
// these tests need (they check content, not motion).
if (!Element.prototype.animate) {
    Element.prototype.animate = (() => ({
        cancel() {},
        onfinish: null,
    })) as unknown as Element["animate"];
}

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

const WIRE = {
    type: "m.room.encrypted",
    sender: "@a:example.org",
    event_id: "$e1",
    content: { algorithm: "m.megolm.v1.aes-sha2", ciphertext: "xyz" },
};
const CLEAR = {
    ...WIRE,
    type: "m.room.message",
    content: { msgtype: "m.text", body: "<img src=x onerror=alert(1)>" },
};

function render(encrypted: boolean) {
    const event = {
        isEncrypted: () => encrypted,
        getEffectiveEvent: () => (encrypted ? CLEAR : WIRE),
        event: WIRE,
    } as unknown as MatrixEvent;
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(ViewSourceDialog, { target: host, props: { event } });
    flushSync();
}

// The dialog renders through Portal, so query the whole document.
const blocks = () => [...document.querySelectorAll("pre")];

afterEach(() => {
    if (instance) unmount(instance);
    host?.remove();
    instance = null;
    host = null;
});

describe("ViewSourceDialog", () => {
    it("pretty-prints the clear event with two-space indent", () => {
        render(false);
        expect(blocks()).toHaveLength(1);
        expect(blocks()[0].textContent).toBe(JSON.stringify(WIRE, null, 2));
    });

    it("adds the wire event block only for encrypted events", () => {
        render(true);
        expect(blocks()).toHaveLength(2);
        expect(blocks()[0].textContent).toBe(JSON.stringify(CLEAR, null, 2));
        expect(blocks()[1].textContent).toBe(JSON.stringify(WIRE, null, 2));
    });

    it("renders event content as text, never as markup", () => {
        render(true);
        expect(document.querySelector("img[src='x']")).toBeNull();
        expect(blocks()[0].textContent).toContain("<img src=x");
    });

    it("is labelled by its title", () => {
        render(false);
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog?.getAttribute("aria-labelledby")).toBe(
            "view-source-title",
        );
    });
});
