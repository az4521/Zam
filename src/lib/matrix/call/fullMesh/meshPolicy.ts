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

/**
 * Adds the mesh to an m.rtc.member content's `transports.can_subscribe`: we
 * can receive over it, and the MSC has members say so there. Content without
 * a `transports` object (the legacy m.call.member form) is left alone.
 */
export function withMeshCanSubscribe<T>(membership: T): T {
    if (!isRecord(membership) || !isRecord(membership.transports))
        return membership;
    const { can_subscribe } = membership.transports;
    const list = Array.isArray(can_subscribe) ? can_subscribe : [];
    if (list.includes(FULL_MESH_TRANSPORT_TYPE)) return membership;
    return {
        ...membership,
        transports: {
            ...membership.transports,
            can_subscribe: [...list, FULL_MESH_TRANSPORT_TYPE],
        },
    };
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
 * Whether a member event may name `device_id` for the mesh: the MSC has
 * clients ignore a mesh transport naming another device than the one that
 * sent the event. `senderKey` is the event's Megolm sender (curve25519) key,
 * null when it wasn't encrypted (a legacy m.call.member state event): then
 * the sending device is unknown and the MSC exempts it. `deviceIdentityKey`
 * is the named device's curve25519 key, undefined when we don't know that
 * device, which can't be the sender then.
 */
export function meshSenderDeviceMatches(
    senderKey: string | null | undefined,
    deviceIdentityKey: string | undefined,
): boolean {
    if (!senderKey) return true;
    return deviceIdentityKey === senderKey;
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

/** Whether the homeserver gave us nothing to get through a home router. */
export function lacksIceServers(turn: TurnCredentials | null): boolean {
    return !turn || turn.uris.length === 0;
}

/** What the consent dialog says about the connection's servers. */
export function meshConsentServers(turn: TurnCredentials | null): {
    offerPublicStun: boolean;
    relayed: boolean;
} {
    return {
        offerPublicStun: lacksIceServers(turn),
        relayed: hasTurnRelay(turn),
    };
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

/** The public STUN server used when the homeserver has none and the user
 *  allowed it. It learns the user's IP address, never the call. */
export const PUBLIC_STUN_URL = "stun:stun.cloudflare.com:3478";

/** Whether the homeserver offers a TURN server to relay through. */
export function hasTurnRelay(turn: TurnCredentials | null): boolean {
    return !!turn?.uris.some(
        (u) => typeof u === "string" && /^turns?:/i.test(u),
    );
}

/**
 * The peer connection setup, in order of preference:
 * 1. relayed through our homeserver's TURN server whenever it has one, so
 *    nobody at the other end sees the user's IP address;
 * 2. direct (also when `direct`: a relayed connection to that peer never
 *    came up), with the homeserver's servers, or a public STUN server only
 *    if the user allowed one (`publicStun`), as the MSC forbids a
 *    third-party fallback without consent.
 * A required relay (`requireRelay`) rules out 2; null then when there is
 * no TURN server, so no connection can be made without showing the address.
 */
export function meshIceConfig(
    turn: TurnCredentials | null,
    requireRelay: boolean,
    publicStun = false,
    direct = false,
): RTCConfiguration | null {
    const uris = turn?.uris.filter((u) => typeof u === "string") ?? [];
    if (hasTurnRelay(turn) && (!direct || requireRelay))
        return {
            iceServers: [
                {
                    urls: uris,
                    username: turn?.username,
                    credential: turn?.password,
                },
            ],
            iceTransportPolicy: "relay",
        };
    if (requireRelay) return null;
    if (uris.length === 0 && publicStun)
        return { iceServers: [{ urls: PUBLIC_STUN_URL }] };
    return {
        iceServers:
            uris.length > 0
                ? [
                      {
                          urls: uris,
                          username: turn?.username,
                          credential: turn?.password,
                      },
                  ]
                : [],
    };
}
