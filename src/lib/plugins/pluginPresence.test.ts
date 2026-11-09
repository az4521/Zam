import { describe, it, expect } from "vitest";
import { entryToPluginPresence, pluginPresenceToEntry } from "./pluginPresence";
import type { PluginPresence } from "./types";

describe("plugin presence entries", () => {
    it("turns an activity into an entry and back", () => {
        const p: PluginPresence = {
            kind: "activity",
            id: "a",
            name: "Chess",
            details: "Ranked",
            since: 1000,
            largeIconUrl: "mxc://srv/icon",
            largeIconTooltip: "Board",
            buttons: [{ label: "Watch", url: "https://example.com/" }],
        };
        const entry = pluginPresenceToEntry(p, 5000);
        expect(entry).toMatchObject({
            kind: "activity",
            id: "a",
            expiry: 5000,
            name: "Chess",
            details: "Ranked",
            largeIconUrl: "mxc://srv/icon",
            buttons: [
                {
                    label: "Watch",
                    url: "https://example.com/",
                    requestOpenid: false,
                },
            ],
        });
        expect(entryToPluginPresence(entry as never)).toEqual({
            ...p,
            expiry: 5000,
        });
    });

    it("keeps music fields and its progress", () => {
        const entry = pluginPresenceToEntry(
            {
                kind: "music",
                id: "m",
                track: "Song",
                playerName: "Player",
                coverUrl: "mxc://srv/c",
                progress: { since: 1, until: 2 },
                expiry: 9000,
            },
            5000,
        );
        expect(entry).toMatchObject({
            kind: "music",
            track: "Song",
            playerName: "Player",
            coverUrl: "mxc://srv/c",
            progress: { since: 1, until: 2 },
            expiry: 9000,
        });
    });

    it("drops what the MSC does not allow", () => {
        const entry = pluginPresenceToEntry(
            {
                kind: "activity",
                id: "a",
                name: "x",
                largeIconUrl: "https://not-mxc/icon.png",
                buttons: [{ label: "Bad", url: "javascript:alert(1)" }],
            },
            5000,
        );
        expect(entry).toMatchObject({ largeIconUrl: undefined, buttons: [] });
    });

    it("says why an entry was refused", () => {
        expect(
            pluginPresenceToEntry({ kind: "activity", id: "a" } as never, 5),
        ).toMatch(/name/);
        expect(
            pluginPresenceToEntry({ kind: "game", id: "a" } as never, 5),
        ).toMatch(/kind/);
        expect(
            pluginPresenceToEntry({ kind: "music", track: "t" } as never, 5),
        ).toMatch(/id/);
    });
});
