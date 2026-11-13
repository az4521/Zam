// The direct link of a file transfer, for when there is no SFU to carry it:
// MSC4575 peer connections between the two devices (call/fullMesh), the same
// transport calls fall back to. It shows each device's IP address to the
// other unless the user relays through the homeserver's TURN server, so
// fileTransfer.ts asks first (stores/meshConsent).
//
// Each device publishes and subscribes: blocks go one way and the receiver's
// acknowledgements the other. The signalling slot is the transfer's own, so
// a call in the same room never sees these messages.

import type { MatrixClient } from "matrix-js-sdk";
import { FILE_DATA_TOPIC } from "$lib/utils/fileTransfer";
import type { CallTransportListener } from "./call/transport";
import type { MeshLocalMedia } from "./call/fullMesh/connection";
import { FullMeshTransport, meshIdentity } from "./call/fullMesh/meshTransport";
import type { TransferLink } from "./fileTransferEngine";

export interface MeshTransferLink extends TransferLink {
    /** Start receiving from the peer. Its end must be listening by now,
     *  or the request is lost and only retried after a pause. */
    subscribe(): void;
    close(): void;
}

/** No tracks: the link carries data only. */
const NO_MEDIA: MeshLocalMedia = {
    publications: () => [],
    onChange: () => () => {},
};

export function transferSlotId(transferId: string): string {
    return `moe.crafty.file_transfer.${transferId}`;
}

export function openMeshLink(opts: {
    client: MatrixClient;
    roomId: string;
    transferId: string;
    peer: { userId: string; deviceId: string };
    /** `direct`: a relayed connection to the peer never came up. */
    rtcConfig: (direct: boolean) => Promise<RTCConfiguration>;
    /** A connection to the peer never came up. */
    onFailed: () => void;
}): MeshTransferLink {
    const { client, roomId, transferId, peer } = opts;
    const userId = client.getUserId()!;
    const deviceId = client.getDeviceId()!;
    const peerMember = {
        userId: peer.userId,
        deviceId: peer.deviceId,
        memberId: meshIdentity(peer),
    };
    const peerIdentity = peerMember.memberId;
    let handler: (packet: Uint8Array) => void = () => {};
    const listener: CallTransportListener = {
        audioSubscribed() {},
        audioUnsubscribed() {},
        videoSubscribed() {},
        changed() {},
        speakers() {},
        data: (payload, identity, topic) => {
            if (identity === peerIdentity && topic === FILE_DATA_TOPIC)
                handler(payload);
        },
        dataTrackPublished() {},
        dataTrackUnpublished() {},
        connectionFailed: (identity) => {
            if (identity === peerIdentity) opts.onFailed();
        },
    };
    const transport = new FullMeshTransport({
        client,
        roomId,
        slotId: transferSlotId(transferId),
        own: { userId, deviceId, memberId: meshIdentity({ userId, deviceId }) },
        listener,
        local: NO_MEDIA,
        rtcConfig: opts.rtcConfig,
    });
    // A member that doesn't subscribe yet still has its requests answered.
    transport.setMembers([{ ...peerMember, subscribe: false }]);
    return {
        subscribe: () =>
            transport.setMembers([{ ...peerMember, subscribe: true }]),
        send: (packet) =>
            transport.sendDataTo(peerIdentity, packet, FILE_DATA_TOPIC),
        onPacket: (h) => (handler = h),
        close: () => void transport.close(),
    };
}
