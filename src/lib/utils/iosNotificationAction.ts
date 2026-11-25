/**
 * Maps an iOS notification response (category actions registered in
 * ios/App/App/NotificationActions.swift) to the window bridge hook the
 * Android MainActivity calls for the same action. Mark-as-read and invite
 * decline run natively on iOS and never reach JS; a plain tap arrives with
 * actionId "tap".
 */
export type IosNotificationHookCall =
    | {
          hook: "__matrixOpenRoom";
          args: [string, string | undefined, boolean, string | undefined];
      }
    | {
          hook: "__matrixReplyFromNotification";
          args: [string, string | undefined, string, string | undefined];
      }
    | {
          hook: "__matrixInviteFromNotification";
          args: [string, string | undefined, boolean];
      };

function str(v: unknown): string | undefined {
    return typeof v === "string" && v ? v : undefined;
}

export function iosNotificationHookCall(
    actionId: string,
    data: Record<string, unknown> | null | undefined,
    inputValue?: string,
): IosNotificationHookCall | null {
    const roomId = str(data?.room_id);
    if (!roomId) return null;
    const userId = str(data?.user_id);
    const eventId = str(data?.event_id);
    switch (actionId) {
        case "zam.reply": {
            const text = (inputValue ?? "").trim();
            if (!text) break;
            return {
                hook: "__matrixReplyFromNotification",
                args: [roomId, eventId, text, userId],
            };
        }
        case "zam.invite_accept":
            return {
                hook: "__matrixInviteFromNotification",
                args: [roomId, userId, true],
            };
        case "zam.call_join":
            return {
                hook: "__matrixOpenRoom",
                args: [roomId, userId, true, undefined],
            };
        case "zam.mark_read":
        case "zam.invite_decline":
        case "zam.call_decline":
            return null;
    }
    return {
        hook: "__matrixOpenRoom",
        args: [roomId, userId, false, eventId],
    };
}
