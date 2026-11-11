/**
 * Game invites: a normal text message (so every client shows its body) that
 * also carries a structured invite under a custom content key. Zam reads the
 * key and shows a card with a Join button; other clients only see the body.
 *
 * Only Steam games can be invited. The body is a steam:// link that launches
 * the game, which is how Steam itself starts one.
 *
 * The structured part is untrusted: whoever sends it chooses what the
 * receiver's Join button will run, so every field is checked here and nothing
 * is trusted until it passes.
 */

export const GAME_INVITE_KEY = "moe.crafty.matrix.game_invite";

export const GAME_INVITE_LIMITS = {
    from: 100,
    name: 100,
    details: 200,
    state: 200,
    note: 500,
    steamAppId: 20,
    steamConnect: 512,
    partyMax: 1_000_000,
} as const;

/**
 * A Steam game a user can invite others to, in the camelCase form Zam uses.
 * `steamId` (the inviter's SteamID64) and `lobbyId` let the link be Steam's own
 * join link; without a steamId the link runs the game with `connect`. `connect`
 * may be left out only when both steamId and lobbyId are there.
 * `icon` is the hash of the game's Steam icon, when Steam gave one.
 */
export interface GameInvite {
    name: string;
    details?: string;
    state?: string;
    /** [current, max] players in the game's party. */
    partySize?: [number, number];
    steam: {
        appId: string;
        steamId?: string;
        lobbyId?: string;
        connect?: string;
        icon?: string;
    };
}

/** The address of a Steam game's icon picture. */
export function steamIconUrl(appId: string, icon: string): string {
    return `https://shared.fastly.steamstatic.com/community_assets/images/apps/${appId}/${icon}.jpg`;
}

/**
 * The steam:// link for a Steam invite, the same one Steam's Join Game button
 * opens (steamUrl.cjs): joinlobby when the friend is in a lobby, else rungame
 * with the connect string, else the run link for an invite with no Steam id.
 */
export function steamJoinLink(steam: GameInvite["steam"]): string {
    const { appId, steamId, lobbyId, connect } = steam;
    if (steamId && lobbyId)
        return `steam://joinlobby/${appId}/${lobbyId}/${steamId}`;
    if (steamId && connect !== undefined)
        return `steam://rungame/${appId}/${steamId}/${encodeURIComponent(connect)}`;
    return `steam://run/${appId}//${encodeURIComponent(connect ?? "")}/`;
}

/** A validated invite, with the sender's optional note. */
export type ParsedGameInvite = GameInvite & { note?: string };

/** The structured invite, as it sits under GAME_INVITE_KEY (snake_case). */
export function gameInvitePayload(
    game: GameInvite,
    note?: string,
): Record<string, unknown> {
    const out: Record<string, unknown> = {
        app: { name: game.name, source: "steam" },
        steam: {
            app_id: game.steam.appId,
            ...(game.steam.steamId ? { steam_id: game.steam.steamId } : {}),
            ...(game.steam.lobbyId ? { lobby_id: game.steam.lobbyId } : {}),
            ...(game.steam.connect !== undefined
                ? { connect: game.steam.connect }
                : {}),
            ...(game.steam.icon ? { icon: game.steam.icon } : {}),
        },
    };
    if (game.details) out.details = game.details;
    if (game.state) out.state = game.state;
    if (game.partySize) out.party_size = [...game.partySize];
    if (note) out.note = note;
    return out;
}

/** The plain-text body other clients show: a steam:// link that runs the game. */
export function gameInviteBody(game: GameInvite, from: string): string {
    const who = from.slice(0, GAME_INVITE_LIMITS.from);
    return `${who} invited you to join ${game.name}: ${steamJoinLink(game.steam)}`;
}

/** The whole message content: a text message with the invite under its key. */
export function buildGameInvite(
    game: GameInvite,
    from: string,
    note?: string,
): Record<string, unknown> {
    return {
        msgtype: "m.text",
        body: gameInviteBody(game, from),
        [GAME_INVITE_KEY]: gameInvitePayload(game, note),
    };
}

/** The invite on a message's content, or null when it has none (or it is bad). */
export function gameInviteOf(content: unknown): ParsedGameInvite | null {
    if (typeof content !== "object" || content === null) return null;
    return parseGameInvite(
        (content as Record<string, unknown>)[GAME_INVITE_KEY],
    );
}

/**
 * A text helper: undefined when absent, null when the wrong type or outside
 * the length bounds, otherwise the string.
 */
function text(v: unknown, max: number, min = 0): string | undefined | null {
    if (v === undefined) return undefined;
    if (typeof v !== "string" || v.length < min || v.length > max) return null;
    return v;
}

const STEAM_ICON = /^[0-9a-f]{40}$/;
const STEAM_ID = /^\d{1,20}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The structured invite's value, or null when any part of it is malformed. */
export function parseGameInvite(value: unknown): ParsedGameInvite | null {
    if (!isRecord(value)) return null;
    const L = GAME_INVITE_LIMITS;

    const app = value.app;
    if (!isRecord(app)) return null;
    const name = text(app.name, L.name, 1);
    if (!name) return null;
    if (app.source !== "steam") return null;

    // A Steam invite has a Steam block and no other game block.
    if (value.discord !== undefined) return null;
    const s = value.steam;
    if (!isRecord(s)) return null;
    const appId = text(s.app_id, L.steamAppId, 1);
    if (!appId || !STEAM_ID.test(appId)) return null;
    // Ids are digits only: they become part of the link. Older invites have no
    // steam_id; they still parse and use the run link.
    const steamId = s.steam_id;
    if (
        steamId !== undefined &&
        (typeof steamId !== "string" || !STEAM_ID.test(steamId))
    )
        return null;
    const lobbyId = s.lobby_id;
    if (
        lobbyId !== undefined &&
        (typeof lobbyId !== "string" || !STEAM_ID.test(lobbyId))
    )
        return null;
    const connect = text(s.connect, L.steamConnect, 1);
    if (connect === null) return null;
    // Handed to the launcher and shown in the confirm step: no control
    // characters, so it cannot hide or split what the user reads.
    if (connect !== undefined && /[\x00-\x1f\x7f]/.test(connect)) return null;
    // Without a connect string the invite must be a lobby join.
    if (connect === undefined && !(steamId && lobbyId)) return null;

    // An icon is only ever a hash, since it becomes part of an image address.
    const icon = s.icon;
    if (
        icon !== undefined &&
        (typeof icon !== "string" || !STEAM_ICON.test(icon))
    )
        return null;

    const game: GameInvite = {
        name,
        steam: {
            appId,
            ...(steamId ? { steamId } : {}),
            ...(lobbyId ? { lobbyId } : {}),
            ...(connect !== undefined ? { connect } : {}),
            ...(icon ? { icon } : {}),
        },
    };

    const details = text(value.details, L.details);
    if (details === null) return null;
    if (details) game.details = details;

    const state = text(value.state, L.state);
    if (state === null) return null;
    if (state) game.state = state;

    if (value.party_size !== undefined) {
        const p = value.party_size;
        if (
            !Array.isArray(p) ||
            p.length !== 2 ||
            !p.every(
                (n) =>
                    typeof n === "number" &&
                    Number.isSafeInteger(n) &&
                    n >= 0 &&
                    n <= L.partyMax,
            )
        )
            return null;
        game.partySize = [p[0], p[1]];
    }

    const note = text(value.note, L.note);
    if (note === null) return null;

    return note ? { ...game, note } : game;
}
