import { describe, it, expect } from "vitest";
import {
    VIDEO_ROOM_TYPE,
    VIDEO_ROOM_TYPES,
    isVideoRoomType,
    videoRoomCreationContent,
} from "./videoRoom";

describe("VIDEO_ROOM_TYPE", () => {
    it("is the type this client writes into m.room.create", () => {
        // Pinned deliberately: m.room.create is immutable, so changing this
        // value silently orphans every room already created with the old one.
        expect(VIDEO_ROOM_TYPE).toBe("m.video_room");
    });

    it("is itself recognised on the read side", () => {
        expect(VIDEO_ROOM_TYPES).toContain(VIDEO_ROOM_TYPE);
    });
});

describe("isVideoRoomType", () => {
    it("recognises the type we write", () => {
        expect(isVideoRoomType("m.video_room")).toBe(true);
    });

    it("recognises Element Call's unstable MSC3417 type", () => {
        expect(isVideoRoomType("org.matrix.msc3417.call")).toBe(true);
    });

    it("recognises Element's legacy video-room type", () => {
        expect(isVideoRoomType("io.element.video")).toBe(true);
    });

    it("does not treat a space as a video room", () => {
        expect(isVideoRoomType("m.space")).toBe(false);
    });

    it("treats an ordinary room (no type) as not a video room", () => {
        expect(isVideoRoomType(undefined)).toBe(false);
        expect(isVideoRoomType(null)).toBe(false);
        expect(isVideoRoomType("")).toBe(false);
    });

    it("does not match an unknown type", () => {
        expect(isVideoRoomType("com.example.something")).toBe(false);
    });

    it("is exact, not a prefix or substring match", () => {
        expect(isVideoRoomType("m.video_room.v2")).toBe(false);
        expect(isVideoRoomType("x.m.video_room")).toBe(false);
    });
});

describe("videoRoomCreationContent", () => {
    it("produces the creation_content for a video room", () => {
        expect(videoRoomCreationContent(true)).toEqual({
            type: "m.video_room",
        });
    });

    it("produces undefined for an ordinary room so callers can omit creation_content entirely", () => {
        expect(videoRoomCreationContent(false)).toBeUndefined();
    });
});
