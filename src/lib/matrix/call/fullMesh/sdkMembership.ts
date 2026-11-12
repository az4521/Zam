/**
 * The js-sdk builds our m.rtc.member content with `can_subscribe: ["livekit"]`
 * and no way to change it. MSC4575 has members that can receive over the mesh
 * list it there, so other clients know they may publish to us that way. This
 * wraps the SDK's builder to add it. Only the m.rtc.member (sticky) manager
 * writes `can_subscribe`; the legacy m.call.member form has no such field.
 */
import { StickyEventMembershipManager } from "matrix-js-sdk/lib/matrixrtc/MembershipManager";
import { withMeshCanSubscribe } from "./meshPolicy";

let installed = false;

export function advertiseMeshSubscribe(): void {
    if (installed) return;
    installed = true;
    const proto = StickyEventMembershipManager.prototype as unknown as {
        makeMyMembership(...args: unknown[]): unknown;
    };
    const original = proto.makeMyMembership;
    if (typeof original !== "function") {
        console.warn(
            "[full-mesh] the SDK's membership builder moved: can_subscribe won't list the mesh",
        );
        return;
    }
    proto.makeMyMembership = function (this: unknown, ...args: unknown[]) {
        return withMeshCanSubscribe(original.apply(this, args));
    };
}
