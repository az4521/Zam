import { describe, expect, it } from "vitest";
import {
    CHANNEL_KEY,
    channelIconKind,
    parseBridgedChannel,
    parseSpaceChildChannel,
} from "./bridgedChannels";

describe("parseBridgedChannel", () => {
    it("reads type and name", () => {
        expect(parseBridgedChannel({ type: "voice", name: "General" })).toEqual(
            { type: "voice", name: "General" },
        );
    });

    it("keeps an unknown type as null so a newer bridge still parses", () => {
        expect(parseBridgedChannel({ type: "hologram", name: "x" })).toEqual({
            type: null,
            name: "x",
        });
    });

    it("tolerates a missing or blank name", () => {
        expect(parseBridgedChannel({ type: "text" })).toEqual({
            type: "text",
            name: "",
        });
        expect(parseBridgedChannel({ type: "text", name: "  " })?.name).toBe(
            "",
        );
    });

    it("rejects content without a type", () => {
        expect(parseBridgedChannel({ name: "x" })).toBeNull();
        expect(parseBridgedChannel(null)).toBeNull();
        expect(parseBridgedChannel(["text"])).toBeNull();
    });
});

describe("parseSpaceChildChannel", () => {
    it("reads the tag on a live space child only", () => {
        const tag = { type: "stage", name: "Town hall" };
        expect(
            parseSpaceChildChannel({ via: ["x"], [CHANNEL_KEY]: tag }),
        ).toEqual(tag);
        expect(parseSpaceChildChannel({ [CHANNEL_KEY]: tag })).toBeNull();
        expect(parseSpaceChildChannel({ via: ["x"] })).toBeNull();
    });
});

describe("channelIconKind", () => {
    it("maps every bridge type", () => {
        expect(channelIconKind("text")).toBe("text");
        expect(channelIconKind("voice")).toBe("voice");
        expect(channelIconKind("stage")).toBe("stage");
        expect(channelIconKind("announcement")).toBe("announcement");
        expect(channelIconKind("forum")).toBe("forum");
        expect(channelIconKind("media")).toBe("media");
        expect(channelIconKind("public_thread")).toBe("thread");
        expect(channelIconKind("announcement_thread")).toBe("thread");
        expect(channelIconKind("private_thread")).toBe("private_thread");
    });

    it("prefers the bridge type over the room's own hints", () => {
        expect(channelIconKind("voice", { isVideo: true })).toBe("voice");
    });

    it("falls back to thread, then video, then text", () => {
        expect(channelIconKind(null, { isThread: true, isVideo: true })).toBe(
            "thread",
        );
        expect(channelIconKind(undefined, { isVideo: true })).toBe("video");
        expect(channelIconKind(null)).toBe("text");
    });
});
