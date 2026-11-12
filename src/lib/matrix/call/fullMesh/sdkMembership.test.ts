import { describe, it, expect } from "vitest";
import { StickyEventMembershipManager } from "matrix-js-sdk/lib/matrixrtc/MembershipManager";
import { advertiseMeshSubscribe } from "./sdkMembership";
import { FULL_MESH_TRANSPORT_TYPE } from "./protocol";

describe("advertiseMeshSubscribe", () => {
    it("makes the SDK's m.rtc.member content list the mesh in can_subscribe", () => {
        advertiseMeshSubscribe();
        advertiseMeshSubscribe(); // a second call must not wrap twice
        // A manager without its constructor: only what the builder reads.
        const manager = Object.create(StickyEventMembershipManager.prototype);
        for (const [key, value] of Object.entries({
            applicationData: {},
            slotDescription: { application: "m.call", id: "" },
            publishedTransports: [
                { type: FULL_MESH_TRANSPORT_TYPE, device_id: "D" },
            ],
            deviceId: "D",
            userId: "@a:x",
            memberId: "@a:x:D",
            logger: { warn() {}, info() {}, debug() {}, error() {} },
        }))
            Object.defineProperty(manager, key, { value });
        const content = (
            manager as { makeMyMembership(): Record<string, unknown> }
        ).makeMyMembership();
        expect(content.transports).toEqual({
            published: [{ type: FULL_MESH_TRANSPORT_TYPE, device_id: "D" }],
            can_subscribe: ["livekit", FULL_MESH_TRANSPORT_TYPE],
        });
    });
});
