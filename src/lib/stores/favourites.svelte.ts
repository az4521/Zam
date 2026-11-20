import {
    onAccountData,
    onSyncPrepared,
    persistPrivateAccountData,
    type FavouriteGif,
} from "$lib/matrix/client";
import {
    hasPrivateKey,
    onPrivateKeyChange,
    preparePrivateKey,
    PrivateAccountDataLockedError,
    privateModeState,
    readPrivate,
    setPrivateMode,
    writePrivate,
    type PrivateRead,
} from "$lib/matrix/privateAccountData.svelte";
import { captureClient, ownedClient } from "$lib/matrix/runtime";
import { matrixMediaMxc } from "$lib/matrix/favouriteFile";
import { disableStep, enableStep } from "$lib/utils/favouritesMode";
import { safeDimension } from "$lib/utils/mediaDimensions";
import { mergeImportedFavourites } from "$lib/utils/discordFavourites";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import { openSecretStorageUnlock } from "$lib/stores/onboarding.svelte";
import { t } from "$lib/i18n";

export type { FavouriteGif };

/** The favourites list when encrypted (see privateAccountData.svelte.ts). */
const FAVOURITES_TYPE = "com.zam.private.favourites";
/** The plaintext list: the account data type the app has always used. Its
 *  first entry is the one plain-mode writes go to. */
const LEGACY_FAVOURITES_TYPES = [
    "moe.crafty.matrix.favourite_gifs",
    "m.favourite_gifs",
] as const;

/** `width`/`height` for a new favourite, from a size that may be untrusted
 *  (event info, og tags): nothing unless both sides are usable. The picker
 *  reserves a starred GIF's tile from these before its preview loads. */
export function favouriteSize(
    width: unknown,
    height: unknown,
): { width?: number; height?: number } {
    const w = safeDimension(width);
    const h = safeDimension(height);
    return w !== null && h !== null ? { width: w, height: h } : {};
}

class FavouritesState {
    gifs = $state<FavouriteGif[]>([]);
    /** The key is not on this device, so changes are refused and the list may
     *  be the last one this device read. The picker shows a hint. */
    locked = $state(false);
}

export const favouritesState = new FavouritesState();

export function isFavouriteGif(url: string): boolean {
    return favouritesState.gifs.some((g) => g.url === url);
}

/**
 * A change to the list, expressed as a pure function so it can be applied
 * twice: once to local state for an instant UI response, and again to the
 * list we read back from the server just before writing.
 *
 * Favourites live in one account-data blob and Matrix has no compare-and-set,
 * so a write replaces the whole array. Rebuilding from `favouritesState`
 * would publish whatever this device last heard about — erasing a favourite
 * another device added in the meantime, or resurrecting one it deleted.
 * Re-reading first narrows that window to the gap between GET and PUT.
 *
 * Ops must therefore be idempotent: applied to a base that already reflects
 * the change, they must return it unchanged.
 */
type FavouritesOp = (gifs: FavouriteGif[]) => FavouriteGif[];

/** Serializes reads, writes and migration so two rapid clicks can't interleave
 *  read/write pairs and lose each other's change on this device. A failed task
 *  never stops the ones behind it. */
let queue: Promise<void> = Promise.resolve();

/** Latest refresh wins: an older read that finishes late must not overwrite. */
let refreshGeneration = 0;

function gifsOf(value: unknown): FavouriteGif[] {
    const gifs =
        value && typeof value === "object"
            ? (value as { gifs?: unknown }).gifs
            : undefined;
    if (!Array.isArray(gifs)) return [];
    // Account data is untrusted: keep only entries that can be a favourite.
    return gifs.filter(
        (g): g is FavouriteGif =>
            !!g &&
            typeof g === "object" &&
            typeof (g as { url?: unknown }).url === "string",
    );
}

/** Show what this device can show: the decrypted list, or the last one it read. */
async function refresh(): Promise<void> {
    const generation = ++refreshGeneration;
    let owner: ReturnType<typeof captureClient>;
    try {
        owner = captureClient();
    } catch {
        return;
    }
    let read: PrivateRead;
    try {
        read = await readPrivate(FAVOURITES_TYPE, {
            legacyTypes: LEGACY_FAVOURITES_TYPES,
        });
    } catch (err) {
        console.warn("[favourites] could not read favourites", err);
        return;
    }
    if (generation !== refreshGeneration || !ownedClient(owner)) return;

    if (read.kind === "locked") {
        favouritesState.gifs = gifsOf(read.cached);
        favouritesState.locked = true;
        return;
    }
    favouritesState.gifs = read.kind === "value" ? gifsOf(read.value) : [];
    // Only an encrypted list this device cannot read counts as locked. A plain
    // list is always readable here.
    favouritesState.locked = false;
}

function enqueue(
    task: () => Promise<void>,
    { rollback }: { rollback: boolean },
): Promise<void> {
    queue = queue.then(task).catch((err: unknown) => {
        if (err instanceof PrivateAccountDataLockedError) {
            showErrorToast(t("favourites.locked"));
        } else {
            console.warn("[favourites] save failed", err);
            showErrorToast(t("favourites.saveFailed"));
        }
        // Drop the optimistic change.
        if (rollback) void refresh();
    });
    return queue;
}

function mutate(op: FavouritesOp): Promise<void> {
    // Refused while the list is encrypted and the key is not here: writing
    // would replace the encrypted set this device cannot read, so nothing is
    // changed locally either. A plain list needs no key.
    if (privateModeState.mode === "encrypted" && !hasPrivateKey()) {
        showErrorToast(t("favourites.locked"));
        return Promise.resolve();
    }
    // Optimistic: the picker reflects the click immediately, before the
    // round-trip below.
    favouritesState.gifs = op(favouritesState.gifs);

    return enqueue(
        async () => {
            const owner = captureClient();
            let read: PrivateRead;
            try {
                // The homeserver's copy, not the local one: another device may
                // have written since, and may have switched the mode.
                read = await readPrivate(FAVOURITES_TYPE, {
                    legacyTypes: LEGACY_FAVOURITES_TYPES,
                    fresh: true,
                });
            } catch {
                // Couldn't ask (offline, server down). Fall back to local state
                // in the mode this device last knew: no worse than the
                // unconditional overwrite this replaced.
                read =
                    privateModeState.mode === "encrypted"
                        ? {
                              kind: "value",
                              value: { gifs: favouritesState.gifs },
                              source: "encrypted",
                          }
                        : {
                              kind: "value",
                              value: { gifs: favouritesState.gifs },
                              source: "legacy",
                          };
            }
            if (read.kind === "locked")
                throw new PrivateAccountDataLockedError();
            const base = read.kind === "value" ? gifsOf(read.value) : [];
            const next = op(base);
            if (!ownedClient(owner)) return;
            favouritesState.gifs = next;
            if (read.kind === "value" && read.source === "encrypted") {
                await writePrivate(
                    FAVOURITES_TYPE,
                    { gifs: next },
                    { clearLegacy: LEGACY_FAVOURITES_TYPES },
                );
            } else {
                // Plain mode: the same write the app has always made.
                await persistPrivateAccountData(LEGACY_FAVOURITES_TYPES[0], {
                    gifs: next,
                });
            }
        },
        { rollback: true },
    );
}

export type FavouritesModeChange = "done" | "noop" | "unlock" | "failed";

/**
 * Turn encryption of the favourites list on or off for the whole account.
 *
 * On: get a usable key (4S when unlocked, else this device's key), read the
 * plaintext list fresh, write it encrypted, then blank the plaintext.
 * Off: needs the key to read the encrypted list; write it back as plaintext,
 * then blank the encrypted event.
 *
 * "unlock" means secret storage exists and this session cannot read it: the
 * unlock dialog is opened and nothing changes. Any failure is toasted and
 * leaves the list as it was.
 */
export async function setFavouritesEncrypted(
    enable: boolean,
): Promise<FavouritesModeChange> {
    if (privateModeState.switching) return "noop";
    privateModeState.switching = true;
    try {
        return enable ? await enableEncrypted() : await disableEncrypted();
    } catch (err) {
        console.warn("[favourites] changing encryption failed", err);
        showErrorToast(
            t(
                enable
                    ? "privateData.enableFailed"
                    : "privateData.disableFailed",
            ),
        );
        return "failed";
    } finally {
        privateModeState.switching = false;
    }
}

async function enableEncrypted(): Promise<FavouritesModeChange> {
    const step = enableStep(privateModeState.mode);
    if (step === "noop") return "noop";
    if (step === "refuse") return "failed";
    const owner = captureClient();
    const key = await preparePrivateKey();
    if (!ownedClient(owner)) return "failed";
    if (key === "unlock") {
        // Carry on once the recovery key is in, so the toggle does not
        // silently stay off after a successful unlock.
        openSecretStorageUnlock(
            "privateData.unlockToEncrypt",
            () => void setFavouritesEncrypted(true),
        );
        return "unlock";
    }
    if (key !== "ready") return "failed";
    const read = await readPrivate(FAVOURITES_TYPE, {
        legacyTypes: LEGACY_FAVOURITES_TYPES,
        fresh: true,
    });
    if (!ownedClient(owner)) return "failed";
    // The server already holds an encrypted list: the mode is encrypted.
    if (
        read.kind === "locked" ||
        (read.kind === "value" && read.source === "encrypted")
    ) {
        setPrivateMode("encrypted");
        return "noop";
    }
    const gifs = read.kind === "value" ? gifsOf(read.value) : [];
    await writePrivate(
        FAVOURITES_TYPE,
        { gifs },
        { clearLegacy: LEGACY_FAVOURITES_TYPES },
    );
    setPrivateMode("encrypted");
    void refresh();
    return "done";
}

async function disableEncrypted(): Promise<FavouritesModeChange> {
    const step = disableStep({
        mode: privateModeState.mode,
        keyReady: hasPrivateKey(),
    });
    if (step === "noop") return "noop";
    if (step === "unlock") {
        openSecretStorageUnlock(
            "privateData.unlockToDecrypt",
            () => void setFavouritesEncrypted(false),
        );
        return "unlock";
    }
    const owner = captureClient();
    const read = await readPrivate(FAVOURITES_TYPE, { fresh: true });
    if (!ownedClient(owner)) return "failed";
    if (read.kind === "locked") {
        openSecretStorageUnlock(
            "privateData.unlockToDecrypt",
            () => void setFavouritesEncrypted(false),
        );
        return "unlock";
    }
    const gifs = read.kind === "value" ? gifsOf(read.value) : [];
    // Plaintext first, so a failure in between leaves the list readable rather
    // than lost.
    await persistPrivateAccountData(LEGACY_FAVOURITES_TYPES[0], { gifs });
    await persistPrivateAccountData(FAVOURITES_TYPE, {});
    setPrivateMode("plain");
    void refresh();
    return "done";
}

export function addFavouriteGif(
    gif: Omit<FavouriteGif, "addedAt">,
): Promise<void> {
    if (isFavouriteGif(gif.url)) return Promise.resolve();
    const entry: FavouriteGif = { ...gif, addedAt: Date.now() };
    return mutate((gifs) =>
        gifs.some((g) => g.url === entry.url) ? gifs : [entry, ...gifs],
    );
}

/** Replace a favourite's tags. Tags are trimmed, lowercased and de-duped. */
export function setFavouriteGifTags(
    url: string,
    tags: string[],
): Promise<void> {
    const clean = [
        ...new Set(
            tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0),
        ),
    ];
    return mutate((gifs) =>
        gifs.map((g) => (g.url === url ? { ...g, tags: clean } : g)),
    );
}

/** A favourite saved under an old URL that now has a better one. */
export interface FavouriteGifUpgrade {
    from: string;
    to: string;
    previewVideoUrl?: string;
}

/**
 * Re-key favourites from an old URL to a new one, keeping their tags, order
 * and addedAt. Used to move KLIPY favourites starred before the picker sent
 * klipy.com page links off their static CDN URLs: the CDN path carries no
 * slug, so the page link is only learned when the GIF shows up in a search.
 * If the new URL is already a favourite, the old entry is just dropped.
 */
export function upgradeFavouriteGifs(
    upgrades: FavouriteGifUpgrade[],
): Promise<void> {
    const byFrom = new Map(upgrades.map((u) => [u.from, u]));
    if (!favouritesState.gifs.some((g) => byFrom.has(g.url)))
        return Promise.resolve();
    return mutate((gifs) => {
        const urls = new Set(gifs.map((g) => g.url));
        const out: FavouriteGif[] = [];
        for (const g of gifs) {
            const u = byFrom.get(g.url);
            if (!u) out.push(g);
            else if (!urls.has(u.to)) {
                urls.add(u.to);
                out.push({
                    ...g,
                    url: u.to,
                    ...(u.previewVideoUrl && !g.previewVideoUrl
                        ? { previewVideoUrl: u.previewVideoUrl }
                        : {}),
                });
            }
        }
        return out.length === gifs.length && out.every((g, i) => g === gifs[i])
            ? gifs
            : out;
    });
}

/**
 * Add favourites imported from another app (Discord). Entries whose link is
 * already a favourite are skipped. Resolves to how many were new here.
 */
export function importFavouriteGifs(entries: FavouriteGif[]): Promise<number> {
    const current = favouritesState.gifs;
    const added =
        mergeImportedFavourites(current, entries).length - current.length;
    if (added === 0) return Promise.resolve(0);
    return mutate((gifs) => mergeImportedFavourites(gifs, entries)).then(
        () => added,
    );
}

export function removeFavouriteGif(url: string): Promise<void> {
    return mutate((gifs) => gifs.filter((g) => g.url !== url));
}

/** Record the media `mxc` an encrypted favourite holds, for favourites starred
 *  before `mxc` was stored. Idempotent: a favourite that is gone or already
 *  has it is left alone. */
export function setFavouriteGifMxc(url: string, mxc: string): Promise<void> {
    const current = favouritesState.gifs.find((g) => g.url === url);
    if (!current || current.mxc === mxc) return Promise.resolve();
    return mutate((gifs) =>
        gifs.some((g) => g.url === url && g.mxc !== mxc)
            ? gifs.map((g) => (g.url === url ? { ...g, mxc } : g))
            : gifs,
    );
}

/** Index of the favourites by the media they hold, rebuilt whenever the list
 *  is replaced. The list is never mutated in place, so its identity is enough
 *  to tell whether the index is stale. */
let mxcIndex: { gifs: FavouriteGif[]; urls: Map<string, string> } | null = null;

/**
 * The URL of the favourite holding the media `mxc`, so a message whose media
 * is one already starred shows as starred. An encrypted favourite matches on
 * its stored `mxc`; a plain one on the media its URL names. Reads the list
 * reactively, so callers in templates and $derived update with it.
 */
export function favouriteUrlForMxc(mxc: string): string | undefined {
    const gifs = favouritesState.gifs;
    if (mxcIndex?.gifs !== gifs) {
        const urls = new Map<string, string>();
        for (const g of gifs) {
            // Account data is untrusted: only strings can be media ids. The
            // first favourite in list order wins on a clash.
            const fromUrl =
                typeof g.url === "string" ? matrixMediaMxc(g.url) : null;
            for (const id of [g.mxc, fromUrl]) {
                if (typeof id === "string" && !urls.has(id)) {
                    urls.set(id, g.url);
                }
            }
        }
        mxcIndex = { gifs, urls };
    }
    return mxcIndex.urls.get(mxc);
}

// Call once on app mount. Returns a cleanup function.
export function initFavourites(): () => void {
    // Load immediately in case sync already completed before this was called
    void refresh();

    // Also reload on sync PREPARED in case we registered before the first sync finished
    const unsubSync = onSyncPrepared(() => void refresh());
    const unsubAccount = onAccountData((type) => {
        // Our own encrypted type, and the legacy plaintext types a pre-encryption
        // device may still write.
        if (
            type === FAVOURITES_TYPE ||
            (LEGACY_FAVOURITES_TYPES as readonly string[]).includes(type)
        ) {
            void refresh();
        }
    });
    // The key arriving (unlock, gossip) or changing makes the list readable.
    const unsubKey = onPrivateKeyChange(() => void refresh());
    return () => {
        unsubSync();
        unsubAccount();
        unsubKey();
    };
}
