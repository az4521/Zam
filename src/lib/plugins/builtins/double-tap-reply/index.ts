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
import { t } from "$lib/i18n";
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";
import { resolveDoubleTapAction, isActive } from "./resolve";
import { resolveSwipeAction as resolveSwipe } from "./swipeResolve";

export const manifest: Manifest = {
    id: "zam.double-tap-reply",
    name: t("doubleTapReply.doubleTapSwipeActions"),
    version: "1.0.0",
    description: t("doubleTapReply.doubleTapAMessageToReply"),
    author: "Zam",
    entry: "builtin",
    capabilities: ["composer", "messages:read", "messages:send"],
    settings: [
        {
            key: "ownAction",
            type: "select",
            label: t("doubleTapReply.doubleTapYourMessages"),
            default: "edit",
            options: [
                { value: "none", label: t("doubleTapReply.nothing") },
                { value: "reaction", label: t("doubleTapReply.reaction") },
                { value: "reply", label: t("doubleTapReply.reply") },
                { value: "edit", label: t("doubleTapReply.edit") },
            ],
        },
        {
            key: "otherAction",
            type: "select",
            label: t("doubleTapReply.doubleTapOtherMessages"),
            default: "reaction",
            options: [
                { value: "none", label: t("doubleTapReply.nothing") },
                { value: "reaction", label: t("doubleTapReply.reaction") },
                { value: "reply", label: t("doubleTapReply.reply") },
            ],
        },
        {
            key: "reaction",
            type: "text",
            label: t("doubleTapReply.reactionEmoji"),
            default: "👍",
            description: t("doubleTapReply.sentWhenADoubleTapAction"),
        },
        {
            key: "swipeEnabled",
            type: "toggle",
            label: t("doubleTapReply.swipeToReplyEdit"),
            default: true,
            description: t("doubleTapReply.swipeAMessageLeftToReply"),
        },
    ],
};

let disposables: Disposable[] = [];
let handlerDisposable: Disposable | null = null;
let swipeHandlerDisposable: Disposable | null = null;

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
                const key = zam.settings.get<string>("reaction", "👍") || "👍";
                zam.matrix.react(ctx.roomId, ctx.eventId, key).catch((err) => {
                    console.error("[zam.double-tap-reply] react failed", err);
                    zam.ui.notify({ body: t("doubleTapReply.failedToReact") });
                });
            }
        };

        const handleSwipe = (ctx: {
            roomId: string;
            eventId: string;
            isOwn: boolean;
            canEdit?: boolean;
            threshold: "short" | "far";
        }) => {
            const action = resolveSwipe(
                ctx.threshold,
                ctx.canEdit ?? ctx.isOwn,
                zam.settings.get<boolean>("swipeEnabled", true),
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

            const swipeEnabled = zam.settings.get<boolean>(
                "swipeEnabled",
                true,
            );
            if (swipeEnabled && !swipeHandlerDisposable) {
                swipeHandlerDisposable = zam.messages.onSwipe(handleSwipe);
            } else if (!swipeEnabled && swipeHandlerDisposable) {
                swipeHandlerDisposable.dispose();
                swipeHandlerDisposable = null;
            }
        };

        sync();
        disposables.push(zam.settings.onChange(sync));
    },
    onunload() {
        handlerDisposable?.dispose();
        handlerDisposable = null;
        swipeHandlerDisposable?.dispose();
        swipeHandlerDisposable = null;
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
