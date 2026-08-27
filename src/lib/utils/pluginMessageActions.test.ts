import { describe, it, expect, vi } from "vitest";
import {
    pluginMessageActions,
    collectDecorations,
    type PluginMessageActionView,
    type MessageDecoration,
} from "./pluginMessageActions";
import type { RegistryEntry } from "$lib/plugins/registry";
import type { MessageActionItem, MessageDecorator } from "$lib/plugins/types";

const actionEntry = (
    pluginId: string,
    entryId: number,
    value: MessageActionItem,
): RegistryEntry<MessageActionItem> => ({ pluginId, entryId, value });

const decoratorEntry = (
    pluginId: string,
    entryId: number,
    value: MessageDecorator,
): RegistryEntry<MessageDecorator> => ({ pluginId, entryId, value });

const ACTX = { roomId: "!r:s", eventId: "$e" };
const DCTX = { roomId: "!r:s", eventId: "$e", senderId: "@u:s" };

describe("pluginMessageActions", () => {
    it("includes an action with no `when` gate", () => {
        const onSelect = vi.fn();
        const views = pluginMessageActions(
            [actionEntry("p", 1, { id: "a", label: "A", onSelect })],
            ACTX,
        );
        expect(views).toHaveLength(1);
        expect(views[0].key).toBe("plugin:p:a");
        expect(views[0].label).toBe("A");
    });

    it("excludes an action whose `when` returns false, keeps one that returns true", () => {
        const views = pluginMessageActions(
            [
                actionEntry("p", 1, {
                    id: "hide",
                    label: "Hide",
                    when: () => false,
                    onSelect: vi.fn(),
                }),
                actionEntry("p", 2, {
                    id: "show",
                    label: "Show",
                    when: () => true,
                    onSelect: vi.fn(),
                }),
            ],
            ACTX,
        );
        expect(views.map((v) => v.label)).toEqual(["Show"]);
    });

    it("passes the message ctx to `when`", () => {
        const when = vi.fn(() => true);
        pluginMessageActions(
            [
                actionEntry("p", 1, {
                    id: "a",
                    label: "A",
                    when,
                    onSelect: vi.fn(),
                }),
            ],
            ACTX,
        );
        expect(when).toHaveBeenCalledWith(ACTX);
    });

    it("treats a throwing `when` as hidden (never propagates)", () => {
        const views = pluginMessageActions(
            [
                actionEntry("p", 1, {
                    id: "boom",
                    label: "Boom",
                    when: () => {
                        throw new Error("nope");
                    },
                    onSelect: vi.fn(),
                }),
            ],
            ACTX,
        );
        expect(views).toEqual([]);
    });

    it("run() calls onSelect with the ctx and returns its value", () => {
        const onSelect = vi.fn(() => Promise.resolve());
        const [view] = pluginMessageActions(
            [actionEntry("p", 1, { id: "a", label: "A", onSelect })],
            ACTX,
        );
        const r = view.run();
        expect(onSelect).toHaveBeenCalledWith(ACTX);
        expect(r).toBeInstanceOf(Promise);
    });

    it("preserves registry order and disambiguates the key by plugin id", () => {
        const views = pluginMessageActions(
            [
                actionEntry("p1", 1, {
                    id: "x",
                    label: "First",
                    onSelect: vi.fn(),
                }),
                actionEntry("p2", 2, {
                    id: "x",
                    label: "Second",
                    onSelect: vi.fn(),
                }),
            ],
            ACTX,
        );
        expect(views.map((v) => v.key)).toEqual(["plugin:p1:x", "plugin:p2:x"]);
        expect(views.map((v) => v.label)).toEqual(["First", "Second"]);
    });

    it("carries the icon through", () => {
        const [view] = pluginMessageActions(
            [
                actionEntry("p", 1, {
                    id: "a",
                    label: "A",
                    icon: "M0 0h1",
                    onSelect: vi.fn(),
                }),
            ],
            ACTX,
        );
        expect(view.icon).toBe("M0 0h1");
    });
});

describe("collectDecorations", () => {
    it("keeps a badge, carries pluginId and a per-entry key", () => {
        const out = collectDecorations(
            [decoratorEntry("p", 7, () => ({ badge: "★", tooltip: "tip" }))],
            DCTX,
        );
        expect(out).toEqual([
            { key: "plugin:p:7", pluginId: "p", badge: "★", tooltip: "tip" },
        ]);
    });

    it("skips a decorator returning null", () => {
        expect(
            collectDecorations([decoratorEntry("p", 1, () => null)], DCTX),
        ).toEqual([]);
    });

    it("skips a throwing decorator (never propagates)", () => {
        const out = collectDecorations(
            [
                decoratorEntry("p", 1, () => {
                    throw new Error("boom");
                }),
                decoratorEntry("p", 2, () => ({ badge: "ok" })),
            ],
            DCTX,
        );
        expect(out.map((d) => d.badge)).toEqual(["ok"]);
    });

    it("keeps a tooltip-only decoration", () => {
        const out = collectDecorations(
            [decoratorEntry("p", 3, () => ({ tooltip: "hi" }))],
            DCTX,
        );
        expect(out).toEqual([
            {
                key: "plugin:p:3",
                pluginId: "p",
                badge: undefined,
                tooltip: "hi",
            },
        ]);
    });

    it("skips a decoration whose badge and tooltip are both empty", () => {
        expect(
            collectDecorations(
                [decoratorEntry("p", 1, () => ({ badge: "", tooltip: "" }))],
                DCTX,
            ),
        ).toEqual([]);
    });

    it("passes the full ctx (incl. senderId) to the decorator", () => {
        const fn = vi.fn(() => ({ badge: "b" }));
        collectDecorations([decoratorEntry("p", 1, fn)], DCTX);
        expect(fn).toHaveBeenCalledWith(DCTX);
    });

    it("preserves order across multiple entries", () => {
        const out = collectDecorations(
            [
                decoratorEntry("a", 1, () => ({ badge: "1" })),
                decoratorEntry("b", 2, () => ({ badge: "2" })),
            ],
            DCTX,
        );
        expect(out.map((d) => d.badge)).toEqual(["1", "2"]);
    });
});
