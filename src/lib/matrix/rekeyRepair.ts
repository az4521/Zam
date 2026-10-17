// Taking on a session's new keys when it re-keys under the same device id.
//
// A session that loses its encryption data but stays signed in comes back
// with new identity keys under its old device id, and the server accepts
// them. The crypto engine never does: once it has a device's Ed25519 key it
// rejects any other ("Rejecting device update"), keeps the old keys, and
// encrypts to them for good, so that session can't read anything we send
// and nothing short of signing out on one side fixed it.
//
// It does drop a device that a keys query response leaves out. So when a
// response carries a known device with a different Ed25519 key, it is taken
// out of what the engine sees (the engine deletes its stale copy), and the
// user is queried again at once, which stores the device afresh, as if it
// had just signed in. Nothing carries over from the old copy: the new keys
// must pass the engine's own signature checks, and the device starts
// unverified unless its owner has cross-signed the new keys. That is the
// same trust a brand new session of theirs would get.

/** A keys query response, as far as this needs it. */
interface KeysQueryResponse {
    device_keys?: Record<
        string,
        Record<string, { keys?: Record<string, string> } | undefined>
    >;
}

/**
 * The devices in `response` whose Ed25519 key differs from the one we have
 * stored for them. `stored` maps user -> device -> stored Ed25519 key (only
 * devices we already know). Our own device is never included.
 */
export function findRekeyedDevices(
    response: KeysQueryResponse,
    stored: Map<string, Map<string, string | undefined>>,
    own: { userId: string; deviceId: string },
): { userId: string; deviceId: string }[] {
    const rekeyed: { userId: string; deviceId: string }[] = [];
    for (const [userId, devices] of Object.entries(
        response.device_keys ?? {},
    )) {
        const known = stored.get(userId);
        if (!known) continue;
        for (const [deviceId, device] of Object.entries(devices ?? {})) {
            if (userId === own.userId && deviceId === own.deviceId) continue;
            if (!known.has(deviceId)) continue;
            const ours = known.get(deviceId);
            const theirs = device?.keys?.[`ed25519:${deviceId}`];
            if (ours && theirs && ours !== theirs)
                rekeyed.push({ userId, deviceId });
        }
    }
    return rekeyed;
}

/** The engine methods this needs (matrix-sdk-crypto-wasm's OlmMachine). */
interface EngineHooks {
    olmMachine?: {
        markRequestAsSent(
            requestId: string,
            requestType: number,
            response: string,
        ): Promise<unknown>;
        getUserDevices(
            userId: unknown,
            timeoutSecs?: number | null,
        ): Promise<{
            devices(): {
                deviceId: { toString(): string };
                ed25519Key?: { toBase64(): string };
            }[];
        }>;
        queryKeysForUsers(users: unknown[]): unknown;
    };
    outgoingRequestProcessor?: {
        makeOutgoingRequest(request: unknown): Promise<unknown>;
    };
}

/**
 * Hook the crypto engine of `crypto` (RustCrypto) so a keys query response
 * replaces devices that re-keyed. Returns false when the engine's internals
 * aren't there (a different SDK), and nothing is changed.
 */
export async function installRekeyRepair(
    crypto: unknown,
    own: { userId: string; deviceId: string },
): Promise<boolean> {
    const engine = crypto as EngineHooks;
    const machine = engine.olmMachine;
    const processor = engine.outgoingRequestProcessor;
    if (!machine || !processor) return false;
    const { RequestType, UserId } =
        await import("@matrix-org/matrix-sdk-crypto-wasm");
    const markRequestAsSent = machine.markRequestAsSent.bind(machine);

    async function storedKeys(
        userIds: string[],
    ): Promise<Map<string, Map<string, string | undefined>>> {
        const stored = new Map<string, Map<string, string | undefined>>();
        for (const userId of userIds) {
            // No wait: the query being answered is the one it would wait for.
            const devices = await machine!.getUserDevices(
                new UserId(userId),
                0,
            );
            stored.set(
                userId,
                new Map(
                    devices
                        .devices()
                        .map((d) => [
                            d.deviceId.toString(),
                            d.ed25519Key?.toBase64(),
                        ]),
                ),
            );
        }
        return stored;
    }

    machine.markRequestAsSent = async (requestId, requestType, response) => {
        if (requestType !== RequestType.KeysQuery)
            return markRequestAsSent(requestId, requestType, response);
        let parsed: KeysQueryResponse;
        let rekeyed: { userId: string; deviceId: string }[] = [];
        try {
            parsed = JSON.parse(response) as KeysQueryResponse;
            rekeyed = findRekeyedDevices(
                parsed,
                await storedKeys(Object.keys(parsed.device_keys ?? {})),
                own,
            );
        } catch (err) {
            console.warn("[crypto] couldn't check for re-keyed sessions", err);
        }
        if (rekeyed.length === 0)
            return markRequestAsSent(requestId, requestType, response);

        for (const { userId, deviceId } of rekeyed) {
            console.info(
                `[crypto] ${userId}'s session ${deviceId} has new keys; replacing our copy`,
            );
            delete parsed!.device_keys![userId]![deviceId];
        }
        const result = await markRequestAsSent(
            requestId,
            requestType,
            JSON.stringify(parsed!),
        );
        // The engine has dropped them now; ask again so they come back with
        // their new keys. Not awaited: this runs inside the request loop.
        const users = [...new Set(rekeyed.map((r) => r.userId))];
        void processor
            .makeOutgoingRequest(
                machine.queryKeysForUsers(users.map((u) => new UserId(u))),
            )
            .catch((err) =>
                console.warn("[crypto] re-query after re-key failed", err),
            );
        return result;
    };
    return true;
}
