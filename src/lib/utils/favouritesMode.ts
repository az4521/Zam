// Which form the favourites list takes on the homeserver, and the steps for
// moving between the two. Pure: callers gather the facts (what the server
// holds, whether this device has the key) and act on the answer.
//
//   - plain: the list is ordinary account data (the type the app used before
//     encryption existed). This is the default and the state of every account
//     that has not turned encryption on.
//   - encrypted: the list is held in the encrypted type. The mode is account
//     state: it is "encrypted" exactly when the server holds an encrypted
//     favourites event, so every device agrees without a flag of its own.
//   - unknown: not yet read from the server (before the first sync).

export type FavouritesMode = "unknown" | "plain" | "encrypted";

/** The mode the server holds, given whether it has an encrypted favourites event. */
export function modeFromServer(hasEncryptedEvent: boolean): FavouritesMode {
    return hasEncryptedEvent ? "encrypted" : "plain";
}

/**
 * Whether turning encryption on may start. Not while the mode is unknown:
 * nothing has been read from the server yet, so there is nothing to move.
 */
export function enableStep(
    mode: FavouritesMode,
): "noop" | "refuse" | "proceed" {
    if (mode === "encrypted") return "noop";
    if (mode === "unknown") return "refuse";
    return "proceed";
}

/**
 * How to get a key for encrypting. A usable key is used as it is. Without one,
 * a device with no secret storage on the account makes its own key, and one
 * with secret storage reads it from there (which may need the recovery key).
 */
export function enableKeyStep(input: {
    keyReady: boolean;
    hasSecretStorage: boolean;
}): "ready" | "create-key" | "load-key" {
    if (input.keyReady) return "ready";
    return input.hasSecretStorage ? "load-key" : "create-key";
}

/**
 * Turning encryption off needs the key to read the encrypted list, so it
 * either proceeds or needs the unlock path first.
 */
export function disableStep(input: {
    mode: FavouritesMode;
    keyReady: boolean;
}): "noop" | "unlock" | "write-plain" {
    if (input.mode !== "encrypted") return "noop";
    return input.keyReady ? "write-plain" : "unlock";
}
