import { describe, it, expect, vi } from "vitest";
import {
    pluginActionToMenuItem,
    mergeComposerActions,
    pluginButtonToView,
    pluginComposerButtons,
    pluginContribKey,
} from "./pluginComposer";
import type { RegistryEntry } from "$lib/plugins/registry";
import type { ComposerAction, ComposerButton } from "$lib/plugins/types";

function actionEntry(
    pluginId: string,
    a: ComposerAction,
): RegistryEntry<ComposerAction> {
    return { pluginId, entryId: 1, value: a };
}

describe("pluginContribKey", () => {
    it("namespaces by plugin id + contribution id", () => {
        expect(pluginContribKey("zam.sample", "b1")).toBe(
            "plugin:zam.sample:b1",
        );
    });
});

describe("pluginActionToMenuItem", () => {
    it("carries label/icon and a namespaced key", () => {
        const onSelect = vi.fn();
        const item = pluginActionToMenuItem(
            { id: "act", label: "Do it", icon: "M1 1", onSelect },
            "p.one",
            "!r:s",
        );
        expect(item.key).toBe("plugin:p.one:act");
        expect(item.label).toBe("Do it");
        expect(item.icon).toBe("M1 1");
    });

    it("run() invokes onSelect with the current roomId", () => {
        const onSelect = vi.fn();
        const item = pluginActionToMenuItem(
            { id: "act", label: "L", onSelect },
            "p",
            "!room:server",
        );
        item.run();
        expect(onSelect).toHaveBeenCalledWith({ roomId: "!room:server" });
    });
});

describe("mergeComposerActions", () => {
    it("appends plugin actions after core, preserving entry order", () => {
        const core = [{ key: "upload" }, { key: "poll" }];
        const entries = [
            actionEntry("p1", { id: "a", label: "A", onSelect: () => {} }),
            actionEntry("p2", { id: "b", label: "B", onSelect: () => {} }),
        ];
        const merged = mergeComposerActions(core, entries, "!r:s");
        expect(merged.map((m) => (m as { key: string }).key)).toEqual([
            "upload",
            "poll",
            "plugin:p1:a",
            "plugin:p2:b",
        ]);
    });

    it("returns only core when there are no plugin entries", () => {
        const core = [{ key: "upload" }];
        expect(mergeComposerActions(core, [], "!r:s")).toEqual(core);
    });
});

describe("pluginButtonToView / pluginComposerButtons", () => {
    it("onClick forwards roomId + anchor", () => {
        const onClick = vi.fn();
        const view = pluginButtonToView(
            { id: "b1", label: "Btn", onClick },
            "p",
            "!r:s",
        );
        expect(view.key).toBe("plugin:p:b1");
        const anchor = { tagName: "BUTTON" } as unknown as HTMLElement;
        view.onClick(anchor);
        expect(onClick).toHaveBeenCalledWith({ roomId: "!r:s", anchor });
    });

    it("maps every registry entry to a view", () => {
        const entries: RegistryEntry<ComposerButton>[] = [
            {
                pluginId: "p1",
                entryId: 1,
                value: { id: "x", label: "X", onClick: () => {} },
            },
            {
                pluginId: "p2",
                entryId: 2,
                value: { id: "y", label: "Y", icon: "M2", onClick: () => {} },
            },
        ];
        const views = pluginComposerButtons(entries, "!r:s");
        expect(views.map((v) => v.key)).toEqual(["plugin:p1:x", "plugin:p2:y"]);
        expect(views[1].icon).toBe("M2");
    });
});
