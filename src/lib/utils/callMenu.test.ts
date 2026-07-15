import { describe, it, expect } from "vitest";
import { menuGates } from "./callMenu";

const base = {
    isSelf: false,
    myLevel: 100,
    targetLevel: 0,
    kickLevel: 50,
    banLevel: 50,
    redactLevel: 50,
};

describe("menuGates", () => {
    it("grants everything to an admin acting on a member", () => {
        expect(menuGates(base)).toEqual({
            canKick: true,
            canBan: true,
            canDisconnect: true,
        });
    });
    it("grants nothing on yourself", () => {
        expect(menuGates({ ...base, isSelf: true })).toEqual({
            canKick: false,
            canBan: false,
            canDisconnect: false,
        });
    });
    it("refuses to act on a peer at the same level", () => {
        expect(menuGates({ ...base, myLevel: 50, targetLevel: 50 })).toEqual({
            canKick: false,
            canBan: false,
            canDisconnect: false,
        });
    });
    it("refuses to act on someone above you", () => {
        expect(menuGates({ ...base, myLevel: 50, targetLevel: 100 })).toEqual({
            canKick: false,
            canBan: false,
            canDisconnect: false,
        });
    });
    it("gates each action on its own requirement", () => {
        expect(
            menuGates({
                ...base,
                myLevel: 50,
                banLevel: 100,
                redactLevel: 100,
            }),
        ).toEqual({ canKick: true, canBan: false, canDisconnect: false });
    });
});
