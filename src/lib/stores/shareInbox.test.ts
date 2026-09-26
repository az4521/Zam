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

const hostBridge = {
    insertText: null as null | ((c: unknown) => void),
};
vi.mock("$lib/plugins/hostBridge", () => ({
    get hostBridge() {
        return hostBridge;
    },
}));

const sendShare = vi.fn(async () => {});
vi.mock("$lib/matrix/client", () => ({
    // @ts-ignore - vitest mock wrapper
    sendShare: (...a: unknown[]) => sendShare(...a),
}));

vi.mock("$lib/utils/shareSend", async (importOriginal) => {
    const orig = (await importOriginal()) as any;
    return orig;
});

const auth = { syncState: "SYNCING" as string | null };
vi.mock("$lib/stores/auth.svelte", () => ({
    get auth() {
        return auth;
    },
}));

vi.mock("$lib/utils/sendGating", async (importOriginal) => {
    const orig = (await importOriginal()) as any;
    return orig;
});

const showErrorToast = vi.fn();
vi.mock("$lib/stores/toasts.svelte", () => ({
    // @ts-ignore - vitest mock wrapper
    showErrorToast: (...a: unknown[]) => showErrorToast(...a),
}));

vi.mock("$lib/utils/knock", () => ({
    matrixErrorMessage: (err: unknown, fallback: string) =>
        err instanceof Error ? err.message : fallback,
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
        auth.syncState = "SYNCING";
        Object.defineProperty(navigator, "onLine", {
            writable: true,
            value: true,
        });
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

    it("overrides the payload text with an explicit caption", () => {
        receiveShare({ source: "web", text: "original" });
        deliverShareToRoom("!r:server", { caption: "edited caption" });
        // setDraft mock records the delivered text (non-active room path)
        expect(setDraft).toHaveBeenCalledWith(
            "!r:server",
            expect.stringContaining("edited caption"),
            expect.anything(),
        );
    });

    it("send path calls sendShare with exact caption and files, not setDraft/addQueuedFile", async () => {
        const f = new File([new Uint8Array([1])], "test.png");
        receiveShare({ source: "web", text: "caption", files: [f] });
        await deliverShareToRoom("!r:server", { send: true });
        expect(sendShare).toHaveBeenCalledWith(
            "!r:server",
            { caption: "caption", files: [f] },
            expect.any(Function),
        );
        expect(setDraft).not.toHaveBeenCalled();
        expect(addQueuedFile).not.toHaveBeenCalled();
        expect(navigateToRoom).toHaveBeenCalledWith("!r:server");
    });

    it("offline send path stages everything without calling sendShare", async () => {
        Object.defineProperty(navigator, "onLine", {
            writable: true,
            value: false,
        });
        const f = new File([new Uint8Array([1])], "a.png", {
            type: "image/png",
        });
        receiveShare({ source: "web", text: "hi", files: [f] });
        await deliverShareToRoom("!r:server", { send: true });
        expect(sendShare).not.toHaveBeenCalled();
        expect(setDraft).toHaveBeenCalled();
        expect(addQueuedFile).toHaveBeenCalledWith(
            "!r:server",
            f,
            "a.png",
            expect.any(String),
        );
        expect(showErrorToast).toHaveBeenCalledWith(
            "You're offline — the share was added to the composer",
        );
    });

    it("partial failure (1 of 2 files sent) stages only second file and no caption", async () => {
        const f1 = new File([new Uint8Array([1])], "a.png", {
            type: "image/png",
        });
        const f2 = new File([new Uint8Array([2])], "b.png", {
            type: "image/png",
        });
        receiveShare({ source: "web", text: "cap", files: [f1, f2] });

        // Mock sendShare to call onStepSent(0) then throw
        sendShare.mockImplementationOnce(async (roomId, share, onStepSent) => {
            onStepSent(0); // First file sent
            throw new Error("Network error");
        });

        await deliverShareToRoom("!r:server", { send: true });

        // Should stage only f2 (not f1) and no caption
        expect(addQueuedFile).toHaveBeenCalledTimes(1);
        expect(addQueuedFile).toHaveBeenCalledWith(
            "!r:server",
            f2,
            "b.png",
            expect.any(String),
        );
        expect(setDraft).not.toHaveBeenCalled(); // no text remainder
        expect(showErrorToast).toHaveBeenCalledWith("Network error");
    });

    it("non-send path still merges text and stages files", () => {
        const f = new File([new Uint8Array([1])], "test.png", {
            type: "image/png",
        });
        receiveShare({ source: "web", text: "text", files: [f] });
        deliverShareToRoom("!r:server");
        expect(setDraft).toHaveBeenCalled();
        expect(addQueuedFile).toHaveBeenCalledWith(
            "!r:server",
            f,
            "test.png",
            expect.any(String),
        );
        expect(sendShare).not.toHaveBeenCalled();
    });
});
