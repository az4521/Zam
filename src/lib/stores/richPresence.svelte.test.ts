import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const setOwnProfileField = vi.fn(async (..._a: unknown[]) => {});
const uploadContent = vi.fn(async (..._a: unknown[]) => "mxc://srv/uploaded");
vi.mock("$lib/matrix/client", () => ({ setOwnProfileField, uploadContent }));
vi.mock("$lib/stores/profileFields.svelte", () => ({
    requestProfile: vi.fn(),
}));

let handler: ((ev: DesktopRichPresenceEvent) => void) | null = null;
const configure = vi.fn(async (want: { local: boolean; arrpc: boolean }) => ({
    msc4544: { listening: want.local, port: 44190, error: null },
    arrpc: { running: want.arrpc, error: null },
}));
const image = vi.fn(async (..._a: unknown[]) => ({
    type: "image/png",
    data: new Uint8Array([1, 2, 3]),
}));
const setSteamDebugging = vi.fn(
    async (
        _on: boolean,
    ): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> => ({
        ok: true,
    }),
);
const statusFn = vi.fn(async () => ({ steam: { enabled: true } }));

async function load() {
    vi.resetModules();
    const settings = await import("$lib/stores/settings.svelte");
    const rp = await import("./richPresence.svelte");
    return { settings, rp };
}

const ev = (
    over: Partial<DesktopRichPresenceEvent> = {},
): DesktopRichPresenceEvent => ({
    source: "msc4544",
    app: { id: "app1", name: "Tester" },
    presenceId: "p1",
    presence: {
        id: "p1",
        type: "m.rpc.activity",
        name: "Game",
        expiry: Date.now() + 60_000,
    },
    ...over,
});

beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setOwnProfileField.mockClear();
    configure.mockClear();
    image.mockClear();
    uploadContent.mockClear();
    setSteamDebugging.mockReset();
    setSteamDebugging.mockImplementation(async () => ({ ok: true }));
    statusFn.mockClear();
    handler = null;
    (window as unknown as { desktop: unknown }).desktop = {
        richPresence: {
            configure,
            image,
            setSteamDebugging,
            status: statusFn,
            onEvent: (cb: typeof handler) => {
                handler = cb;
                return () => {
                    handler = null;
                };
            },
        },
    };
});

afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { desktop?: unknown }).desktop;
});

describe("rich presence store", () => {
    it("is off by default and listens for nothing", async () => {
        const { settings, rp } = await load();
        expect(settings.settingsState.richPresenceEnabled).toBe(false);
        expect(settings.settingsState.richPresenceArrpc).toBe(false);
        await rp.syncRichPresence();
        expect(configure).toHaveBeenCalledWith(
            expect.objectContaining({ local: false, arrpc: false }),
        );
        expect(handler).toBeNull();
    });

    it("arRPC needs sharing on as well", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceArrpc(true);
        await rp.syncRichPresence();
        expect(configure).toHaveBeenLastCalledWith(
            expect.objectContaining({ local: false, arrpc: false }),
        );
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        expect(configure).toHaveBeenLastCalledWith(
            expect.objectContaining({ local: true, arrpc: true }),
        );
    });

    it("allows a new app by default and publishes it", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();

        handler!(ev());
        await vi.advanceTimersByTimeAsync(2000);
        const key = "msc4544:app1";
        expect(rp.richPresenceState.apps[key]).toMatchObject({
            name: "Tester",
            allowed: true,
        });
        expect(setOwnProfileField).toHaveBeenCalledTimes(1);
        const [field, value] = setOwnProfileField.mock.calls[0] as [
            string,
            Array<{ type: string; name: string }>,
        ];
        expect(field).toBe("xyz.extera.msc4544.rpc");
        expect(value).toHaveLength(1);
        expect(value[0]).toMatchObject({
            type: "xyz.extera.msc4544.rpc.activity",
            name: "Game",
        });
    });

    it("deletes the field when the last presence goes", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(ev());
        rp.setAppAllowed("msc4544:app1", true);
        handler!(ev());
        await vi.advanceTimersByTimeAsync(2000);

        handler!(ev({ presence: null }));
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenLastCalledWith(
            "xyz.extera.msc4544.rpc",
            null,
        );
    });

    it("blocking an app takes its presence off the profile", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(ev());
        rp.setAppAllowed("msc4544:app1", true);
        handler!(ev());
        await vi.advanceTimersByTimeAsync(2000);

        rp.setAppAllowed("msc4544:app1", false);
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenLastCalledWith(
            "xyz.extera.msc4544.rpc",
            null,
        );
    });

    it("turning sharing off clears what was published", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(ev());
        rp.setAppAllowed("msc4544:app1", true);
        handler!(ev());
        await vi.advanceTimersByTimeAsync(2000);

        settings.setRichPresenceEnabled(false);
        await rp.syncRichPresence();
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenLastCalledWith(
            "xyz.extera.msc4544.rpc",
            null,
        );
    });

    it("never writes anything for an app seen while disabled", async () => {
        const { rp } = await load();
        await rp.syncRichPresence();
        expect(handler).toBeNull();
        await vi.advanceTimersByTimeAsync(5000);
        expect(setOwnProfileField).not.toHaveBeenCalled();
    });

    it("passes the scan setting and the user id to the main process", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        settings.setRichPresenceScan(true);
        await rp.syncRichPresence();
        expect(configure).toHaveBeenLastCalledWith(
            expect.objectContaining({ local: true, scan: true }),
        );
        settings.setRichPresenceEnabled(false);
        await rp.syncRichPresence();
        expect(configure).toHaveBeenLastCalledWith(
            expect.objectContaining({ local: false, scan: false }),
        );
    });

    const game = (extra: Record<string, unknown> = {}) =>
        ev({
            source: "arrpc",
            app: { id: "123", name: "Some Game" },
            presenceId: "scan-123",
            presence: {
                application_id: "123",
                name: "Some Game",
                assets: { large_image: "icon:abcdef1234", large_text: "Big" },
                ...extra,
            },
        });

    it("uploads a game's picture once and puts it on the profile", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(game());
        rp.setAppAllowed("arrpc:123", true);
        handler!(game());
        await vi.advanceTimersByTimeAsync(2000);

        expect(image).toHaveBeenCalledTimes(1);
        expect(image).toHaveBeenCalledWith("123", "icon:abcdef1234");
        expect(uploadContent).toHaveBeenCalledTimes(1);
        const last = setOwnProfileField.mock.calls.at(-1) as [
            string,
            Array<Record<string, unknown>>,
        ];
        expect(last[1][0]).toMatchObject({
            name: "Some Game",
            large_icon_url: "mxc://srv/uploaded",
            large_icon_tooltip: "Big",
        });

        // A different play of the same game reuses the upload.
        handler!(game({ details: "level 2" }));
        await vi.advanceTimersByTimeAsync(2000);
        expect(uploadContent).toHaveBeenCalledTimes(1);
        const again = setOwnProfileField.mock.calls.at(-1) as [
            string,
            Array<Record<string, unknown>>,
        ];
        expect(again[1][0]).toMatchObject({
            details: "level 2",
            large_icon_url: "mxc://srv/uploaded",
        });
    });

    it("publishes the game without a picture if the picture cannot be fetched", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(game());
        rp.setAppAllowed("arrpc:123", true);
        image.mockResolvedValueOnce(null as never);
        handler!(game());
        await vi.advanceTimersByTimeAsync(2000);
        const last = setOwnProfileField.mock.calls.at(-1) as [
            string,
            Array<Record<string, unknown>>,
        ];
        expect(last[1][0].name).toBe("Some Game");
        expect(last[1][0].large_icon_url).toBeUndefined();
    });

    it("does not write again when the scanner repeats itself", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(game());
        rp.setAppAllowed("arrpc:123", true);
        handler!(game());
        await vi.advanceTimersByTimeAsync(2000);
        const writes = setOwnProfileField.mock.calls.length;
        for (let i = 0; i < 4; i++) {
            handler!(game());
            await vi.advanceTimersByTimeAsync(2000);
        }
        expect(setOwnProfileField.mock.calls.length).toBe(writes);
    });

    it("allows a game the scanner found by default", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(game());
        expect(rp.richPresenceState.apps["arrpc:123"].allowed).toBe(true);
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenCalled();
    });

    it("prefers an app's own report over the scanner, even under another id", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(game());
        await vi.advanceTimersByTimeAsync(2000);
        expect(rp.richPresenceState.heldCount).toBe(1);

        const own = game();
        handler!({
            ...own,
            app: { ...own.app, id: "999" },
            presenceId: "rpc-socket-1",
        });
        expect(rp.richPresenceState.heldCount).toBe(1);

        // The scanner repeating itself does not bring its copy back.
        handler!(game({ state: "x" }));
        expect(rp.richPresenceState.heldCount).toBe(1);
    });

    it("records how a game was found", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(game());
        expect(rp.richPresenceState.apps["arrpc:123"]).toMatchObject({
            viaScan: true,
            viaRpc: false,
        });
        handler!({ ...game(), presenceId: "rpc-socket-1" });
        expect(rp.richPresenceState.apps["arrpc:123"]).toMatchObject({
            viaScan: true,
            viaRpc: true,
        });
    });

    it("publishes at once when a blocked app is allowed", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(ev());
        rp.setAppAllowed("msc4544:app1", false);
        await vi.advanceTimersByTimeAsync(2000);
        setOwnProfileField.mockClear();
        handler!(ev());
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).not.toHaveBeenCalled();

        // No second event from the app: allowing alone is enough.
        rp.setAppAllowed("msc4544:app1", true);
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenCalledTimes(1);
    });

    it("does not replay what a removed app was doing", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(ev());
        handler!(ev({ presence: null }));
        rp.setAppAllowed("msc4544:app1", true);
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).not.toHaveBeenCalled();
    });

    it("ignores a removal for an app it has never seen", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        await rp.syncRichPresence();
        handler!(ev({ presence: null }));
        expect(Object.keys(rp.richPresenceState.apps)).toEqual([]);
    });

    const media = (over: Partial<DesktopRichPresenceEvent> = {}) =>
        ev({
            source: "arrpc",
            app: { id: "media-spotify", name: "Spotify" },
            presenceId: "media-spotify",
            presence: {
                type: 2,
                name: "Spotify",
                details: "Song",
                state: "by Artist",
            },
            ...over,
        });

    it("reports a media player as music once it is switched on", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        settings.setRichPresenceMedia(true);
        await rp.syncRichPresence();
        handler!(media());
        await vi.advanceTimersByTimeAsync(2000);

        expect(rp.richPresenceState.apps["arrpc:media-spotify"]).toMatchObject({
            name: "Spotify",
            allowed: true,
            viaMedia: true,
            viaRpc: false,
            viaScan: false,
        });
        const last = setOwnProfileField.mock.calls.at(-1) as [
            string,
            Array<Record<string, unknown>>,
        ];
        expect(last[1][0]).toMatchObject({
            type: "xyz.extera.msc4544.rpc.music",
            track: "Song",
            artist: "Artist",
            player_name: "Spotify",
        });
    });

    it("disabling a media player removes it and re-enabling replays it", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        settings.setRichPresenceMedia(true);
        await rp.syncRichPresence();
        handler!(media());
        await vi.advanceTimersByTimeAsync(2000);

        rp.setAppAllowed("arrpc:media-spotify", false);
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenLastCalledWith(
            "xyz.extera.msc4544.rpc",
            null,
        );

        // Still playing while blocked: remembered, not published.
        setOwnProfileField.mockClear();
        handler!(
            media({
                presence: { type: 2, name: "Spotify", details: "Next song" },
            }),
        );
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).not.toHaveBeenCalled();

        rp.setAppAllowed("arrpc:media-spotify", true);
        await vi.advanceTimersByTimeAsync(2000);
        const last = setOwnProfileField.mock.calls.at(-1) as [
            string,
            Array<Record<string, unknown>>,
        ];
        expect(last[1][0]).toMatchObject({ track: "Next song" });

        // The player stops: its null report takes the entry off the profile.
        handler!(media({ presence: null }));
        await vi.advanceTimersByTimeAsync(2000);
        expect(setOwnProfileField).toHaveBeenLastCalledWith(
            "xyz.extera.msc4544.rpc",
            null,
        );
    });

    it("turning media off drops media entries and tells the main process", async () => {
        const { settings, rp } = await load();
        settings.setRichPresenceEnabled(true);
        settings.setRichPresenceMedia(true);
        await rp.syncRichPresence();
        expect(configure).toHaveBeenLastCalledWith(
            expect.objectContaining({ media: true }),
        );
        handler!(media());
        await vi.advanceTimersByTimeAsync(2000);
        expect(rp.richPresenceState.heldCount).toBe(1);

        settings.setRichPresenceMedia(false);
        await rp.syncRichPresence();
        await vi.advanceTimersByTimeAsync(2000);
        expect(configure).toHaveBeenLastCalledWith(
            expect.objectContaining({ local: true, media: false }),
        );
        expect(rp.richPresenceState.heldCount).toBe(0);
        expect(setOwnProfileField).toHaveBeenLastCalledWith(
            "xyz.extera.msc4544.rpc",
            null,
        );

        // Reports that still arrive while it is off are not held.
        handler!(media());
        expect(rp.richPresenceState.heldCount).toBe(0);
    });

    describe("steam", () => {
        const steam = (over: Partial<DesktopRichPresenceEvent> = {}) =>
            ev({
                source: "arrpc",
                app: { id: "steam-440", name: "Team Fortress 2" },
                presenceId: "steam-440",
                presence: {
                    application_id: "440",
                    name: "Team Fortress 2",
                    details: "Payload",
                    state: "Map: pl_upward",
                },
                ...over,
            });

        it("passes the steam flag to the main process only with sharing and the setting on", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
            expect(configure).toHaveBeenLastCalledWith(
                expect.objectContaining({ local: false, steam: false }),
            );
            settings.setRichPresenceEnabled(true);
            await rp.syncRichPresence();
            expect(configure).toHaveBeenLastCalledWith(
                expect.objectContaining({ local: true, steam: true }),
            );
            settings.setRichPresenceSteam(false);
            await rp.syncRichPresence();
            expect(configure).toHaveBeenLastCalledWith(
                expect.objectContaining({ local: true, steam: false }),
            );
        });

        it("publishes a Steam game as a game, recorded as Steam and not as Discord", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
            handler!(steam());
            await vi.advanceTimersByTimeAsync(2000);

            expect(rp.richPresenceState.apps["arrpc:steam-440"]).toMatchObject({
                name: "Team Fortress 2",
                allowed: true,
                viaSteam: true,
                viaRpc: false,
                viaScan: false,
                viaMedia: false,
            });
            const last = setOwnProfileField.mock.calls.at(-1) as [
                string,
                Array<Record<string, unknown>>,
            ];
            expect(last[1][0]).toMatchObject({
                name: "Team Fortress 2",
                details: "Payload",
                state: "Map: pl_upward",
            });
        });

        it("drops Steam reports while the setting is off", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            await rp.syncRichPresence();
            handler!(steam());
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(0);
            expect(
                rp.richPresenceState.apps["arrpc:steam-440"],
            ).toBeUndefined();
        });

        it("turning Steam off drops what it was playing", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
            handler!(steam());
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(1);

            settings.setRichPresenceSteam(false);
            await rp.syncRichPresence();
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(0);
            expect(setOwnProfileField).toHaveBeenLastCalledWith(
                "xyz.extera.msc4544.rpc",
                null,
            );
        });

        it("replaces the scanner's copy of a game and skips later scanner reports for it", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
            handler!(game());
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(1);

            // Same name, reported by Steam: the scanner's copy goes.
            handler!(steam({ app: { id: "steam-123", name: "Some Game" } }));
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(1);
            expect(rp.richPresenceState.apps["arrpc:steam-123"]).toMatchObject({
                viaSteam: true,
            });

            // The scanner repeating itself does not bring its copy back.
            setOwnProfileField.mockClear();
            handler!(game({ state: "again" }));
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(1);
            expect(setOwnProfileField).not.toHaveBeenCalled();
        });

        it("removing a Steam game takes it off the profile", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
            handler!(steam());
            await vi.advanceTimersByTimeAsync(2000);

            handler!(steam({ presence: null }));
            await vi.advanceTimersByTimeAsync(2000);
            expect(rp.richPresenceState.heldCount).toBe(0);
            expect(setOwnProfileField).toHaveBeenLastCalledWith(
                "xyz.extera.msc4544.rpc",
                null,
            );
        });

        it("enableSteam turns the source on only after the debug flag is written", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            await rp.syncRichPresence();

            setSteamDebugging.mockResolvedValueOnce({
                ok: false,
                cancelled: true,
            });
            const failed = await rp.enableSteam();
            expect(setSteamDebugging).toHaveBeenLastCalledWith(true);
            expect(failed).toMatchObject({ ok: false, cancelled: true });
            expect(settings.settingsState.richPresenceSteam).toBe(false);

            const ok = await rp.enableSteam();
            expect(ok.ok).toBe(true);
            expect(settings.settingsState.richPresenceSteam).toBe(true);
            expect(configure).toHaveBeenLastCalledWith(
                expect.objectContaining({ local: true, steam: true }),
            );
        });

        it("disableSteam turns the source off and reports when the flag could not be removed", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();

            setSteamDebugging.mockResolvedValueOnce({
                ok: false,
                error: "access denied",
            });
            const out = await rp.disableSteam();
            // The source is off regardless, and the outcome is not swallowed.
            expect(settings.settingsState.richPresenceSteam).toBe(false);
            expect(configure).toHaveBeenLastCalledWith(
                expect.objectContaining({ local: true, steam: false }),
            );
            expect(setSteamDebugging).toHaveBeenLastCalledWith(false);
            expect(out).toEqual({ ok: false, error: "access denied" });
            // The status is re-read so the UI sees the flag as still set.
            expect(statusFn).toHaveBeenCalled();
        });

        it("disableSteam reports success without re-reading the status", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
            const out = await rp.disableSteam();
            expect(out.ok).toBe(true);
            expect(setSteamDebugging).toHaveBeenLastCalledWith(false);
            expect(statusFn).not.toHaveBeenCalled();
        });
    });

    describe("plugins", () => {
        const entry = (id = "e1") => ({
            kind: "activity" as const,
            id,
            expiry: Date.now() + 60_000,
            buttons: [],
            name: "Plugin game",
        });
        const lastValue = () =>
            setOwnProfileField.mock.lastCall?.[1] as Array<{
                id: string;
                name: string;
                expiry: number;
            }> | null;

        it("publishes without sharing from this computer, or a desktop", async () => {
            delete (window as unknown as { desktop?: unknown }).desktop;
            const { rp } = await load();
            rp.setPluginPresence("com.x", "X", entry(), false);
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toEqual([
                expect.objectContaining({
                    id: "com.x-e1",
                    name: "Plugin game",
                }),
            ]);
            expect(rp.richPresenceState.apps["plugin:com.x"]).toMatchObject({
                name: "X",
                source: "plugin",
                allowed: true,
            });
            expect(rp.pluginPresenceKnown()).toBe(true);
        });

        it("renews an entry set without an expiry", async () => {
            const { rp } = await load();
            rp.setPluginPresence("com.x", "X", entry(), false);
            await vi.advanceTimersByTimeAsync(20 * 60_000);
            expect(lastValue()).toHaveLength(1);
            expect(lastValue()![0].expiry).toBeGreaterThan(Date.now());
        });

        it("lets a timed entry run out", async () => {
            const { rp } = await load();
            rp.setPluginPresence("com.x", "X", entry(), true);
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toHaveLength(1);
            await vi.advanceTimersByTimeAsync(70_000);
            expect(lastValue()).toBeNull();
        });

        it("is held back while blocked and published again when allowed", async () => {
            const { rp } = await load();
            rp.setPluginPresence("com.x", "X", entry(), false);
            await vi.advanceTimersByTimeAsync(2000);
            rp.setAppAllowed("plugin:com.x", false);
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toBeNull();
            rp.setPluginPresence("com.x", "X", entry(), false);
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toBeNull();
            rp.setAppAllowed("plugin:com.x", true);
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toHaveLength(1);
        });

        it("clears one entry or all of a plugin's", async () => {
            const { rp } = await load();
            rp.setPluginPresence("com.x", "X", entry("a"), false);
            rp.setPluginPresence("com.x", "X", entry("b"), false);
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toHaveLength(2);
            rp.clearPluginPresence("com.x", "a");
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()!.map((e) => e.id)).toEqual(["com.x-b"]);
            rp.clearPluginPresence("com.x");
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toBeNull();
        });

        it("survives sharing from this computer going off", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            await rp.syncRichPresence();
            rp.setPluginPresence("com.x", "X", entry(), false);
            settings.setRichPresenceEnabled(false);
            await rp.syncRichPresence();
            await vi.advanceTimersByTimeAsync(2000);
            expect(lastValue()).toHaveLength(1);
        });
    });

    describe("game invites", () => {
        const CONNECT = "+connect 10.0.0.1:27015";
        const FRIEND = "76561198000000001";
        const LOBBY = "109775240000000000";
        const steamGame = (over: Partial<DesktopRichPresenceEvent> = {}) =>
            ev({
                source: "arrpc",
                app: { id: "steam-440", name: "Team Fortress 2" },
                presenceId: "steam-440",
                presence: {
                    application_id: "440",
                    name: "Team Fortress 2",
                    details: "Payload",
                    steam_id: FRIEND,
                    steam_connect: CONNECT,
                },
                ...over,
            });
        const on = async (
            rp: typeof import("./richPresence.svelte"),
            settings: typeof import("$lib/stores/settings.svelte"),
        ) => {
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceSteam(true);
            await rp.syncRichPresence();
        };

        it("carries the game icon hash from its presence picture", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            const icon = "b".repeat(40);
            handler!(
                steamGame({
                    presence: {
                        application_id: "440",
                        name: "Team Fortress 2",
                        steam_id: FRIEND,
                        steam_connect: CONNECT,
                        assets: { large_image: `steam:440:${icon}` },
                    },
                }),
            );
            expect(rp.invitableGames()[0].steam.icon).toBe(icon);
        });

        it("offers a running Steam game with its app id and launch arguments", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            expect(rp.invitableGames()).toEqual([
                expect.objectContaining({
                    key: "arrpc:steam-440|steam-440",
                    name: "Team Fortress 2",
                    steam: { appId: "440", steamId: FRIEND, connect: CONNECT },
                }),
            ]);
        });

        it("offers a lobby invite with its lobby id, even without launch arguments", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            const { steam_connect: _, ...noConnect } = steamGame()
                .presence as Record<string, unknown>;
            handler!(
                steamGame({
                    presence: { ...noConnect, steam_lobby: LOBBY },
                }),
            );
            expect(rp.invitableGames()).toEqual([
                expect.objectContaining({
                    steam: { appId: "440", steamId: FRIEND, lobbyId: LOBBY },
                }),
            ]);
        });

        it("offers nothing for a Steam report without the friend's Steam id", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            const { steam_id: _, ...noId } = steamGame().presence as Record<
                string,
                unknown
            >;
            handler!(steamGame({ presence: { ...noId, steam_lobby: LOBBY } }));
            expect(rp.invitableGames()).toEqual([]);
        });

        it("keeps the invite when the app is not shared", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            rp.setAppAllowed("arrpc:steam-440", false);
            expect(rp.invitableGames()).toHaveLength(1);
        });

        it("never publishes the launch arguments to the profile", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            await vi.advanceTimersByTimeAsync(2000);
            expect(setOwnProfileField).toHaveBeenCalled();
            for (const call of setOwnProfileField.mock.calls)
                expect(JSON.stringify(call)).not.toContain("+connect");
        });

        it("offers nothing for a Steam report without launch arguments", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            const { steam_connect: _, ...noConnect } = steamGame()
                .presence as Record<string, unknown>;
            handler!(steamGame({ presence: noConnect }));
            expect(rp.invitableGames()).toEqual([]);
        });

        it("offers nothing when the presence id is not a Steam app id", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame({ presenceId: "steam-abc" }));
            expect(rp.invitableGames()).toEqual([]);
        });

        it("offers no Discord game, even one carrying a join secret", async () => {
            const { settings, rp } = await load();
            settings.setRichPresenceEnabled(true);
            settings.setRichPresenceArrpc(true);
            await rp.syncRichPresence();
            handler!(
                ev({
                    source: "arrpc",
                    app: { id: "123", name: "Among Us" },
                    presenceId: "p-1",
                    presence: {
                        name: "Among Us",
                        application_id: "123",
                        secrets: { join: "join-secret" },
                    },
                }),
            );
            expect(rp.invitableGames()).toEqual([]);
        });

        it("drops the invite when the game stops", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            handler!(steamGame({ presence: null }));
            expect(rp.invitableGames()).toEqual([]);
        });

        it("drops Steam invites when Steam is switched off", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            settings.setRichPresenceSteam(false);
            await rp.syncRichPresence();
            expect(rp.invitableGames()).toEqual([]);
        });

        it("drops every invite when sharing from this computer goes off", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            settings.setRichPresenceEnabled(false);
            await rp.syncRichPresence();
            expect(rp.invitableGames()).toEqual([]);
        });

        it("drops the invite when its app is forgotten", async () => {
            const { settings, rp } = await load();
            await on(rp, settings);
            handler!(steamGame());
            rp.forgetApp("arrpc:steam-440");
            expect(rp.invitableGames()).toEqual([]);
        });
    });
});
