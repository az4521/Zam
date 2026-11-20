// Per-account localStorage entries behind private account data: the private key
// copy, whether that copy is confirmed, and the decrypted lists cached for the
// locked state. Kept free of SDK imports so logout and account removal can
// clear them without importing the key module (which imports the client).

import { removeScoped } from "$lib/utils/scopedStorage";

export const PRIVATE_KEY_STORAGE = "privateAccountData.key";
export const PRIVATE_KEY_STATE_STORAGE = "privateAccountData.keyState";
export const PRIVATE_CACHE_STORAGE = "privateAccountData.cache";

/** Every account data type that holds an encrypted private list. */
export const PRIVATE_DATA_TYPES = ["com.zam.private.favourites"] as const;

/** Forget everything this device kept for `userId`'s private account data. */
export function clearPrivateAccountDataLocal(userId: string): void {
    removeScoped(PRIVATE_KEY_STORAGE, userId);
    removeScoped(PRIVATE_KEY_STATE_STORAGE, userId);
    for (const type of PRIVATE_DATA_TYPES) {
        removeScoped(`${PRIVATE_CACHE_STORAGE}:${type}`, userId);
    }
}
