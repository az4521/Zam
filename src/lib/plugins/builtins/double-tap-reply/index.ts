// Built-in double-tap-to-reply plugin (item 16 migration). Consumes the core
// double-tap gesture (zam.messages.onDoubleTap; detection stays core in
// MessageItem) and runs the user's configured action: reply, react, or edit.
// Interop-safe — the reply/reaction/edit it triggers are standard events
// rendered by core. Written against the `zam` host API only — no client.ts.
//
// The onDoubleTap handler is registered ONLY while an action is configured
// (own or other != "none"), re-evaluated on settings change. This preserves
// the desktop native word-select at the default (none/none): with no handler
// registered, MessageItem's dblclick guard leaves word-select alone — exact
// parity with the old core behavior.
//
// Migrated from core settings ownDoubleTapAction/otherDoubleTapAction/
// doubleTapReaction. Per-space reaction overrides (doubleTapReactionBySpace)
// are intentionally NOT migrated (v1) — see the plan's Decisions.
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";
import { resolveDoubleTapAction, isActive } from "./resolve";

export const manifest: Manifest = {
    id: "zam.double-tap-reply",
    name: "Double-tap to reply",
    version: "1.0.0",
    description:
        "Double-tap (or double-click) a message to reply, react, or edit.",
    author: "Zam",
    entry: "builtin",
    capabilities: ["composer", "messages:read", "messages:send"],
    settings: [
        {
            key: "ownAction",
            type: "select",
            label: "Double-tap your messages",
            default: "none",
            options: [
                { value: "none", label: "Nothing" },
                { value: "reaction", label: "Reaction" },
                { value: "reply", label: "Reply" },
                { value: "edit", label: "Edit" },
            ],
        },
        {
            key: "otherAction",
            type: "select",
            label: "Double-tap other messages",
            default: "none",
            options: [
                { value: "none", label: "Nothing" },
                { value: "reaction", label: "Reaction" },
                { value: "reply", label: "Reply" },
            ],
        },
        {
            key: "reaction",
            type: "text",
            label: "Reaction emoji",
            default: "👍",
            description: "Sent when a double-tap action is set to Reaction.",
        },
    ],
};

let disposables: Disposable[] = [];
let handlerDisposable: Disposable | null = null;

export const plugin: PluginModule = {
    onload(zam) {
        zam.settings.define(manifest.settings!);

        const handleDoubleTap = (ctx: {
            roomId: string;
            eventId: string;
            isOwn: boolean;
        }) => {
            const action = resolveDoubleTapAction(
                ctx.isOwn,
                zam.settings.get<string>("ownAction", "none"),
                zam.settings.get<string>("otherAction", "none"),
            );
            if (action === "reply") {
                zam.composer.startReply({
                    roomId: ctx.roomId,
                    eventId: ctx.eventId,
                });
            } else if (action === "edit") {
                zam.composer.startEdit({
                    roomId: ctx.roomId,
                    eventId: ctx.eventId,
                });
            } else if (action === "reaction") {
                void zam.matrix.react(
                    ctx.roomId,
                    ctx.eventId,
                    zam.settings.get<string>("reaction", "👍"),
                );
            }
        };

        // Register the gesture handler only while an action is configured, so
        // the desktop word-select is preserved at none/none.
        const sync = () => {
            const active = isActive(
                zam.settings.get<string>("ownAction", "none"),
                zam.settings.get<string>("otherAction", "none"),
            );
            if (active && !handlerDisposable) {
                handlerDisposable = zam.messages.onDoubleTap(handleDoubleTap);
            } else if (!active && handlerDisposable) {
                handlerDisposable.dispose();
                handlerDisposable = null;
            }
        };

        sync();
        disposables.push(zam.settings.onChange(sync));
    },
    onunload() {
        handlerDisposable?.dispose();
        handlerDisposable = null;
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
