/**
 * When a call uses the full mesh, and how its connections are configured.
 * Pure, so the rules are testable without a call.
 *
 * The mesh is the fallback: we publish on it only when our homeserver has
 * no SFU, and receive over it only from members who publish nowhere else.
 * Every mesh connection shows each end's IP address to the other unless
 * relay-only is on, which is why the UI asks first (stores/meshConsent).
 */
import { FULL_MESH_TRANSPORT_TYPE } from "./protocol";

/** What we put in our membership's transports when publishing on the mesh. */
export function ownMeshTransport(deviceId: string): {
    type: string;
    device_id: string;
} {
    return { type: FULL_MESH_TRANSPORT_TYPE, device_id: deviceId };
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

export function isLivekitTransport(t: unknown): boolean {
    return isRecord(t) && t.type === "livekit";
}

/**
 * Whether a member publishes on the mesh for `deviceId`. The MSC has
 * clients ignore a mesh transport naming another device than the member's.
 */
export function meshTransportOf(
    transports: readonly unknown[],
    deviceId: string,
): boolean {
    return transports.some(
        (t) =>
            isRecord(t) &&
            t.type === FULL_MESH_TRANSPORT_TYPE &&
            t.device_id === deviceId,
    );
}

/**
 * Whether we receive a member over the mesh: they publish on it, and not on
 * an SFU we'd use instead (`picked` is their publishing transport as
 * memberPublishTransport chooses it). An SFU hides both ends' addresses,
 * so it wins whenever there is one.
 */
export function receivesOverMesh(
    picked: unknown,
    transports: readonly unknown[],
    deviceId: string,
): boolean {
    return !isLivekitTransport(picked) && meshTransportOf(transports, deviceId);
}

/** Whether joining a call would open peer-to-peer connections. */
export function joinUsesMesh(opts: {
    ownHasSfu: boolean;
    /** For each other member: whether we'd receive them over the mesh. */
    othersOverMesh: readonly boolean[];
}): boolean {
    return !opts.ownHasSfu || opts.othersOverMesh.some(Boolean);
}

export interface TurnCredentials {
    uris: string[];
    username?: string;
    password?: string;
}

/**
 * The peer connection setup. Only our homeserver's TURN/STUN servers: the
 * MSC forbids a third-party fallback without the user's consent. Null when
 * relay-only is asked but there is no TURN server to relay through, so no
 * connection can be made without showing the address.
 */
export function meshIceConfig(
    turn: TurnCredentials | null,
    relayOnly: boolean,
): RTCConfiguration | null {
    const uris = turn?.uris.filter((u) => typeof u === "string") ?? [];
    const iceServers: RTCIceServer[] =
        uris.length > 0
            ? [
                  {
                      urls: uris,
                      username: turn?.username,
                      credential: turn?.password,
                  },
              ]
            : [];
    if (relayOnly) {
        if (!uris.some((u) => /^turns?:/i.test(u))) return null;
        return { iceServers, iceTransportPolicy: "relay" };
    }
    return { iceServers };
}
