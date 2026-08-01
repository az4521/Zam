import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from "vitest";
import { flushSync, mount, unmount, type ComponentProps } from "svelte";
import ModalDialogFixture from "./ModalDialog.fixture.svelte";

let target: HTMLDivElement;
let app: Record<string, unknown> | null = null;

/** The trap defers its initial focus to the next animation frame. */
function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

// Typed off the fixture rather than `Record<string, unknown>`: `mount()` checks
// its `props` against the component's own prop type, so an untyped bag drops
// the required `onClose` and fails `npm run check`.
type FixtureProps = ComponentProps<typeof ModalDialogFixture>;

function render(props: FixtureProps) {
    app = mount(ModalDialogFixture, { target, props });
    flushSync();
}

const panel = () => target.querySelector<HTMLElement>('[role="dialog"]');

// jsdom has no layout engine and hard-codes `offsetParent` to null, so
// `focusTrap`'s visibility filter would reject every control in the panel and
// the trap would focus the panel itself instead of a field. Report attached
// elements as laid out; the action's filter is left alone because in a real
// browser it is what stops a display:none control taking focus.
const realOffsetParent = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetParent",
);

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", {
        configurable: true,
        get(this: HTMLElement) {
            return this.parentElement;
        },
    });
});

afterAll(() => {
    if (realOffsetParent) {
        Object.defineProperty(
            HTMLElement.prototype,
            "offsetParent",
            realOffsetParent,
        );
    }
});

beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
});

afterEach(() => {
    if (app) unmount(app);
    app = null;
    target.remove();
});

describe("ModalDialog semantics", () => {
    it("marks the panel as a modal dialog", () => {
        render({ onClose: vi.fn() });
        expect(panel()).not.toBeNull();
        expect(panel()?.getAttribute("aria-modal")).toBe("true");
    });

    it("names the dialog from its visible title", () => {
        render({ onClose: vi.fn(), labelledBy: "fixture-title" });
        expect(panel()?.getAttribute("aria-labelledby")).toBe("fixture-title");
        expect(
            target.querySelector("#fixture-title")?.textContent?.trim(),
        ).toBe("Fixture dialog");
    });

    it("names the dialog directly when there is no visible title", () => {
        render({ onClose: vi.fn(), label: "Accounts" });
        expect(panel()?.getAttribute("aria-label")).toBe("Accounts");
        expect(panel()?.hasAttribute("aria-labelledby")).toBe(false);
    });

    it("offers the backdrop as a labelled close control that is not an ancestor of the panel", () => {
        const onClose = vi.fn();
        render({ onClose });
        const backdrop = target.querySelector<HTMLButtonElement>(
            'button[aria-label="Close dialog"]',
        );
        expect(backdrop).not.toBeNull();
        // A <button> may not contain interactive content, and a nested panel
        // would need stopPropagation to survive an outside-click handler.
        expect(backdrop?.contains(panel()!)).toBe(false);
        backdrop!.click();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    // `aria-modal="true"` is a promise that everything behind this dialog is
    // out of reach, and the only thing making that promise true is the layer
    // covering the viewport and the backdrop covering the layer. Callers
    // append to `layerClass`/`backdropClass` but cannot restore coverage if
    // the shell drops it — and six adopters inherit this rather than restating
    // it, so a regression here would be silently wrong in six places at once.
    it("covers the viewport, which is what makes aria-modal honest", () => {
        render({ onClose: vi.fn() });
        const layer = panel()!.parentElement!;
        expect([...layer.classList]).toEqual(
            expect.arrayContaining(["fixed", "inset-0"]),
        );

        const backdrop = target.querySelector<HTMLButtonElement>(
            'button[aria-label="Close dialog"]',
        )!;
        expect(backdrop.parentElement).toBe(layer);
        expect([...backdrop.classList]).toEqual(
            expect.arrayContaining(["absolute", "inset-0"]),
        );
    });

    // Regression guard for a LATENT trap, not a live bug: every current adopter
    // passes a position utility (`relative`, or `absolute` in AccountSwitcher),
    // so nothing today exercises this path. `z-index` is inert on
    // `position: static`, so a caller passing a sizing-only `panelClass` — and
    // the `relative` fallback only applies when the prop is OMITTED — would get
    // a panel painting under the `absolute inset-0` backdrop, which then eats
    // every click on it while the dialog looks perfectly normal.
    //
    // The `isolate` half is the other side of the same coin, and the reason it
    // is asserted HERE rather than with the coverage checks: `-z-10` is only
    // safe while the layer forms a stacking context, and `fixed` alone does not
    // — a caller passing a position-only `layerClass` ("flex items-end") gets a
    // z-auto layer the negative-z backdrop escapes, painting behind the app.
    // The overlay then vanishes and an outside click stops dismissing. So the
    // pair is pinned together; dropping either one re-arms a silent trap.
    //
    // WHAT THIS CANNOT PROVE: jsdom has no layout or paint engine, so nothing
    // here can observe stacking order, a stacking context, or a swallowed
    // click. These are class-name assertions standing in for the CSS behaviour
    // — a proxy, not proof. That `-z-10` and `isolate` reach the built
    // stylesheet at all is proved by grepping `npm run build`'s CSS, not here.
    it("sinks the backdrop below the panel without letting it escape the layer", () => {
        render({
            onClose: vi.fn(),
            panelClass: "w-80 rounded bg-white",
            layerClass: "flex items-end",
        });
        const backdrop = target.querySelector<HTMLButtonElement>(
            'button[aria-label="Close dialog"]',
        );
        expect(
            backdrop,
            "the dialog no longer renders a backdrop button",
        ).not.toBeNull();
        expect(
            [...backdrop!.classList],
            "the backdrop lost its negative z-index — a panel without a position utility will now paint underneath it and swallow every click",
        ).toContain("-z-10");
        // Asserted on the layer the backdrop actually lives in, so it cannot
        // pass off some other element's `isolate`.
        expect(
            [...backdrop!.parentElement!.classList],
            "the dialog layer lost `isolate` — with a layerClass that carries no z-index it forms no stacking context, so the -z-10 backdrop escapes and paints behind the app",
        ).toContain("isolate");
    });

    // The panel's position utility belongs to the caller. `relative` and
    // `absolute` are the same Tailwind group, so a utility baked into the
    // shell would win or lose against a caller's override on CSS source order
    // rather than attribute order — silently mispositioning any dialog that
    // anchors its panel. The shell contributes stacking (`z-10`) only.
    it("bakes no position utility into the panel class", () => {
        render({ onClose: vi.fn(), panelClass: "absolute bottom-0" });
        const classes = panel()!.className.split(/\s+/);
        expect(classes).toContain("absolute");
        expect(classes).not.toContain("relative");
        expect(classes).not.toContain("fixed");
        expect(classes).not.toContain("sticky");
    });
});

describe("ModalDialog focus behaviour", () => {
    it("moves focus into the dialog on open", async () => {
        render({ onClose: vi.fn() });
        await nextFrame();
        expect(panel()?.contains(document.activeElement)).toBe(true);
    });

    it("honours a nominated initial-focus field", async () => {
        render({ onClose: vi.fn(), nominate: true });
        await nextFrame();
        expect((document.activeElement as HTMLElement)?.id).toBe(
            "fixture-search",
        );
    });

    it("returns focus to the opener when the dialog closes", async () => {
        const opener = document.createElement("button");
        document.body.appendChild(opener);
        opener.focus();
        expect(document.activeElement).toBe(opener);

        render({ onClose: vi.fn() });
        await nextFrame();
        expect(document.activeElement).not.toBe(opener);

        unmount(app!);
        app = null;
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it("closes on Escape and does not let the same keypress reach the app", async () => {
        const onClose = vi.fn();
        const outer = vi.fn();
        target.addEventListener("keydown", outer);
        render({ onClose });
        await nextFrame();

        panel()!.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "Escape",
                bubbles: true,
                cancelable: true,
            }),
        );

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(outer).not.toHaveBeenCalled();
    });

    it("leaves Escape to the app when the dialog says it does not handle it", async () => {
        const onClose = vi.fn();
        const outer = vi.fn();
        target.addEventListener("keydown", outer);
        render({ onClose, handlesEscape: false });
        await nextFrame();

        panel()!.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );

        expect(onClose).not.toHaveBeenCalled();
        expect(outer).toHaveBeenCalledTimes(1);
    });

    it("forwards other keys to the caller's handler", async () => {
        const onKeydown = vi.fn();
        render({ onClose: vi.fn(), onKeydown });
        await nextFrame();
        panel()!.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(onKeydown).toHaveBeenCalledTimes(1);
    });
});
