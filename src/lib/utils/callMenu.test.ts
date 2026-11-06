import { describe, it, expect } from "vitest";
import { menuGates } from "./callMenu";

const base = {
    isSelf: false,
    myLevel: 100,
    targetLevel: 0,
    kickLevel: 50,
    banLevel: 50,
};

describe("menuGates", () => {
    it("grants everything to an admin acting on a member", () => {
        expect(menuGates(base)).toEqual({ canKick: true, canBan: true });
    });
    it("grants nothing on yourself", () => {
        expect(menuGates({ ...base, isSelf: true })).toEqual({
            canKick: false,
            canBan: false,
        });
    });
    it("refuses to act on a peer at the same level", () => {
        expect(menuGates({ ...base, myLevel: 50, targetLevel: 50 })).toEqual({
            canKick: false,
            canBan: false,
        });
    });
    it("refuses to act on someone above you", () => {
        expect(menuGates({ ...base, myLevel: 50, targetLevel: 100 })).toEqual({
            canKick: false,
            canBan: false,
        });
    });
    it("gates each action on its own requirement", () => {
        // Meets the kick bar but not the ban bar.
        expect(menuGates({ ...base, myLevel: 50, banLevel: 100 })).toEqual({
            canKick: true,
            canBan: false,
        });
        // ...and the mirror: meets the ban bar but not the kick bar.
        expect(menuGates({ ...base, myLevel: 50, kickLevel: 100 })).toEqual({
            canKick: false,
            canBan: true,
        });
    });
});

describe("menuGates with power ranks", () => {
    it("lets an immutable creator (rank Infinity) act on an admin", () => {
        expect(
            menuGates({ ...base, myLevel: Infinity, targetLevel: 100 }),
        ).toEqual({ canKick: true, canBan: true });
    });
    it("blocks acting on an immutable creator, even for another creator", () => {
        expect(
            menuGates({ ...base, myLevel: 100, targetLevel: Infinity }),
        ).toEqual({ canKick: false, canBan: false });
        expect(
            menuGates({ ...base, myLevel: Infinity, targetLevel: Infinity }),
        ).toEqual({ canKick: false, canBan: false });
    });
});
