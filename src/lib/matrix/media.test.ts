import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const slot = vi.hoisted(() => ({ client: null as unknown }));
const room = vi.hoisted(() => ({ encrypted: false }));

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
    isRoomEncrypted: () => room.encrypted,
    isRoomEncryptedForSend: async () => room.encrypted,
}));

const faststart = vi.hoisted(() => ({
    fn: vi.fn(
        async (f: File) =>
            new File([f], f.name, { type: f.type, lastModified: 1 }),
    ),
}));
vi.mock("$lib/utils/mp4Faststart", () => ({ faststartMp4: faststart.fn }));

import { sendExistingMedia, sendFile } from "./media";
import type { ReusableMedia } from "./favouriteFile";
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
    room.encrypted = false;
});

describe("sendExistingMedia", () => {
    const client = () => slot.client as ReturnType<typeof makeClient>;
    const plain: ReusableMedia = {
        url: "mxc://s/original",
        info: { mimetype: "image/gif", size: 9, w: 4, h: 3 },
    };
    const encryptedFile = {
        url: "mxc://s/secret",
        key: { k: "KEY", kty: "oct", alg: "A256CTR", ext: true },
        iv: "IV",
        hashes: { sha256: "HASH" },
        v: "v2",
    };
    const encrypted: ReusableMedia = {
        file: encryptedFile,
        info: { mimetype: "image/png", size: 9 },
    };

    it("points a new m.image at plaintext media without uploading", async () => {
        expect(await sendExistingMedia("!r", plain, "cat.gif")).toBe(true);
        expect(client().uploadContent).not.toHaveBeenCalled();
        expect(sentContent(client())).toEqual({
            msgtype: "m.image",
            body: "cat.gif",
            url: "mxc://s/original",
            info: { mimetype: "image/gif", size: 9, w: 4, h: 3 },
            "m.mentions": {},
        });
    });

    it("sends encrypted media in an encrypted room, without uploading", async () => {
        room.encrypted = true;
        expect(await sendExistingMedia("!r", encrypted, "cat.png")).toBe(true);
        expect(client().uploadContent).not.toHaveBeenCalled();
        const content = sentContent(client());
        expect(content.file).toEqual(encryptedFile);
        expect(content).not.toHaveProperty("url");
    });

    it("sends nothing for encrypted media in a plaintext room", async () => {
        expect(await sendExistingMedia("!r", encrypted, "cat.png")).toBe(false);
        expect(client().sendMessage).not.toHaveBeenCalled();
        expect(client().uploadContent).not.toHaveBeenCalled();
    });

    it("refuses media that has neither a url nor a file", async () => {
        expect(
            await sendExistingMedia("!r", { info: {} } as ReusableMedia, "x"),
        ).toBe(false);
        expect(client().sendMessage).not.toHaveBeenCalled();
    });

    it("builds caption fields the way sendFile does", async () => {
        await sendExistingMedia("!r", plain, "cat.gif", {
            body: "look",
            formattedBody: "<b>look</b>",
            mentions: { room: true },
        });
        expect(sentContent(client())).toMatchObject({
            body: "look",
            filename: "cat.gif",
            format: "org.matrix.custom.html",
            formatted_body: "<b>look</b>",
            "m.mentions": { room: true },
        });
    });

    it("applies the transform and the thread relation, and waits before sending", async () => {
        const order: string[] = [];
        const transform = vi.fn((c: Record<string, unknown>) => {
            order.push("transform");
            return { ...c, "com.example.tag": true };
        });
        const beforeSend = vi.fn(async () => {
            order.push("ready");
        });
        await sendExistingMedia(
            "!r",
            plain,
            "cat.gif",
            undefined,
            { rootEventId: "$root" },
            transform,
            beforeSend,
        );
        expect(order).toEqual(["transform", "ready"]);
        const content = sentContent(client());
        expect(content["com.example.tag"]).toBe(true);
        expect(content["m.relates_to"]).toMatchObject({
            rel_type: "m.thread",
            event_id: "$root",
        });
    });
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
