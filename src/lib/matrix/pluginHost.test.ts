import { beforeEach, describe, expect, it, vi } from "vitest";

// A controllable client slot: `slot.client`/`slot.generation` stand in for the
// runtime's live bindings, so a test can "switch accounts" between calls.
const slot = vi.hoisted(() => ({
    client: null as unknown,
    generation: 0,
}));

vi.mock("./runtime", () => ({
    get matrixClient() {
        return slot.client;
    },
    captureClient: () => {
        if (!slot.client) throw new Error("Not logged in");
        return { client: slot.client, generation: slot.generation };
    },
    ownedClientOrThrow: (owner: { client: unknown; generation: number }) => {
        if (
            owner.client !== slot.client ||
            owner.generation !== slot.generation
        )
            throw new Error("Session changed before the operation finished");
        return owner.client;
    },
}));
vi.mock("./client", () => ({
    threadRelationParams: vi.fn(),
}));

import {
    sendEventContent,
    sendPluginSticker,
    uploadPluginMedia,
} from "./pluginHost";

function makeClient(mxc: string) {
    return {
        uploadContent: vi.fn().mockResolvedValue({ content_uri: mxc }),
        sendMessage: vi.fn().mockResolvedValue({ event_id: "$e" }),
        sendEvent: vi.fn().mockResolvedValue({ event_id: "$s" }),
    };
}

function switchAccount(client: unknown): void {
    slot.client = client;
    slot.generation += 1;
}

beforeEach(() => {
    slot.client = null;
    slot.generation = 0;
});

describe("plugin upload→send owner guard", () => {
    it("sends an mxc uploaded by the same account", async () => {
        const a = makeClient("mxc://a/1");
        switchAccount(a);
        const mxc = await uploadPluginMedia(new Blob(["x"]), "x.png");
        await sendEventContent("!r", { msgtype: "m.image", url: mxc });
        expect(a.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("refuses to send A's upload after switching to B", async () => {
        const a = makeClient("mxc://a/2");
        const b = makeClient("mxc://b/1");
        switchAccount(a);
        const mxc = await uploadPluginMedia(new Blob(["x"]), "x.png");
        switchAccount(b);
        await expect(
            sendEventContent("!r", { msgtype: "m.image", url: mxc }),
        ).rejects.toThrow(/different account/);
        expect(b.sendMessage).not.toHaveBeenCalled();
    });

    it("refuses an upload whose account switched mid-upload", async () => {
        const a = makeClient("mxc://a/3");
        const b = makeClient("mxc://b/2");
        switchAccount(a);
        a.uploadContent.mockImplementation(async () => {
            switchAccount(b);
            return { content_uri: "mxc://a/3" };
        });
        const mxc = await uploadPluginMedia(new Blob(["x"]), "x.png");
        await expect(
            sendEventContent("!r", { msgtype: "m.image", url: mxc }),
        ).rejects.toThrow(/different account/);
    });

    it("refuses a sticker send of A's upload as B", async () => {
        const a = makeClient("mxc://a/4");
        const b = makeClient("mxc://b/3");
        switchAccount(a);
        const mxc = await uploadPluginMedia(new Blob(["x"]), "s.png");
        switchAccount(b);
        await expect(sendPluginSticker("!r", { mxcUrl: mxc })).rejects.toThrow(
            /different account/,
        );
        expect(b.sendEvent).not.toHaveBeenCalled();
    });

    it("still sends media the host never uploaded", async () => {
        const b = makeClient("mxc://b/4");
        switchAccount(b);
        await sendEventContent("!r", {
            msgtype: "m.image",
            url: "mxc://pack/sticker",
        });
        expect(b.sendMessage).toHaveBeenCalledTimes(1);
    });
});
