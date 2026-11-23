// The decisions behind the private account data key, as pure functions over
// facts the caller has already gathered (the SDK and storage are not touched
// here, so every rule can be tested directly).
//
// Terms:
//   - local:  the key this device holds. "confirmed" when it came from secret
//     storage, from a session that already had it, or when it decrypts an
//     encrypted event on the server. "unconfirmed" when this device generated
//     it itself and nothing has checked it yet. "none" when there is no key.
//   - server: the encrypted private events on the homeserver, judged by the
//     local key. "none" when there are none, "readable" when every one decrypts
//     with the local key, "unreadable" when at least one does not (or there is
//     no local key but events exist).
//   - remote: the key secret stored in secret storage (4S).

export type LocalKeyState = "none" | "confirmed" | "unconfirmed";
export type ServerState = "none" | "readable" | "unreadable";
export type KeyVerdict = "ready" | "missing";
export type SecretStorageRemote = "absent" | "value" | "unreadable";
export type SecretStorageAction =
    "adopt" | "store-local" | "generate-and-store" | "leave";

/**
 * Whether this device can use its key. A key the server's encrypted events do
 * not fit is no use: writes would be refused and reads would stay locked, so
 * this device has to get the real key (gossip, or unlock) instead.
 */
export function keyVerdict(
    local: LocalKeyState,
    server: ServerState,
): KeyVerdict {
    if (local === "none") return "missing";
    return server === "unreadable" ? "missing" : "ready";
}

/** An unconfirmed key that decrypts what the server holds is now known good. */
export function shouldPromote(
    local: LocalKeyState,
    server: ServerState,
): boolean {
    return local === "unconfirmed" && server === "readable";
}

/**
 * Whether to take a key shared by another of this account's sessions (only
 * asked for, within the request window, by the caller). A key this device
 * already holds that fits the server is kept, unconfirmed or not. Otherwise a
 * share is taken when it decrypts the server's events, or when this device has
 * no key and there is nothing on the server to check it against.
 */
export function acceptShare(input: {
    local: LocalKeyState;
    server: ServerState;
    shareDecrypts: boolean;
}): boolean {
    const { local, server, shareDecrypts } = input;
    if (local !== "none" && server !== "unreadable") return false;
    if (shareDecrypts) return true;
    return local === "none" && server === "none";
}

/**
 * What to do with secret storage once it is readable this session.
 *  - adopt: 4S holds a key that fits the server (decrypts its events, or there
 *    are none), so it is the account's key: take it.
 *  - store-local: 4S holds nothing usable (absent, a copy this session cannot
 *    read, or a stale key the server's events no longer fit). Put this
 *    device's key there, but only when that key fits the server, so 4S is
 *    never overwritten with a key that would lock out the events already
 *    there. A stale 4S key is normal: a verified session may turn encryption
 *    on with a fresh key while 4S is locked, and 4S catches up here.
 *  - generate-and-store: 4S is absent, this device has no key, and the server
 *    holds no encrypted events, so a new key is safe to make.
 *  - leave: nothing to do.
 */
export function secretStorageAction(input: {
    remote: SecretStorageRemote;
    /** Whether the 4S key fits the server (only read when remote is "value"). */
    remoteFits: boolean;
    local: LocalKeyState;
    server: ServerState;
}): SecretStorageAction {
    const { remote, remoteFits, local, server } = input;
    const localFits = local !== "none" && server !== "unreadable";
    if (remote === "value") {
        if (remoteFits) return "adopt";
        return localFits ? "store-local" : "leave";
    }
    if (remote === "absent" && local === "none") {
        return server === "none" ? "generate-and-store" : "leave";
    }
    return localFits ? "store-local" : "leave";
}
