import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { sendFile } from "./media";

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
});
