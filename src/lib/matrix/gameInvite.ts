import { t } from "$lib/i18n";
import { getClient } from "$lib/matrix/runtime";
import {
    buildGameInvite,
    gameInviteOf,
    type GameInvite,
} from "$lib/utils/gameInvite";

/**
 * Send a game invite as a normal text message. The body is what every client
 * shows; the structured invite rides under its custom key for Zam.
 */
export async function sendGameInvite(
    roomId: string,
    game: GameInvite,
    note?: string,
): Promise<void> {
    const client = getClient();
    if (!client) throw new Error(t("client.notLoggedIn"));
    const userId = client.getUserId() ?? "";
    const from =
        client.getRoom(roomId)?.getMember(userId)?.name || userId || "";
    const content = buildGameInvite(game, from, note?.trim() || undefined);
    // Never send what the receiver would reject.
    if (!gameInviteOf(content)) throw new Error(t("gameInvite.failedToSend"));
    await client.sendEvent(roomId, "m.room.message" as never, content as never);
}
