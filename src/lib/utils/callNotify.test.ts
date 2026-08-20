import { describe, it, expect } from "vitest";
import { buildCallNotifyContent } from "./callNotify";

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
