import { EventEmitter } from "node:events";
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { readFileSync } from "node:fs";
import { MatrixEvent, MatrixEventEvent, RoomEvent } from "matrix-js-sdk";
import {
    decodeLegacyBlock,
    isIndexPlaceholderId,
    parseIndexPlaceholderId,
} from "$lib/utils/eventIndex";
import { parseSearchQuery } from "$lib/utils/messageSearch";
import {
    decodeIndexBlock,
    eventIdHash,
    type CompactEntry,
} from "$lib/utils/indexBlock";
import { initPpmd } from "$lib/utils/ppmd";
import {
    crawlOnceForTests,
    deleteEventIndex,
    eventIndexDbName,
    getCoverage,
    importPeerEntries,
    runPendingRetries,
    resolveOriginTimes,
    readEntriesInRanges,
    searchLocalIndex,
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
vi.mock("./client", () => ({
    isSyncStale: () => false,
    // The server's view: the fake client's `fetched` timestamps.
    // Like the real wrapper: a number, or a thrown error (M_NOT_FOUND for an
    // unknown event, anything else when the fake is told to fail).
    fetchEventOriginTs: async (_roomId: string, id: string) => {
        const fake = hoisted.client as FakeClient;
        const mode = fake.failing.get(id);
        if (mode === "error") throw new Error("network down");
        const ts = fake.fetched.get(id);
        if (mode === "notfound" || ts === undefined) {
            throw Object.assign(new Error("not found"), {
                errcode: "M_NOT_FOUND",
                httpStatus: 404,
            });
        }
        return ts;
    },
}));
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
    /** Events the client holds locally (findEventById), by id. */
    loaded = new Set<string>();
    /** Timestamps the server gives for an event id (fetchEventOriginTs). */
    fetched = new Map<string, number>();
    /** Events whose lookup fails: "error" (retryable) or "notfound". */
    failing = new Map<string, "error" | "notfound">();

    private roomObj(r: FakeRoom) {
        return {
            roomId: r.roomId,
            getMyMembership: () => "join",
            getLastActiveTimestamp: () => r.lastActive,
            findEventById: (id: string) =>
                this.loaded.has(id) ? this.created.get(id) : undefined,
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
        event_id: remember(id),
        room_id: room,
        type: "m.room.encrypted",
        sender: "@alice:x",
        origin_server_ts: ts,
        content: { algorithm: "m.megolm.v1.aes-sha2", ciphertext: "xx" },
    };
}

function plainRaw(id: string, room: string, ts: number, body: string) {
    return {
        event_id: remember(id),
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

/** Event ids the test has created, by hash: stored entries keep only hashes. */
const idOfHash = new Map<number, string>();
function remember(id: string): string {
    idOfHash.set(eventIdHash(id), id);
    return id;
}

/** The event ids indexed in a room (the test's own ids, sorted). */
function eventIdsIn(roomId: string) {
    return readEntriesInRanges(roomId, [ALL]).then((es) =>
        es.map((e) => idOfHash.get(e.h) ?? `#${e.h}`).sort(),
    );
}

beforeAll(async () => {
    // The block codec is WASM, which the test loads from disk (the app
    // fetches it by URL).
    await initPpmd(readFileSync("src/lib/utils/ppmd.wasm"));
});

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

/** Every body this account's index still holds on disk: tails, and blocks
 *  decoded from their compressed form. */
async function storedBodies(): Promise<string[]> {
    const factory = globalThis.indexedDB as unknown as ReturnType<
        typeof makeFakeIdb
    >;
    const stores = factory.dbs.get(eventIndexDbName(USER, DEVICE))!.stores;
    const bodies: string[] = [];
    for (const row of stores.get("tails")!.rows.values())
        for (const e of row.entries as { b: string }[]) bodies.push(e.b);
    for (const row of stores.get("blocks")!.rows.values()) {
        const r = row as Record<string, unknown>;
        const entries =
            r.fmt === 2
                ? decodeIndexBlock({
                      meta: r.meta as Uint8Array,
                      body: r.body as Uint8Array,
                  })
                : await decodeLegacyBlock(row as never);
        for (const e of entries) bodies.push(e.b);
    }
    return bodies;
}

function redactionOf(target: string, roomId: string) {
    return new MatrixEvent({
        type: "m.room.redaction",
        event_id: `$redact-${target}`,
        room_id: roomId,
        sender: "@alice:x",
        origin_server_ts: 2000,
        redacts: target,
        content: {},
    });
}

describe("a redaction removes the stored body", () => {
    it("removes a body from a block when its target is not loaded", async () => {
        addRoom(ENC_ROOM, 1000);
        // 255 messages: the first 250 become a block, the rest stay in the tail.
        const chunk = Array.from({ length: 255 }, (_, i) =>
            plainRaw(
                `$m${i}`,
                ENC_ROOM,
                500 + i,
                i === 3 ? "hunter2 secret" : `message ${i}`,
            ),
        );
        client.script.set(ENC_ROOM, [{ chunk, end: null }]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        expect(await storedBodies()).toContain("hunter2 secret");

        // The SDK raises RoomEvent.Redaction only for a loaded target; the
        // redaction still reaches the timeline, and that is what is watched.
        // Not loaded locally, so its timestamp comes from the server.
        client.fetched.set("$m3", 503);
        client.emit(RoomEvent.Timeline, redactionOf("$m3", ENC_ROOM), {
            roomId: ENC_ROOM,
        });
        await vi.waitFor(async () =>
            expect(await eventIdsIn(ENC_ROOM)).toHaveLength(254),
        );
        const ids = await eventIdsIn(ENC_ROOM);
        expect(ids).not.toContain("$m3");
        expect(await storedBodies()).not.toContain("hunter2 secret");
    });

    it("never stores the body of a message redacted before it was indexed", async () => {
        addRoom(ENC_ROOM, 1000);
        startEventIndex();
        client.emit(RoomEvent.Timeline, redactionOf("$early", ENC_ROOM), {
            roomId: ENC_ROOM,
        });
        client.script.set(ENC_ROOM, [
            {
                chunk: [plainRaw("$early", ENC_ROOM, 500, "too late to hide")],
                end: null,
            },
        ]);
        expect(await crawlOnceForTests()).toBe(true);
        expect(await eventIdsIn(ENC_ROOM)).toEqual([]);
        expect(await storedBodies()).not.toContain("too late to hide");
    });

    it("scrubs bodies stored before the scrub existed, once, on the next start", async () => {
        const name = eventIndexDbName(USER, DEVICE);
        const factory = globalThis.indexedDB as unknown as ReturnType<
            typeof makeFakeIdb
        >;
        // A v3 index with a tail holding a redacted body and its tombstone.
        await new Promise<void>((resolve) => {
            const open = factory.open(name, 3) as unknown as {
                result: {
                    createObjectStore(
                        n: string,
                        o: object,
                    ): { createIndex(i: string, k: string): unknown };
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
                const tx = open.result.transaction(
                    ["tails", "redacted"],
                    "readwrite",
                );
                tx.objectStore("tails").put({
                    roomId: ENC_ROOM,
                    entries: [
                        {
                            e: "$gone",
                            s: "@a:x",
                            t: 1,
                            m: "m.text",
                            b: "old secret",
                        },
                        { e: "$kept", s: "@a:x", t: 2, m: "m.text", b: "kept" },
                    ],
                });
                tx.objectStore("redacted").put({
                    eventId: "$gone",
                    roomId: ENC_ROOM,
                });
                tx.oncomplete = () => resolve();
            };
        });

        addRoom(ENC_ROOM, 1000);
        startEventIndex();
        // The body goes first; the flag is written after it, so wait for both.
        await vi.waitFor(async () => {
            expect(await storedBodies()).not.toContain("old secret");
            const meta = factory.dbs.get(name)!.stores.get("meta");
            expect(meta?.rows.has("redaction-scrub")).toBe(true);
        });
        expect(await storedBodies()).toContain("kept");
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

        remember("$old");
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

// ── Format 2: migration, dedup, compaction, placeholders, peer import ──────

function storesOf() {
    const factory = globalThis.indexedDB as unknown as ReturnType<
        typeof makeFakeIdb
    >;
    return factory.dbs.get(eventIndexDbName(USER, DEVICE))!.stores;
}

/** A format 1 block row: deflate-raw JSON, as the older build stored it. */
async function legacyRow(entries: Record<string, unknown>[], roomId: string) {
    const json = new TextEncoder().encode(JSON.stringify(entries));
    const stream = new CompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    void writer.write(json).then(() => writer.close());
    const data = new Uint8Array(
        await new Response(stream.readable).arrayBuffer(),
    );
    const ts = entries.map((e) => e.t as number);
    return {
        z: true,
        data,
        roomId,
        count: entries.length,
        minTs: Math.min(...ts),
        maxTs: Math.max(...ts),
    };
}

/** Writes an index as the version 4 build left it (legacy rows only). */
async function seedV4(rows: {
    blocks: Record<string, unknown>[];
    tails: Record<string, unknown>[];
    redacted: Record<string, unknown>[];
}): Promise<void> {
    const name = eventIndexDbName(USER, DEVICE);
    const factory = globalThis.indexedDB as unknown as ReturnType<
        typeof makeFakeIdb
    >;
    await new Promise<void>((resolve) => {
        const open = factory.open(name, 4) as unknown as {
            result: {
                createObjectStore(
                    n: string,
                    o: object,
                ): { createIndex(i: string, k: string): unknown };
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
            db.createObjectStore("meta", { keyPath: "key" });
        };
        open.onsuccess = () => {
            const tx = open.result.transaction(
                ["blocks", "tails", "redacted"],
                "readwrite",
            );
            for (const r of rows.blocks) tx.objectStore("blocks").put(r);
            for (const r of rows.tails) tx.objectStore("tails").put(r);
            for (const r of rows.redacted) tx.objectStore("redacted").put(r);
            tx.oncomplete = () => resolve();
        };
    });
}

describe("format 2 migration", () => {
    it("rewrites legacy rows, dropping duplicates and tombstoned messages", async () => {
        const e = (id: string, t: number, b: string, o?: string) => ({
            e: id,
            s: "@a:x",
            t,
            m: "m.text",
            b,
            ...(o ? { o } : {}),
        });
        await seedV4({
            blocks: [
                await legacyRow(
                    [e("$1", 1, "needle one"), e("$2", 2, "needle two")],
                    ENC_ROOM,
                ),
                await legacyRow(
                    [
                        e("$1", 1, "needle one"),
                        e("$3", 3, "needle three"),
                        e("$gone", 4, "needle secret"),
                    ],
                    ENC_ROOM,
                ),
            ],
            tails: [
                {
                    roomId: ENC_ROOM,
                    entries: [
                        e("$4", 5, "needle four"),
                        e("$5", 6, "needle two edited", "$2"),
                        e("$3", 3, "needle three"),
                    ],
                },
            ],
            redacted: [{ eventId: "$gone", roomId: ENC_ROOM }],
        });
        addRoom(ENC_ROOM, 1000);
        startEventIndex();
        const meta = storesOf().get("meta")!;
        await vi.waitFor(() =>
            expect(meta.rows.has("format-2-migration")).toBe(true),
        );

        expect(
            [...storesOf().get("blocks")!.rows.values()].every(
                (r) => r.fmt === 2,
            ),
        ).toBe(true);
        expect(
            [...storesOf().get("tails")!.rows.values()].every(
                (r) => r.fmt === 2,
            ),
        ).toBe(true);
        expect((await storedBodies()).sort()).toEqual(
            [
                "needle four",
                "needle one",
                "needle three",
                "needle two",
                "needle two edited",
            ].sort(),
        );
        const hits = await searchLocalIndex(
            ENC_ROOM,
            parseSearchQuery("needle"),
        );
        expect(hits.events.map((ev) => ev.getContent().body)).toEqual([
            "needle four",
            "needle three",
            "needle two edited",
            "needle one",
        ]);
        expect(
            hits.events.every((ev) => isIndexPlaceholderId(ev.getId()!)),
        ).toBe(true);
    });
});

describe("dedup", () => {
    it("does not store a message again after a restart", async () => {
        addRoom(ENC_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            {
                chunk: [plainRaw("$a", ENC_ROOM, 500, "once only")],
                end: null,
            },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        stopEventIndex();

        startEventIndex();
        const live = new MatrixEvent({
            type: "m.room.message",
            event_id: "$a",
            room_id: ENC_ROOM,
            sender: "@alice:x",
            origin_server_ts: 500,
            content: { msgtype: "m.text", body: "once only" },
        });
        client.emit(RoomEvent.Timeline, live, { roomId: ENC_ROOM });
        expect((await readEntriesInRanges(ENC_ROOM, [ALL])).length).toBe(1);
        expect(await storedBodies()).toEqual(["once only"]);
    });
});

describe("block compaction", () => {
    it("merges small blocks, and search still finds every message", async () => {
        addRoom(ENC_ROOM, 1000);
        // 2250 messages in one page: nine blocks of 250, all small.
        const chunk = Array.from({ length: 2250 }, (_, i) =>
            plainRaw(`$c${i}`, ENC_ROOM, 1000 + i, `hello ${i}`),
        );
        client.script.set(ENC_ROOM, [{ chunk, end: null }]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);

        expect(storesOf().get("blocks")!.rows.size).toBe(1);
        const all = await readEntriesInRanges(ENC_ROOM, [ALL]);
        expect(all).toHaveLength(2250);
        expect(new Set(all.map((e) => e.h)).size).toBe(2250);
        expect((await storedBodies()).length).toBe(2250);

        const hits = await searchLocalIndex(
            ENC_ROOM,
            parseSearchQuery("hello"),
        );
        expect(hits.events.map((ev) => ev.getTs())).toEqual(
            all
                .map((e) => e.t)
                .sort((a, b) => b - a)
                .slice(0, 500),
        );
    });
});

describe("placeholder ids", () => {
    it("gives a local hit a placeholder that parses back to the message", async () => {
        addRoom(ENC_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            {
                chunk: [plainRaw("$a", ENC_ROOM, 500, "hello there")],
                end: null,
            },
        ]);
        startEventIndex();
        await crawlOnceForTests();
        const hits = await searchLocalIndex(
            ENC_ROOM,
            parseSearchQuery("hello"),
        );
        expect(parseIndexPlaceholderId(hits.events[0].getId()!)).toEqual({
            h: eventIdHash("$a"),
            t: 500,
        });
    });
});

describe("peer import", () => {
    it("adds a peer's entries once, and reads them back", async () => {
        addRoom(ENC_ROOM, 1000);
        startEventIndex();
        const peer: CompactEntry[] = [
            {
                h: eventIdHash("$p1"),
                s: "@a:x",
                t: 100,
                m: "m.text",
                b: "from a peer",
            },
        ];
        expect(await importPeerEntries(ENC_ROOM, [0, 1000], peer)).toBe(1);
        expect(await importPeerEntries(ENC_ROOM, [0, 1000], peer)).toBe(0);
        expect(
            (await readEntriesInRanges(ENC_ROOM, [[0, 1000]])).map((e) => e.b),
        ).toEqual(["from a peer"]);
    });
});

// ── Matching uses (hash, timestamp) ────────────────────────────────────────

/** Two different event ids with the same 32-bit hash (found by search). */
function collidingIds(): [string, string] {
    const seen = new Map<number, string>();
    for (let i = 0; ; i++) {
        const id = `$k${i}`;
        const prev = seen.get(eventIdHash(id));
        if (prev !== undefined) return [prev, id];
        seen.set(eventIdHash(id), id);
    }
}

function editRaw(id: string, original: string, ts: number, body: string) {
    return {
        event_id: remember(id),
        room_id: ENC_ROOM,
        type: "m.room.message",
        sender: "@alice:x",
        origin_server_ts: ts,
        content: {
            msgtype: "m.text",
            body: `* ${body}`,
            "m.relates_to": { rel_type: "m.replace", event_id: original },
            "m.new_content": { msgtype: "m.text", body },
        },
    };
}

describe("matching uses the timestamp, not the hash alone", () => {
    it("a redaction removes only the message with its timestamp", async () => {
        const [A, B] = collidingIds();
        addRoom(ENC_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            {
                chunk: [
                    plainRaw(A, ENC_ROOM, 500, "first"),
                    plainRaw(B, ENC_ROOM, 600, "second"),
                ],
                end: null,
            },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);

        client.loaded.add(A);
        client.emit(RoomEvent.Timeline, redactionOf(A, ENC_ROOM), {
            roomId: ENC_ROOM,
        });
        await vi.waitFor(async () =>
            expect(
                (await readEntriesInRanges(ENC_ROOM, [ALL])).map((e) => e.t),
            ).toEqual([600]),
        );
        const tombs = [...storesOf().get("redacted")!.rows.values()];
        expect(tombs).toEqual([{ eventId: A, roomId: ENC_ROOM, ts: 500 }]);
    });

    it("an edit takes its original's time from the loaded event", async () => {
        addRoom(ENC_ROOM, 1000);
        client.loaded.add("$orig");
        client.script.set(ENC_ROOM, [
            {
                chunk: [
                    plainRaw("$orig", ENC_ROOM, 500, "first"),
                    editRaw("$edit", "$orig", 900, "second"),
                ],
                end: null,
            },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        const edit = (await readEntriesInRanges(ENC_ROOM, [ALL])).find(
            (e) => e.t === 900,
        );
        expect(edit?.ot).toBe(500);
    });

    it("an edit takes its original's time from the server when not loaded", async () => {
        addRoom(ENC_ROOM, 1000);
        client.fetched.set("$orig", 500);
        client.script.set(ENC_ROOM, [
            {
                chunk: [
                    plainRaw("$orig", ENC_ROOM, 500, "first"),
                    editRaw("$edit", "$orig", 900, "second"),
                ],
                end: null,
            },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        const edit = (await readEntriesInRanges(ENC_ROOM, [ALL])).find(
            (e) => e.t === 900,
        );
        expect(edit?.ot).toBe(500);
    });

    it("an edit whose original's time is unknown is stored without one", async () => {
        addRoom(ENC_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            { chunk: [editRaw("$edit", "$gone", 900, "lonely")], end: null },
        ]);
        startEventIndex();
        expect(await crawlOnceForTests()).toBe(true);
        const [edit] = await readEntriesInRanges(ENC_ROOM, [ALL]);
        expect(edit.b).toBe("lonely");
        expect(edit).not.toHaveProperty("ot");
    });

    it("a legacy chunk's edit takes its original's time from the server", async () => {
        client.fetched.set("$orig", 500);
        const edit: CompactEntry = {
            h: eventIdHash("$edit"),
            s: "@a:x",
            t: 900,
            m: "m.text",
            b: "x",
            o: eventIdHash("$orig"),
        };
        await resolveOriginTimes(
            ENC_ROOM,
            [{ entry: edit, original: "$orig" }],
            () => true,
        );
        expect(edit.ot).toBe(500);
    });
});

// ── Retries of failed timestamp lookups ────────────────────────────────────

function tombRow(eventId: string) {
    return [...storesOf().get("redacted")!.rows.values()].find(
        (r) => r.eventId === eventId,
    );
}

function originsRow() {
    return storesOf()
        .get("meta")!
        .rows.get("origins:" + ENC_ROOM);
}

describe("failed lookups are retried", () => {
    it("a redaction whose lookup failed is pending, hides nothing by hash, and is applied on retry", async () => {
        addRoom(ENC_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            {
                chunk: [plainRaw("$t", ENC_ROOM, 500, "hunter9 pending")],
                end: null,
            },
        ]);
        startEventIndex();
        await crawlOnceForTests();

        client.failing.set("$t", "error");
        client.emit(RoomEvent.Timeline, redactionOf("$t", ENC_ROOM), {
            roomId: ENC_ROOM,
        });
        await vi.waitFor(async () => {
            await readEntriesInRanges(ENC_ROOM, [ALL]);
            expect(tombRow("$t")).toEqual({
                eventId: "$t",
                roomId: ENC_ROOM,
                pending: true,
            });
        });
        // A pending tombstone matches nothing by hash: the message still shows.
        const hits = await searchLocalIndex(
            ENC_ROOM,
            parseSearchQuery("hunter9"),
        );
        expect(hits.events).toHaveLength(1);
        expect(await storedBodies()).toContain("hunter9 pending");

        client.failing.delete("$t");
        client.fetched.set("$t", 500);
        await runPendingRetries({ force: true });
        expect(tombRow("$t")).toEqual({
            eventId: "$t",
            roomId: ENC_ROOM,
            ts: 500,
        });
        expect(await storedBodies()).not.toContain("hunter9 pending");
    });

    it("a redaction the server answers as not-found clears its pending mark", async () => {
        addRoom(ENC_ROOM, 1000);
        client.script.set(ENC_ROOM, [
            { chunk: [plainRaw("$n", ENC_ROOM, 500, "gone soon")], end: null },
        ]);
        startEventIndex();
        await crawlOnceForTests();

        client.failing.set("$n", "error");
        client.emit(RoomEvent.Timeline, redactionOf("$n", ENC_ROOM), {
            roomId: ENC_ROOM,
        });
        await vi.waitFor(async () => {
            await readEntriesInRanges(ENC_ROOM, [ALL]);
            expect(tombRow("$n")).toHaveProperty("pending", true);
        });

        client.failing.set("$n", "notfound");
        await runPendingRetries({ force: true });
        expect(tombRow("$n")).toEqual({ eventId: "$n", roomId: ENC_ROOM });
    });

    it("an edit whose original's lookup failed is retried, then linked", async () => {
        addRoom(ENC_ROOM, 1000);
        client.failing.set("$o", "error");
        client.script.set(ENC_ROOM, [
            {
                chunk: [
                    plainRaw("$o", ENC_ROOM, 500, "first"),
                    editRaw("$ed", "$o", 900, "second"),
                ],
                end: null,
            },
        ]);
        startEventIndex();
        await crawlOnceForTests();
        await readEntriesInRanges(ENC_ROOM, [ALL]);
        expect(originsRow()).toHaveProperty("list.length", 1);
        const before = (await readEntriesInRanges(ENC_ROOM, [ALL])).find(
            (e) => e.t === 900,
        );
        expect(before?.ot).toBeUndefined();

        client.failing.delete("$o");
        client.fetched.set("$o", 500);
        await runPendingRetries({ force: true });
        const after = (await readEntriesInRanges(ENC_ROOM, [ALL])).find(
            (e) => e.t === 900,
        );
        expect(after?.ot).toBe(500);
        expect(originsRow()).toBeUndefined();
    });

    it("an edit whose original the server answers as not-found drops its pending entry", async () => {
        addRoom(ENC_ROOM, 1000);
        client.failing.set("$o2", "error");
        client.script.set(ENC_ROOM, [
            { chunk: [editRaw("$ed2", "$o2", 900, "lonely")], end: null },
        ]);
        startEventIndex();
        await crawlOnceForTests();
        await readEntriesInRanges(ENC_ROOM, [ALL]);
        expect(originsRow()).toBeDefined();

        client.failing.set("$o2", "notfound");
        await runPendingRetries({ force: true });
        expect(originsRow()).toBeUndefined();
        const [edit] = await readEntriesInRanges(ENC_ROOM, [ALL]);
        expect(edit).not.toHaveProperty("ot");
    });
});
