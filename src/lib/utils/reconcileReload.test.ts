import { describe, it, expect } from "vitest";
import { planReconcileReload } from "./reconcileReload";

describe("planReconcileReload — decide whether a joined-rooms mismatch warrants a cache-wipe reload", () => {
    it("no rooms still missing → never reloads, leaves the set untouched", () => {
        expect(
            planReconcileReload({ stillMissing: [], reloadedRooms: ["!a"] }),
        ).toEqual({ reload: false, nextReloadedRooms: ["!a"] });
    });

    it("a room never reloaded-for → reloads once and records it", () => {
        expect(
            planReconcileReload({ stillMissing: ["!new"], reloadedRooms: [] }),
        ).toEqual({ reload: true, nextReloadedRooms: ["!new"] });
    });

    it("a room already reloaded-for (a proven phantom) → never reloads again", () => {
        expect(
            planReconcileReload({
                stillMissing: ["!phantom"],
                reloadedRooms: ["!phantom"],
            }),
        ).toEqual({ reload: false, nextReloadedRooms: ["!phantom"] });
    });

    it("mix of a new room and a known phantom → reloads for the new one, keeps both", () => {
        const plan = planReconcileReload({
            stillMissing: ["!phantom", "!new"],
            reloadedRooms: ["!phantom"],
        });
        expect(plan.reload).toBe(true);
        expect(plan.nextReloadedRooms).toEqual(["!phantom", "!new"]);
    });

    it("does not duplicate a room already in the set", () => {
        const plan = planReconcileReload({
            stillMissing: ["!a", "!a", "!b"],
            reloadedRooms: ["!a"],
        });
        expect(plan.reload).toBe(true);
        expect(plan.nextReloadedRooms).toEqual(["!a", "!b"]);
    });

    it("is idempotent across a reload: the second pass with the recorded set does not reload", () => {
        const first = planReconcileReload({
            stillMissing: ["!x"],
            reloadedRooms: [],
        });
        expect(first.reload).toBe(true);
        const second = planReconcileReload({
            stillMissing: ["!x"],
            reloadedRooms: first.nextReloadedRooms,
        });
        expect(second.reload).toBe(false);
        expect(second.nextReloadedRooms).toEqual(["!x"]);
    });
});
