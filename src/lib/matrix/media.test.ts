import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const slot = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("./runtime", () => ({
    get matrixClient() {
        return slot.client;
    },
    captureClient: () => {
        if (!slot.client) throw new Error("Not logged in");
        return { client: slot.client, generation: 1 };
    },
    ownedClientOrThrow: (owner: { client: unknown }) => owner.client,
}));
vi.mock("./client", () => ({
    threadRelationParams: (_roomId: string, rootEventId: string) => ({
        rootEventId,
        latestEventId: "$latest",
    }),
}));
vi.mock("$lib/matrix/crypto", () => ({
    isRoomEncrypted: () => false,
    isRoomEncryptedForSend: async () => false,
}));

const faststart = vi.hoisted(() => ({
    fn: vi.fn(
        async (f: File) =>
            new File([f], f.name, { type: f.type, lastModified: 1 }),
    ),
}));
vi.mock("$lib/utils/mp4Faststart", () => ({ faststartMp4: faststart.fn }));

import { sendFile } from "./media";
import { setFaststartVideos } from "$lib/stores/settings.svelte";

function makeClient() {
    return {
        getMediaConfig: vi.fn().mockResolvedValue({}),
        uploadContent: vi
            .fn()
            .mockResolvedValue({ content_uri: "mxc://s/file" }),
        sendMessage: vi.fn().mockResolvedValue({ event_id: "$e" }),
    };
}

function sentContent(client: ReturnType<typeof makeClient>) {
    return client.sendMessage.mock.calls[0][1] as Record<string, unknown>;
}

beforeEach(() => {
    slot.client = makeClient();
});

describe("sendFile content transform", () => {
    const file = new File(["x"], "notes.txt", { type: "text/plain" });

    it("sends the untransformed content when no transform is given", async () => {
        await sendFile("!r", file, { body: "hello" });
        const content = sentContent(
            slot.client as ReturnType<typeof makeClient>,
        );
        expect(content.body).toBe("hello");
        expect(content.filename).toBe("notes.txt");
    });

    it("runs the transform over the fully-built caption content", async () => {
        const transform = vi.fn((c: Record<string, unknown>) => ({
            ...c,
            body: `${c.body as string}!`,
            "com.example.tag": true,
        }));
        await sendFile("!r", file, { body: "hello" }, undefined, transform);
        const seen = transform.mock.calls[0][0];
        expect(seen.url).toBe("mxc://s/file");
        expect(seen.filename).toBe("notes.txt");
        const content = sentContent(
            slot.client as ReturnType<typeof makeClient>,
        );
        expect(content.body).toBe("hello!");
        expect(content["com.example.tag"]).toBe(true);
    });

    it("hands a thread caption to the transform with its thread relation", async () => {
        const transform = vi.fn((c: Record<string, unknown>) => c);
        await sendFile(
            "!r",
            file,
            { body: "hello" },
            { rootEventId: "$root" },
            transform,
        );
        const seen = transform.mock.calls[0][0];
        expect(seen["m.relates_to"]).toMatchObject({
            rel_type: "m.thread",
            event_id: "$root",
        });
        const content = sentContent(
            slot.client as ReturnType<typeof makeClient>,
        );
        expect(content["m.relates_to"]).toMatchObject({
            rel_type: "m.thread",
            event_id: "$root",
        });
    });

    it("sends a captioned file as a reply", async () => {
        await sendFile("!r", file, { body: "hello" }, { replyToEventId: "$q" });
        const content = sentContent(
            slot.client as ReturnType<typeof makeClient>,
        );
        expect(content["m.relates_to"]).toEqual({
            "m.in_reply_to": { event_id: "$q" },
        });
        expect(content.body).toBe("hello");
    });
});

describe("sendFile video faststart", () => {
    const video = new File(["v"], "clip.mp4", { type: "video/mp4" });
    const uploaded = () =>
        (slot.client as ReturnType<typeof makeClient>).uploadContent.mock
            .calls[0][0] as File;

    // The thumbnail step needs a real <video>, which jsdom does not have, so
    // sendFile rejects after the upload. The upload is what these tests are about.
    const send = (f: File) => sendFile("!r", f).catch(() => undefined);

    const realCreateObjectURL = URL.createObjectURL;

    beforeEach(() => {
        faststart.fn.mockClear();
        setFaststartVideos(true);
        // Make the thumbnail step fail at once instead of waiting forever on a
        // video element that never reports anything.
        URL.createObjectURL = () => {
            throw new Error("no object URLs in tests");
        };
    });

    afterEach(() => {
        URL.createObjectURL = realCreateObjectURL;
    });

    it("uploads the rewritten file when the setting is on", async () => {
        await send(video);
        expect(faststart.fn).toHaveBeenCalledWith(video);
        expect(uploaded()).not.toBe(video);
        expect(uploaded().lastModified).toBe(1);
    });

    it("uploads the original, untouched, when the setting is off", async () => {
        setFaststartVideos(false);
        await send(video);
        expect(faststart.fn).not.toHaveBeenCalled();
        expect(uploaded()).toBe(video);
    });

    it("leaves non-video files alone", async () => {
        const doc = new File(["x"], "notes.txt", { type: "text/plain" });
        await send(doc);
        expect(faststart.fn).not.toHaveBeenCalled();
        expect(uploaded()).toBe(doc);
    });
});
