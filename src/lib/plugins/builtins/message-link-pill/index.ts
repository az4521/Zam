// Built-in "message link pill" plugin, contributed by a community author
// (originally org.zam.community.message-link-pill 1.1.0; the id is kept so an
// installed copy of the community plugin is superseded by this one). Swaps a
// raw matrix.to message link in the timeline for a compact pill naming where
// the message is: "#room" for a room, the other person's avatar and name for
// a DM. Only the anchor's visible content changes; the href, click handling
// and preview card stay core. Written against the `zam` host API only.
import { t } from "$lib/i18n";
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable, ZamPluginApi } from "../../types";
import { installMessageLinkPills } from "./pills";
import { directRoomMap, resolvePillLabel, type PillLookups } from "./label";
import { MESSAGE_LINK_PILL_CSS } from "./styles";

export const manifest: Manifest = {
    id: "org.zam.community.message-link-pill",
    name: t("messageLinkPill.name"),
    version: "1.2.0",
    description: t("messageLinkPill.description"),
    author: "Zam community",
    entry: "builtin",
    capabilities: ["ui", "rooms:read"],
};

/** Lookups over zam.matrix, cached until the next room update. */
function createLookups(zam: ZamPluginApi): PillLookups & { reset(): void } {
    let direct: Map<string, string> | null = null;
    let aliases: Map<string, string> | null = null;

    const aliasMap = () => {
        if (aliases) return aliases;
        aliases = new Map();
        for (const room of zam.matrix.getRooms()) {
            const c = zam.matrix.getState(
                room.roomId,
                "m.room.canonical_alias",
            );
            const all = [
                c?.alias,
                ...(Array.isArray(c?.alt_aliases) ? c.alt_aliases : []),
            ];
            for (const a of all)
                if (typeof a === "string") aliases.set(a, room.roomId);
        }
        return aliases;
    };

    return {
        reset() {
            direct = null;
            aliases = null;
        },
        roomIdForAlias: (alias) => aliasMap().get(alias) ?? null,
        room(roomId) {
            const s = zam.matrix.getRoomSummary(roomId);
            if (!s || s.isSpace) return null;
            return { name: s.name, avatarUrl: s.avatarUrl };
        },
        dmUserId(roomId) {
            direct ??= directRoomMap(zam.matrix.getAccountData("m.direct"));
            return direct.get(roomId) ?? null;
        },
        memberAvatar(roomId, userId) {
            const m = zam.matrix
                .getMembers(roomId)
                .find((x) => x.userId === userId);
            return m?.avatarUrl ?? null;
        },
    };
}

let pills: ReturnType<typeof installMessageLinkPills> | null = null;
let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        const lookups = createLookups(zam);
        disposables.push(zam.ui.addStyles(MESSAGE_LINK_PILL_CSS));
        pills = installMessageLinkPills(
            zam,
            (roomOrAlias) => resolvePillLabel(roomOrAlias, lookups),
            {
                viewMessage: t("messageLinkPill.viewMessage"),
                aria: t("messageLinkPill.viewQuotedMessage"),
                ariaIn: (room) => t("messageLinkPill.viewMessageIn", { room }),
            },
        );
        // Names, DM state and avatars arrive and change with sync.
        disposables.push(
            zam.events.on("room-update", () => {
                lookups.reset();
                pills?.refresh();
            }),
        );
    },
    onunload() {
        pills?.dispose();
        pills = null;
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
