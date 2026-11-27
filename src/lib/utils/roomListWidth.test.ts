import { describe, it, expect, beforeEach } from "vitest";
import {
    ROOM_LIST_WIDTH_KEY,
    clampRoomListWidth,
    loadRoomListWidth,
} from "./roomListWidth";

describe("roomListWidth", () => {
    beforeEach(() => localStorage.clear());

    it("defaults to 240 when nothing is saved", () => {
        expect(loadRoomListWidth(1200)).toBe(240);
    });
    it("reads the saved width", () => {
        localStorage.setItem(ROOM_LIST_WIDTH_KEY, "320");
        expect(loadRoomListWidth(1200)).toBe(320);
    });
    it("clamps to the window and the minimum", () => {
        expect(clampRoomListWidth(100, 1200)).toBe(200);
        expect(clampRoomListWidth(900, 1000)).toBe(500);
        expect(clampRoomListWidth(900, 2000)).toBe(640);
    });
});
