import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import Fixture from "./Portal.fixture.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function render() {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(Fixture, { target: host });
    flushSync();
}

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    flushSync();
});

describe("Portal", () => {
    it("moves its children out to document.body", () => {
        render();
        const portaled = document.querySelector('[data-testid="portaled"]');
        expect(portaled, "the portaled content never rendered").not.toBeNull();
        const origin = document.querySelector('[data-testid="origin"]');
        expect(
            origin?.contains(portaled!),
            "the portaled content is still inside its origin parent — a `fixed` layer there would resolve against the drawer's transform, which is the whole bug",
        ).toBe(false);
    });

    it("parents the portal wrapper directly to document.body", () => {
        render();
        const portaled = document.querySelector('[data-testid="portaled"]');
        expect(portaled!.parentElement!.parentElement).toBe(document.body);
    });

    it("removes the portaled content when the component is destroyed", () => {
        render();
        unmount(instance!);
        instance = null;
        flushSync();
        expect(
            document.querySelector('[data-testid="portaled"]'),
            "portaled content outlived its component — it would stack up on every remount",
        ).toBeNull();
    });
});
