/**
 * The ids the Android push service posts a room's notification under
 * (MatrixMessagingService.notificationKey / notificationId, which this
 * mirrors). A notification is keyed by the account it was posted for and the
 * room, "@user|!room", so two accounts in one room get separate notifications.
 * The key is built on the device from the account records; nothing of it is
 * sent to the push gateway.
 */

/** Java's String.hashCode(). */
export function javaStringHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}

export function nativeNotificationKey(
    userId: string | null | undefined,
    roomId: string,
): string {
    return userId ? `${userId}|${roomId}` : roomId;
}

/**
 * Every id `userId`'s notification for `roomId` may be showing under: the
 * per-account id, and the room-only id used before ids were per account.
 */
export function nativeNotificationIds(
    userId: string | null | undefined,
    roomId: string,
): number[] {
    const ids = [javaStringHash(nativeNotificationKey(userId, roomId))];
    if (userId) ids.push(javaStringHash(roomId));
    return ids;
}
