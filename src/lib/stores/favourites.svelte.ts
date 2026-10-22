import {
    loadFavouriteGifs,
    fetchFavouriteGifsFromServer,
    persistFavouriteGifs,
    onAccountData,
    onSyncPrepared,
    type FavouriteGif,
} from "$lib/matrix/client";

export type { FavouriteGif };

class FavouritesState {
    gifs = $state<FavouriteGif[]>([]);
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

/** Serializes mutations so two rapid clicks can't interleave GET/PUT pairs
 *  and lose each other's change on this device. */
let queue: Promise<void> = Promise.resolve();

function mutate(op: FavouritesOp): Promise<void> {
    // Optimistic: the picker reflects the click immediately, before the
    // round-trip below.
    favouritesState.gifs = op(favouritesState.gifs);

    queue = queue.then(async () => {
        let base: FavouriteGif[];
        try {
            base = await fetchFavouriteGifsFromServer();
        } catch {
            // Couldn't ask (offline, server down). Fall back to local state:
            // no worse than the unconditional overwrite this replaced.
            base = favouritesState.gifs;
        }
        const next = op(base);
        favouritesState.gifs = next;
        await persistFavouriteGifs(next);
    });
    return queue;
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

export function removeFavouriteGif(url: string): Promise<void> {
    return mutate((gifs) => gifs.filter((g) => g.url !== url));
}

// Call once on app mount. Returns a cleanup function.
export function initFavourites(): () => void {
    // Load immediately in case sync already completed before this was called
    favouritesState.gifs = loadFavouriteGifs();

    // Also reload on sync PREPARED in case we registered before the first sync finished
    const unsubSync = onSyncPrepared(() => {
        favouritesState.gifs = loadFavouriteGifs();
    });
    const unsubAccount = onAccountData((type) => {
        // React to the namespaced key (our own writes) and the legacy key (a
        // pre-migration device may still write it — loadFavouriteGifs falls
        // back to it when the new key is absent).
        if (
            type === "moe.crafty.matrix.favourite_gifs" ||
            type === "m.favourite_gifs"
        ) {
            favouritesState.gifs = loadFavouriteGifs();
        }
    });
    return () => {
        unsubSync();
        unsubAccount();
    };
}
