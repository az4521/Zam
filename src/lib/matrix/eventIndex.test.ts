import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatrixEvent, MatrixEventEvent } from "matrix-js-sdk";
import {
    crawlOnceForTests,
    deleteEventIndex,
    eventIndexDbName,
    getCoverage,
    readEntriesInRanges,
    startEventIndex,
    stopEventIndex,
} from "./eventIndex";
import {
    clearPrefetch,
    historyPrefetchAvailable,
    setPrefetchPlan,
    takePrefetchedPage,
} from "./historyPrefetch";
import { mediaFilterDefinition } from "$lib/utils/roomMedia";

// The background crawler against a fake client and an in-memory IndexedDB.
// The SDK's late-decrypt re-emit is modelled by the fake mapper: it creates
// real MatrixEvents and forwards their Decrypted onto the client, as the
// SDK's event mapper does.

const hoisted = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("./runtime", () => ({
    get matrixClient() {
        return hoisted.client;
    },
}));
vi.mock("./crypto", () => ({
    isRoomEncrypted: () => true,
    deleteDatabaseWithOutcome: vi.fn(),
}));
vi.mock("./client", () => ({ isSyncStale: () => false }));
vi.mock("./eventIndexSync", () => ({ attachIndexSync: () => () => {} }));
vi.mock("$lib/stores/storageHealth.svelte", () => ({
    reportStorageError: vi.fn(),
}));
vi.mock("./historyPrefetch", () => ({
    historyPrefetchAvailable: vi.fn(() => false),
    setPrefetchPlan: vi.fn(async () => {}),
    takePrefetchedPage: vi.fn(async () => null),
    clearPrefetch: vi.fn(async () => {}),
    prefetchStatus: vi.fn(async () => null),
}));

const USER = "@me:x";
const DEVICE = "DEV";
const ENC_ROOM = "!enc:x";
const OTHER_ROOM = "!other:x";
const ALL: [number, number] = [0, 9e15];

// ── Fake IndexedDB (only the calls eventIndex.ts makes) ───────────────────

type Row = Record<string, unknown>;
interface StoreDef {
    keyPath: string;
    autoIncrement: boolean;
    rows: Map<unknown, Row>;
    indexes: Map<string, string>;
    nextKey: number;
}
interface DbDef {
    version: number;
    stores: Map<string, StoreDef>;
}

function makeFakeIdb() {
    const dbs = new Map<string, DbDef>();
    const later = (fn: () => void) => setTimeout(fn, 0);
    const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

    function makeTx(names: string[], db: DbDef) {
        let pending = 0;
        let finished = false;
        const tx: Record<string, unknown> = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            error: null,
        };
        const settle = () => {
            if (pending > 0 || finished) return;
            later(() => {
                if (pending > 0 || finished) return;
                finished = true;
                (tx.oncomplete as (() => void) | null)?.();
            });
        };
        const op = <T>(fn: () => T) => {
            pending++;
            const r: Record<string, unknown> = {
                result: undefined,
                error: null,
                onsuccess: null,
                onerror: null,
            };
            later(() => {
                try {
                    r.result = fn();
                    (r.onsuccess as (() => void) | null)?.();
                } catch (e) {
                    r.error = e;
                    (r.onerror as (() => void) | null)?.();
                } finally {
                    pending--;
                    settle();
                }
            });
            return r;
        };
        const storeOf = (name: string) => {
            const def = db.stores.get(name);
            if (!def) throw new Error(`no store ${name}`);
            const matches = (row: Row, field: string, q: unknown) =>
                row[field] === q;
            return {
                get: (key: unknown) => op(() => clone(def.rows.get(key))),
                getAll: (q?: unknown) =>
                    op(() =>
                        [...def.rows.values()]
                            .filter(
                                (r) => q === undefined || r[def.keyPath] === q,
                            )
                            .map(clone),
                    ),
                getAllKeys: () => op(() => [...def.rows.keys()]),
                put: (value: Row) =>
                    op(() => {
                        const v = { ...value };
                        if (def.autoIncrement && v[def.keyPath] === undefined)
                            v[def.keyPath] = def.nextKey++;
                        def.rows.set(v[def.keyPath], clone(v));
                        return v[def.keyPath];
                    }),
                add: (value: Row) =>
                    op(() => {
                        const v = { ...value };
                        if (def.autoIncrement && v[def.keyPath] === undefined)
                            v[def.keyPath] = def.nextKey++;
                        def.rows.set(v[def.keyPath], clone(v));
                        return v[def.keyPath];
                    }),
                delete: (key: unknown) => op(() => void def.rows.delete(key)),
                clear: () => op(() => void def.rows.clear()),
                index: (idx: string) => {
                    const field = def.indexes.get(idx) as string;
                    return {
                        getAll: (q: unknown) =>
                            op(() =>
                                [...def.rows.values()]
                                    .filter((r) => matches(r, field, q))
                                    .map(clone),
                            ),
                    };
                },
            };
        };
        tx.objectStore = storeOf;
        settle();
        return tx as unknown as IDBTransaction;
    }

    function makeDbHandle(db: DbDef) {
        return {
            objectStoreNames: [...db.stores.keys()],
            createObjectStore(
                name: string,
                opts: { keyPath: string; autoIncrement?: boolean },
            ) {
                const def: StoreDef = {
                    keyPath: opts.keyPath,
                    autoIncrement: !!opts.autoIncrement,
                    rows: new Map(),
                    indexes: new Map(),
                    nextKey: 1,
                };
                db.stores.set(name, def);
                return {
                    createIndex(idx: string, keyPath: string) {
                        def.indexes.set(idx, keyPath);
                        return this;
                    },
                };
            },
            transaction(names: string | string[]) {
                return makeTx(Array.isArray(names) ? names : [names], db);
            },
            close() {},
        };
    }

    return {
        dbs,
        open(name: string, version: number) {
            const open: Record<string, unknown> = {
                result: undefined,
                transaction: null,
                onupgradeneeded: null,
                onsuccess: null,
                onerror: null,
                onblocked: null,
            };
            later(() => {
                let db = dbs.get(name);
                const oldVersion = db?.version ?? 0;
                if (!db) {
                    db = { version: 0, stores: new Map() };
                    dbs.set(name, db);
                }
                const handle = makeDbHandle(db);
                open.result = handle;
                if (oldVersion < version) {
                    const vtx = makeTx([...db.stores.keys()], db);
                    open.transaction = vtx;
                    (open.onupgradeneeded as ((e: unknown) => void) | null)?.({
                        oldVersion,
                        newVersion: version,
                        target: open,
                    });
                    db.version = version;
                }
                // Upgrade requests were queued first, so they run before this.
                later(() =>
                    (open.onsuccess as ((e: unknown) => void) | null)?.({
                        target: open,
                    }),
                );
            });
            return open;
        },
    };
}

// ── Fake client ───────────────────────────────────────────────────────────

interface FakeRoom {
    roomId: string;
    lastActive: number;
}
type Page = { chunk: Record<string, unknown>[]; end: string | null };
type Step = Page | { throws: Error };

class FakeClient extends EventEmitter {
    baseUrl = "https://hs.test";
    rooms = new Map<string, FakeRoom>();
    script = new Map<string, Step[]>();
    calls = new Map<string, number>();

    getAccessToken() {
        return "ACCESS";
    }
    /** Events the fake treats as undecryptable until releaseKey(). */
    locked = new Set<string>();
    /** What a decrypted event holds, by event id. */
    plain = new Map<
        string,
        { type: string; content: Record<string, unknown> }
    >();
    created = new Map<string, MatrixEvent>();

    getUserId() {
        return USER;
    }
    getDeviceId() {
        return DEVICE;
    }
    getRooms() {
        return [...this.rooms.values()].map((r) => this.roomObj(r));
    }
    getRoom(id: string) {
        const r = this.rooms.get(id);
        return r ? this.roomObj(r) : null;
    }
    private roomObj(r: FakeRoom) {
        return {
            roomId: r.roomId,
            getMyMembership: () => "join",
            getLastActiveTimestamp: () => r.lastActive,
        };
    }

    async createMessagesRequest(roomId: string) {
        this.calls.set(roomId, (this.calls.get(roomId) ?? 0) + 1);
        const next = this.script.get(roomId)?.shift();
        if (!next) return { chunk: [], end: null };
        if ("throws" in next) throw next.throws;
        return next;
    }

    async decryptEventIfNeeded(ev: MatrixEvent) {
        const id = ev.getId() as string;
        if (this.locked.has(id)) return;
        this.decryptLocal(ev);
    }

    private decryptLocal(ev: MatrixEvent) {
        const id = ev.getId() as string;
        const p = this.plain.get(id);
        if (!p) return;
        (ev as unknown as { setClearData(r: unknown): void }).setClearData({
            clearEvent: {
                type: p.type,
                content: p.content,
                event_id: id,
                sender: ev.getSender(),
                room_id: ev.getRoomId(),
                origin_server_ts: ev.getTs(),
            },
            senderCurve25519Key: null,
            claimedEd25519Key: null,
            forwardingCurve25519KeyChain: [],
            untrusted: false,
        });
        ev.emit(MatrixEventEvent.Decrypted, ev);
    }

    /** The server key arrives: the event decrypts after its page was read. */
    releaseKey(eventId: string) {
        this.locked.delete(eventId);
        const ev = this.created.get(eventId);
        if (ev) this.decryptLocal(ev);
    }

    /** Same shape as the SDK mapper with decrypt: false: events are real
     *  MatrixEvents, and their Decrypted is re-emitted on the client. */
    getEventMapper(_opts?: { decrypt?: boolean }) {
        return (raw: Record<string, unknown>) => {
            const ev = new MatrixEvent(raw as never);
            this.created.set(ev.getId() as string, ev);
            ev.on(MatrixEventEvent.Decrypted, (e: MatrixEvent) =>
                this.emit(MatrixEventEvent.Decrypted, e),
            );
            return ev;
        };
    }
}

function encRaw(id: string, room: string, ts: number) {
    return {
        event_id: id,
        room_id: room,
        type: "m.room.encrypted",
        sender: "@alice:x",
        origin_server_ts: ts,
        content: { algorithm: "m.megolm.v1.aes-sha2", ciphertext: "xx" },
    };
}

function plainRaw(id: string, room: string, ts: number, body: string) {
    return {
        event_id: id,
        room_id: room,
        type: "m.room.message",
        sender: "@alice:x",
        origin_server_ts: ts,
        content: { msgtype: "m.text", body },
    };
}

let client: FakeClient;

function addRoom(roomId: string, lastActive: number) {
    client.rooms.set(roomId, { roomId, lastActive });
}

function eventIdsIn(roomId: string) {
    return readEntriesInRanges(roomId, [ALL]).then((es) =>
        es.map((e) => e.e).sort(),
    );
}

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Keeps the background loop asleep, so only the test drives the crawler.
    Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
    });
    globalThis.indexedDB = makeFakeIdb() as unknown as IDBFactory;
    client = new FakeClient();
    hoisted.client = client;
    vi.mocked(historyPrefetchAvailable).mockReturnValue(false);
    vi.mocked(takePrefetchedPage).mockReset();
    vi.mocked(takePrefetchedPage).mockResolvedValue(null);
    vi.mocked(setPrefetchPlan).mockClear();
    vi.mocked(clearPrefetch).mockClear();
});

afterEach(() => {
    stopEventIndex();
    vi.restoreAllMocks();
});

describe("crawler decrypts history through the event mapper", () => {
    it("indexes an event whose key arrives after its page was fetched", async () => {
        addRoom(ENC_ROOM, 1000);
        client.locked.add("$late");
        client.plain.set("$late", {
            type: "m.room.message",
            content: { msgtype: "m.text", body: "found later" },
        });
        client.script.set(ENC_ROOM, [
            { chunk: [encRaw("$late", ENC_ROOM, 500)], end: "t1" },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        // Not indexed yet: the key is still missing.
        expect(await eventIdsIn(ENC_ROOM)).toEqual([]);

        client.releaseKey("$late");
        expect(await eventIdsIn(ENC_ROOM)).toEqual(["$late"]);
    });
});

describe("a re-walk does not store a message twice", () => {
    it("skips a stored message when the same page is crawled again", async () => {
        addRoom(OTHER_ROOM, 1000);
        const page = {
            chunk: [plainRaw("$dup", OTHER_ROOM, 100, "stored once")],
            end: "t1",
        };
        client.script.set(OTHER_ROOM, [page]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        expect(await eventIdsIn(OTHER_ROOM)).toEqual(["$dup"]);

        // A new session has an empty in-memory `seen` set, and the room's
        // crawl state is reset, so the same page is fetched again.
        stopEventIndex();
        const factory = globalThis.indexedDB as unknown as ReturnType<
            typeof makeFakeIdb
        >;
        factory.dbs
            .get(eventIndexDbName(USER, DEVICE))
            ?.stores.get("crawl")
            ?.rows.delete(OTHER_ROOM);
        client.script.set(OTHER_ROOM, [page]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        expect(await eventIdsIn(OTHER_ROOM)).toEqual(["$dup"]);
    });
});

describe("a failing room does not block the crawler", () => {
    it("crawls the next room when one room's fetch throws, and backs off the failing one", async () => {
        addRoom(ENC_ROOM, 2000);
        addRoom(OTHER_ROOM, 1000);
        client.script.set(ENC_ROOM, [{ throws: new Error("boom") }]);
        client.script.set(OTHER_ROOM, [
            {
                chunk: [plainRaw("$o1", OTHER_ROOM, 100, "hello there")],
                end: "t1",
            },
            { chunk: [], end: "t2" },
        ]);
        startEventIndex();

        expect(await crawlOnceForTests()).toBe(true);
        expect(await eventIdsIn(OTHER_ROOM)).toEqual(["$o1"]);
        expect(client.calls.get(ENC_ROOM)).toBe(1);

        // The failing room is inside its backoff, so the next page is the
        // other room's, and the failing room is not asked again.
        expect(await crawlOnceForTests()).toBe(true);
        expect(client.calls.get(ENC_ROOM)).toBe(1);
        expect(console.warn).toHaveBeenCalledWith(
            "[eventIndex] crawl page failed",
            ENC_ROOM,
            expect.any(Error),
        );
    });
});

describe("v3 repair", () => {
    it("drops crawl state and coverage from an older index, keeping its messages", async () => {
        const name = eventIndexDbName(USER, DEVICE);
        const factory = globalThis.indexedDB as unknown as ReturnType<
            typeof makeFakeIdb
        >;
        // A v2 index as the buggy crawler left it: CRAWL done, and COVERAGE
        // claiming the whole history.
        await new Promise<void>((resolve) => {
            const open = factory.open(name, 2) as unknown as {
                result: {
                    createObjectStore(
                        n: string,
                        o: object,
                    ): {
                        createIndex(i: string, k: string): unknown;
                    };
                    transaction(n: string[], m?: string): IDBTransaction;
                };
                onupgradeneeded: () => void;
                onsuccess: () => void;
            };
            open.onupgradeneeded = () => {
                const db = open.result;
                db.createObjectStore("blocks", {
                    keyPath: "id",
                    autoIncrement: true,
                }).createIndex("room", "roomId");
                db.createObjectStore("tails", { keyPath: "roomId" });
                db.createObjectStore("media", { keyPath: "eventId" });
                db.createObjectStore("crawl", { keyPath: "roomId" });
                db.createObjectStore("redacted", {
                    keyPath: "eventId",
                }).createIndex("room", "roomId");
                db.createObjectStore("coverage", { keyPath: "roomId" });
            };
            open.onsuccess = () => {
                const db = open.result;
                const tx = db.transaction(
                    ["tails", "crawl", "coverage"],
                    "readwrite",
                );
                tx.objectStore("tails").put({
                    roomId: ENC_ROOM,
                    entries: [
                        { e: "$old", s: "@a:x", t: 500, m: "text", b: "old" },
                    ],
                });
                tx.objectStore("crawl").put({
                    roomId: ENC_ROOM,
                    from: "t9",
                    done: true,
                    upTs: 0,
                });
                tx.objectStore("coverage").put({
                    roomId: ENC_ROOM,
                    ranges: [[0, 5000]],
                });
                tx.oncomplete = () => resolve();
            };
        });

        addRoom(ENC_ROOM, 1000);
        startEventIndex();

        // No [0, newest] claim survives: the old messages are kept, and the
        // only coverage is their own span until the crawler walks again.
        // The seed runs in the background, so wait for its write to land.
        await vi.waitFor(async () =>
            expect(await getCoverage(ENC_ROOM)).toEqual([[500, 500]]),
        );
        expect(await eventIdsIn(ENC_ROOM)).toEqual(["$old"]);
    });
});

describe("the Android background download feeds the crawler", () => {
    beforeEach(() => {
        vi.mocked(historyPrefetchAvailable).mockReturnValue(true);
    });

    function crawlRow(roomId: string) {
        const factory = globalThis.indexedDB as unknown as ReturnType<
            typeof makeFakeIdb
        >;
        return factory.dbs
            .get(eventIndexDbName(USER, DEVICE))
            ?.stores.get("crawl")
            ?.rows.get(roomId) as { from: string | null } | undefined;
    }

    it("indexes a prefetched page for the crawl token with no request, and advances the row", async () => {
        addRoom(OTHER_ROOM, 1000);
        client.script.set(OTHER_ROOM, [
            {
                chunk: [plainRaw("$first", OTHER_ROOM, 900, "first")],
                end: "tokA",
            },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        expect(crawlRow(OTHER_ROOM)?.from).toBe("tokA");

        vi.mocked(takePrefetchedPage).mockResolvedValueOnce({
            chunk: [plainRaw("$pre", OTHER_ROOM, 500, "from native")],
            end: "tokB",
            fetchedAt: 1,
        });
        expect(await crawlOnceForTests()).toBe(true);
        expect(client.calls.get(OTHER_ROOM)).toBe(1);
        expect(takePrefetchedPage).toHaveBeenLastCalledWith(
            ownDbName(),
            OTHER_ROOM,
            "tokA",
        );
        expect(await eventIdsIn(OTHER_ROOM)).toEqual(["$first", "$pre"]);
        expect(crawlRow(OTHER_ROOM)?.from).toBe("tokB");
    });

    it("sends a room with no token to the server, without asking native", async () => {
        addRoom(OTHER_ROOM, 1000);
        client.script.set(OTHER_ROOM, [
            {
                chunk: [plainRaw("$new", OTHER_ROOM, 900, "first page")],
                end: "tokA",
            },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        expect(takePrefetchedPage).not.toHaveBeenCalled();
        expect(client.calls.get(OTHER_ROOM)).toBe(1);
        expect(await eventIdsIn(OTHER_ROOM)).toEqual(["$new"]);
    });

    it("asks the server when native holds no page for the token", async () => {
        addRoom(OTHER_ROOM, 1000);
        client.script.set(OTHER_ROOM, [
            { chunk: [plainRaw("$a", OTHER_ROOM, 900, "a")], end: "tokA" },
            { chunk: [plainRaw("$b", OTHER_ROOM, 800, "b")], end: "tokB" },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        expect(await crawlOnceForTests()).toBe(true);
        expect(takePrefetchedPage).toHaveBeenCalledTimes(1);
        expect(client.calls.get(OTHER_ROOM)).toBe(2);
        expect(await eventIdsIn(OTHER_ROOM)).toEqual(["$a", "$b"]);
    });

    it("pushes only rooms with a token, and the exact filter and page size", async () => {
        addRoom(ENC_ROOM, 2000);
        addRoom(OTHER_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            { chunk: [plainRaw("$e", ENC_ROOM, 900, "e")], end: "tokE" },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);

        // The page going to the background pushes the plan at once.
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.waitFor(() =>
            expect(setPrefetchPlan).toHaveBeenLastCalledWith({
                accountKey: ownDbName(),
                baseUrl: "https://hs.test",
                accessToken: "ACCESS",
                filter: JSON.stringify(mediaFilterDefinition(true, 100)),
                pageSize: 100,
                rooms: [{ roomId: ENC_ROOM, from: "tokE" }],
            }),
        );
    });

    it("clears the account's native download when its index is deleted", async () => {
        await deleteEventIndex(USER, DEVICE);
        expect(clearPrefetch).toHaveBeenCalledWith(ownDbName());
    });
});

function ownDbName() {
    return eventIndexDbName(USER, DEVICE);
}
