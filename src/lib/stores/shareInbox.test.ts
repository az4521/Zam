import { describe, it, expect, vi, beforeEach } from "vitest";

if (!globalThis.URL.createObjectURL)
    globalThis.URL.createObjectURL = () => "blob:test";

const openModal = vi.fn(() => 1);
const clearModalIfOwner = vi.fn(() => true);
vi.mock("$lib/stores/interface.svelte", () => ({
    // @ts-ignore - vitest mock wrapper
    openModal: (...a: unknown[]) => openModal(...a),
    // @ts-ignore - vitest mock wrapper
    clearModalIfOwner: (...a: unknown[]) => clearModalIfOwner(...a),
}));

const navigateToRoom = vi.fn();
const roomsState = { activeRoomId: null as string | null };
vi.mock("$lib/stores/rooms.svelte", () => ({
    // @ts-ignore - vitest mock wrapper
    navigateToRoom: (...a: unknown[]) => navigateToRoom(...a),
    get roomsState() {
        return roomsState;
    },
}));

const getDraft = vi.fn(() => null);
const setDraft = vi.fn();
vi.mock("$lib/stores/composerDrafts.svelte", () => ({
    // @ts-ignore - vitest mock wrapper
    getDraft: (...a: unknown[]) => getDraft(...a),
    // @ts-ignore - vitest mock wrapper
    setDraft: (...a: unknown[]) => setDraft(...a),
}));

vi.mock("$lib/utils/composerInsert", () => ({
    composerInsertText: (a: string, b: string) => (a ? a + " " + b : b),
}));

const addQueuedFile = vi.fn();
vi.mock("$lib/stores/composerFileQueue.svelte", () => ({
    // @ts-ignore - vitest mock wrapper
    addQueuedFile: (...a: unknown[]) => addQueuedFile(...a),
}));

const hostBridge = { insertText: null as null | ((c: unknown) => void) };
vi.mock("$lib/plugins/hostBridge", () => ({
    get hostBridge() {
        return hostBridge;
    },
}));

import {
    receiveShare,
    deliverShareToRoom,
    shareInboxState,
    clearShare,
} from "./shareInbox.svelte";

describe("shareInbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        roomsState.activeRoomId = null;
        hostBridge.insertText = null;
        shareInboxState.payload = null;
    });

    it("rejects an empty share (no modal)", () => {
        expect(receiveShare({ source: "web", text: "" })).toBe(false);
        expect(shareInboxState.payload).toBeNull();
        expect(openModal).not.toHaveBeenCalled();
    });

    it("opens the picker for a text share (claims slot then sets payload)", () => {
        expect(
            receiveShare({ source: "web", text: "hi", url: "https://x.dev" }),
        ).toBe(true);
        expect(openModal).toHaveBeenCalledWith(
            "share-target",
            expect.any(Function),
        );
        expect(shareInboxState.payload).toEqual({
            kind: "text",
            text: "hi\nhttps://x.dev",
        });
    });

    it("delivers text to a non-active room via the draft store, merged", () => {
        (getDraft as any).mockReturnValueOnce({
            text: "existing",
            mentions: [],
        });
        receiveShare({ source: "web", text: "shared" });
        deliverShareToRoom("!r:x");
        expect(setDraft).toHaveBeenCalledWith(
            "!r:x",
            "existing shared",
            expect.any(Map),
        );
        expect(navigateToRoom).toHaveBeenCalledWith("!r:x");
        expect(shareInboxState.payload).toBeNull();
    });

    it("delivers text to the ACTIVE room via hostBridge.insertText", () => {
        const insert = vi.fn();
        hostBridge.insertText = insert;
        roomsState.activeRoomId = "!r:x";
        receiveShare({ source: "android", text: "yo" });
        deliverShareToRoom("!r:x");
        expect(insert).toHaveBeenCalledWith({ roomId: "!r:x", text: "yo" });
        expect(setDraft).not.toHaveBeenCalled();
    });

    it("stages every file for a file share", () => {
        const a = new File([new Uint8Array([1])], "a.png", {
            type: "image/png",
        });
        const b = new File([new Uint8Array([2])], "b.bin", {
            type: "application/octet-stream",
        });
        receiveShare({ source: "web", text: "", files: [a, b] });
        deliverShareToRoom("!r:x");
        expect(addQueuedFile).toHaveBeenCalledTimes(2);
        expect(addQueuedFile).toHaveBeenNthCalledWith(
            1,
            "!r:x",
            a,
            "a.png",
            expect.any(String),
        );
        expect(addQueuedFile).toHaveBeenNthCalledWith(
            2,
            "!r:x",
            b,
            "b.bin",
            null,
        );
    });
});
