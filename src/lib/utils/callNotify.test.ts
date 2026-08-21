import { describe, it, expect } from "vitest";
import { buildCallNotifyContent, shouldRingPeers } from "./callNotify";

describe("buildCallNotifyContent", () => {
    it("rings the named callees by default with the room-scoped call id", () => {
        expect(buildCallNotifyContent({ calleeUserIds: ["@dev:hs"] })).toEqual({
            application: "m.call",
            call_id: "",
            "m.mentions": { user_ids: ["@dev:hs"], room: false },
            notify_type: "ring",
        });
    });

    it("passes through a non-empty call id and notify type", () => {
        expect(
            buildCallNotifyContent({
                calleeUserIds: ["@a:hs", "@b:hs"],
                callId: "c1",
                notifyType: "notify",
            }),
        ).toEqual({
            application: "m.call",
            call_id: "c1",
            "m.mentions": { user_ids: ["@a:hs", "@b:hs"], room: false },
            notify_type: "notify",
        });
    });

    it("dedupes callee ids", () => {
        expect(
            buildCallNotifyContent({ calleeUserIds: ["@dev:hs", "@dev:hs"] })[
                "m.mentions"
            ].user_ids,
        ).toEqual(["@dev:hs"]);
    });
});

describe("shouldRingPeers", () => {
    it("rings when the local join is first into a DM call", () => {
        expect(shouldRingPeers(true, [])).toBe(true);
    });

    it("stays silent when a peer is already in the DM call (answering)", () => {
        expect(shouldRingPeers(true, ["@dev:hs"])).toBe(false);
    });

    it("never rings outside a DM", () => {
        expect(shouldRingPeers(false, [])).toBe(false);
    });
});
