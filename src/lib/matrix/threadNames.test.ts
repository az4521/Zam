import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    MatrixEvent,
    MatrixEventEvent,
    RoomEvent,
    type MatrixClient,
    type Room,
} from "matrix-js-sdk";
import {
    ensureThreadNamePushRule,
    getThreadName,
    getThreadNameLevel,
    onThreadNameChange,
    setRoomPowerLevels,
    setThreadName,
} from "./client";
import { PushProcessor } from "matrix-js-sdk/lib/pushprocessor";
import { installClient, releaseClient } from "./runtime";
import {
    THREAD_NAME_EVENT_TYPE,
    THREAD_NAME_POWER_LEVEL_KEY,
    THREAD_NAME_PUSH_RULE_ID,
    THREAD_NAME_REL_TYPE,
    buildThreadNameContent,
    buildThreadNamePushRule,
} from "$lib/utils/threadName";

// The thread name cache in client.ts, against real MatrixEvents. The rule
// these pin: a naming event is judged by its clear relation, becomes current
// in arrival order, and its name only lands once it decrypts.

const ROOM = "!r:x";
const OWNER = "@owner:x";
const relation = (root: string) => ({
    rel_type: THREAD_NAME_REL_TYPE,
    event_id: root,
});

function cleartext(id: string, root: string, name: string, sender = OWNER) {
    return {
        event_id: id,
        room_id: ROOM,
        type: THREAD_NAME_EVENT_TYPE,
        sender,
        origin_server_ts: 1,
        content: buildThreadNameContent(root, name),
    };
}

/** As the server holds it: no name, no type, the relation in the clear. */
function encrypted(id: string, root: string, sender = OWNER) {
    return {
        event_id: id,
        room_id: ROOM,
        type: "m.room.encrypted",
        sender,
        origin_server_ts: 1,
        content: {
            algorithm: "m.megolm.v1.aes-sha2",
            ciphertext: "...",
            "m.relates_to": relation(root),
        },
    };
}

/** Finish decrypting `event` the way the SDK does, naming `root` `name`. */
async function decrypt(event: MatrixEvent, root: string, name: string) {
    await event.attemptDecryption({
        decryptEvent: async () => ({
            clearEvent: {
                type: THREAD_NAME_EVENT_TYPE,
                content: buildThreadNameContent(root, name),
            },
        }),
    } as never);
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

function harness() {
    const emitter = new EventEmitter();
    const roots = new Map<string, MatrixEvent>();
    const client = Object.assign(emitter, {
        getUserId: () => OWNER,
        supportsIntentionalMentions: () => true,
        makeTxnId: () => "txn",
        pushRules: { global: { override: [] as { rule_id: string }[] } },
        addPushRule: vi.fn().mockResolvedValue({}),
        decryptEventIfNeeded: vi.fn().mockResolvedValue(undefined),
        fetchRelations: vi.fn().mockResolvedValue({ chunk: [] }),
        sendEvent: vi.fn().mockResolvedValue({ event_id: "$sent" }),
        cancelPendingEvent: vi.fn(),
        sendStateEvent: vi.fn().mockResolvedValue({}),
        getEventMapper: () => (raw: object) => new MatrixEvent(raw),
    });
    const pending: MatrixEvent[] = [];
    let powerLevels: MatrixEvent | null = null;
    const room = {
        roomId: ROOM,
        getVersion: () => "11",
        getMember: (id: string) => ({
            powerLevel: id === "@mod:x" ? 50 : id === "@helper:x" ? 25 : 0,
        }),
        findEventById: (id: string) => roots.get(id),
        getThread: () => null,
        getPendingEvents: () => pending,
        getLiveTimeline: () => ({
            getState: () => ({ getStateEvents: () => powerLevels }),
        }),
    } as unknown as Room;
    const addRoot = (id: string, unsigned?: object) =>
        roots.set(
            id,
            new MatrixEvent({
                event_id: id,
                room_id: ROOM,
                type: "m.room.message",
                sender: OWNER,
                origin_server_ts: 1,
                content: { msgtype: "m.text", body: "root" },
                unsigned,
            }),
        );
    const live = (event: MatrixEvent) =>
        client.emit(RoomEvent.Timeline, event, room, false, false);
    const setThreadNameLevel = (level: number) => {
        powerLevels = new MatrixEvent({
            type: "m.room.power_levels",
            state_key: "",
            content: { redact: 30, [THREAD_NAME_POWER_LEVEL_KEY]: level },
        });
    };
    return { client, room, pending, addRoot, live, setThreadNameLevel };
}

describe("thread names", () => {
    let h: ReturnType<typeof harness>;
    let stop: () => void;
    let roots = 0;
    let root: string;

    beforeEach(() => {
        h = harness();
        // The cache is per module: a fresh root per test keeps them apart.
        root = `$root${++roots}`;
        h.addRoot(root);
        installClient(h.client as unknown as MatrixClient);
        stop = onThreadNameChange(() => {});
    });

    afterEach(() => {
        stop();
        releaseClient();
    });

    /** Prime the cache with "no name" so a live event is the only source. */
    async function loaded() {
        expect(getThreadName(h.room, root)).toBeNull();
        await flush();
    }

    it("sends through the SDK, which encrypts when the room does", async () => {
        await setThreadName(h.room, root, "  Plan ");
        expect(h.client.sendEvent).toHaveBeenCalledWith(
            ROOM,
            THREAD_NAME_EVENT_TYPE,
            buildThreadNameContent(root, "Plan"),
            "txn",
        );
        expect(getThreadName(h.room, root)).toBe("Plan");
    });

    it("drops the echo of a name the server refused", async () => {
        const refused = new Error("M_FORBIDDEN");
        h.client.sendEvent.mockRejectedValue(refused);
        const echo = new MatrixEvent({ type: THREAD_NAME_EVENT_TYPE });
        echo.setTxnId("txn");
        h.pending.push(echo);
        await expect(setThreadName(h.room, root, "Plan")).rejects.toBe(refused);
        expect(h.client.cancelPendingEvent).toHaveBeenCalledWith(echo);
    });

    it("fetches without a type filter, then decrypts the newest valid event", async () => {
        const raw = encrypted("$enc", root);
        h.client.fetchRelations.mockResolvedValue({
            chunk: [encrypted("$spam", root, "@rando:x"), raw],
        });
        let mapped: MatrixEvent | undefined;
        h.client.getEventMapper = () => (obj: object) =>
            (mapped = new MatrixEvent(obj));
        h.client.decryptEventIfNeeded.mockImplementation((e: MatrixEvent) =>
            decrypt(e, root, "Secret"),
        );

        expect(getThreadName(h.room, root)).toBeNull();
        await flush();

        expect(h.client.fetchRelations.mock.calls[0].slice(1, 4)).toEqual([
            root,
            THREAD_NAME_REL_TYPE,
            null,
        ]);
        expect(mapped?.getId()).toBe("$enc");
        expect(getThreadName(h.room, root)).toBe("Secret");
    });

    it("still reads a cleartext name from before names were encrypted", async () => {
        h.client.fetchRelations.mockResolvedValue({
            chunk: [cleartext("$old", root, "Legacy")],
        });
        await loaded();
        expect(getThreadName(h.room, root)).toBe("Legacy");
    });

    it("prefers the bundle on the root over fetching", async () => {
        h.addRoot(root, {
            "m.relations": {
                [THREAD_NAME_REL_TYPE]: {
                    latest_event: cleartext("$b", root, "Bundled"),
                },
            },
        });
        await loaded();
        expect(h.client.fetchRelations).not.toHaveBeenCalled();
        expect(getThreadName(h.room, root)).toBe("Bundled");
    });

    it("gives the bundled event the room id a /sync bundle can leave out", async () => {
        const { room_id: _, ...bundled } = cleartext("$b", root, "Bundled");
        h.addRoot(root, {
            "m.relations": {
                [THREAD_NAME_REL_TYPE]: { latest_event: bundled },
            },
        });
        const seen: unknown[] = [];
        h.client.getEventMapper = () => (obj: object) => {
            seen.push(obj);
            return new MatrixEvent(obj);
        };
        await loaded();
        expect(seen).toEqual([expect.objectContaining({ room_id: ROOM })]);
    });

    it("refetches past a redacted name, even with a stale bundle", async () => {
        h.addRoot(root, {
            "m.relations": {
                [THREAD_NAME_REL_TYPE]: {
                    latest_event: cleartext("$new", root, "Abusive"),
                },
            },
        });
        await loaded();
        expect(getThreadName(h.room, root)).toBe("Abusive");

        h.client.fetchRelations.mockResolvedValue({
            chunk: [cleartext("$prev", root, "Previous")],
        });
        h.live(
            new MatrixEvent({
                type: "m.room.redaction",
                room_id: ROOM,
                sender: "@mod:x",
                redacts: "$new",
                content: {},
            }),
        );
        expect(getThreadName(h.room, root)).toBeNull();
        await flush();
        expect(getThreadName(h.room, root)).toBe("Previous");
    });

    it("takes a live rename once it decrypts", async () => {
        await loaded();
        const event = new MatrixEvent(encrypted("$live", root));
        h.client.decryptEventIfNeeded.mockImplementation(() =>
            decrypt(event, root, "Live"),
        );
        h.live(event);
        await flush();
        expect(getThreadName(h.room, root)).toBe("Live");
    });

    it("keeps the old name until a late key arrives, then updates", async () => {
        await setThreadName(h.room, root, "Old");
        const event = new MatrixEvent(encrypted("$utd", root));
        h.live(event);
        await flush();
        expect(getThreadName(h.room, root)).toBe("Old");

        await decrypt(event, root, "New");
        h.client.emit(MatrixEventEvent.Decrypted, event);
        expect(getThreadName(h.room, root)).toBe("New");
    });

    it("orders renames by arrival, not by when they decrypt", async () => {
        await loaded();
        const first = new MatrixEvent(encrypted("$1", root));
        const second = new MatrixEvent(encrypted("$2", root));
        h.live(first);
        h.live(second);
        await decrypt(second, root, "Second");
        h.client.emit(MatrixEventEvent.Decrypted, second);
        await decrypt(first, root, "First");
        h.client.emit(MatrixEventEvent.Decrypted, first);
        expect(getThreadName(h.room, root)).toBe("Second");
    });

    it("clears on a live empty name", async () => {
        await setThreadName(h.room, root, "Old");
        h.live(new MatrixEvent(cleartext("$clear", root, "")));
        await flush();
        expect(getThreadName(h.room, root)).toBeNull();
    });

    it("lets a moderator rename, and ignores anyone else undecrypted", async () => {
        await setThreadName(h.room, root, "Old");
        h.live(new MatrixEvent(encrypted("$no", root, "@rando:x")));
        await flush();
        expect(h.client.decryptEventIfNeeded).not.toHaveBeenCalled();
        expect(getThreadName(h.room, root)).toBe("Old");

        h.live(new MatrixEvent(cleartext("$mod", root, "Mod", "@mod:x")));
        await flush();
        expect(getThreadName(h.room, root)).toBe("Mod");
    });

    it("uses the room's level for naming, not a fixed 50", async () => {
        h.setThreadNameLevel(25);
        await setThreadName(h.room, root, "Old");
        h.live(new MatrixEvent(cleartext("$h", root, "Helper", "@helper:x")));
        await flush();
        expect(getThreadName(h.room, root)).toBe("Helper");

        h.setThreadNameLevel(100);
        h.live(new MatrixEvent(cleartext("$m", root, "Mod", "@mod:x")));
        await flush();
        expect(getThreadName(h.room, root)).toBe("Helper");
    });

    it("takes a refreshed bundle over what sync delivered", async () => {
        await setThreadName(h.room, root, "From sync");
        h.addRoot(root, {
            "m.relations": {
                [THREAD_NAME_REL_TYPE]: {
                    latest_event: cleartext("$graph", root, "Graph order"),
                },
            },
        });
        expect(getThreadName(h.room, root)).toBe("From sync");
        await flush();
        expect(getThreadName(h.room, root)).toBe("Graph order");
    });

    it("keeps a live rename over the old bundle still on the root", async () => {
        h.addRoot(root, {
            "m.relations": {
                [THREAD_NAME_REL_TYPE]: {
                    latest_event: cleartext("$b", root, "Bundled"),
                },
            },
        });
        await loaded();
        expect(getThreadName(h.room, root)).toBe("Bundled");

        h.live(new MatrixEvent(cleartext("$live", root, "Live")));
        await flush();
        expect(getThreadName(h.room, root)).toBe("Live");
        await flush();
        expect(getThreadName(h.room, root)).toBe("Live");
    });

    it("keeps our own rename over a bundle from before it", async () => {
        h.addRoot(root, {
            "m.relations": {
                [THREAD_NAME_REL_TYPE]: {
                    latest_event: cleartext("$b", root, "Bundled"),
                },
            },
        });
        await setThreadName(h.room, root, "Mine");
        expect(getThreadName(h.room, root)).toBe("Mine");
        await flush();
        expect(getThreadName(h.room, root)).toBe("Mine");
    });

    it("lets a live rename beat a /relations response still in flight", async () => {
        let respond = (_: unknown) => {};
        h.client.fetchRelations.mockReturnValue(
            new Promise((resolve) => (respond = resolve)),
        );
        expect(getThreadName(h.room, root)).toBeNull();
        h.live(new MatrixEvent(cleartext("$live", root, "Live")));
        await flush();
        respond({ chunk: [cleartext("$old", root, "Stale")] });
        await flush();
        expect(getThreadName(h.room, root)).toBe("Live");
    });

    it("silences an encrypted rename by its clear relation alone", () => {
        const { body, ruleId } = buildThreadNamePushRule();
        const processor = new PushProcessor(
            h.client as unknown as MatrixClient,
        );
        const rule = {
            ...body,
            rule_id: ruleId,
            default: false,
            enabled: true,
        };
        const matches = (raw: object) =>
            processor.ruleMatchesEvent(
                rule as never,
                new MatrixEvent(raw as never),
            );
        expect(matches(encrypted("$e", root))).toBe(true);
        expect(
            matches({
                ...encrypted("$m", root),
                content: { ciphertext: "...", algorithm: "x" },
            }),
        ).toBe(false);
    });

    it("saves the level alongside the room's other power levels", async () => {
        h.setThreadNameLevel(25);
        expect(getThreadNameLevel(h.room)).toBe(25);
        await setRoomPowerLevels(h.room, { [THREAD_NAME_POWER_LEVEL_KEY]: 75 });
        expect(h.client.sendStateEvent).toHaveBeenCalledWith(
            ROOM,
            "m.room.power_levels",
            { redact: 30, [THREAD_NAME_POWER_LEVEL_KEY]: 75 },
        );
    });

    it("adds the push rule once, leaving one that exists alone", async () => {
        await ensureThreadNamePushRule();
        expect(h.client.addPushRule).toHaveBeenCalledOnce();
        expect(h.client.addPushRule.mock.calls[0].slice(0, 3)).toEqual([
            "global",
            "override",
            THREAD_NAME_PUSH_RULE_ID,
        ]);

        h.client.pushRules.global.override.push({
            rule_id: THREAD_NAME_PUSH_RULE_ID,
        });
        await ensureThreadNamePushRule();
        expect(h.client.addPushRule).toHaveBeenCalledOnce();
    });
});
