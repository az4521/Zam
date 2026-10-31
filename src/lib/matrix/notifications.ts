import { type MatrixClient, MatrixEvent } from "matrix-js-sdk";

export interface ServerNotification {
    actions: unknown[];
    event: MatrixEvent;
    profile_tag: string | null;
    read: boolean;
    room_id: string;
    ts: number;
}

export type ServerNotificationResult =
    | {
          status: "ok";
          notifications: ServerNotification[];
          nextToken?: string;
      }
    | { status: "unsupported" }
    | { status: "error"; error: unknown };

export async function fetchServerNotificationsForClient(
    client: MatrixClient,
    limit = 50,
    from?: string,
): Promise<ServerNotificationResult> {
    const params: Record<string, string> = { limit: String(limit) };
    if (from) params.from = from;
    try {
        const response: any = await (client as any).http.authedRequest(
            "GET",
            "/notifications",
            params,
        );
        const mapper = client.getEventMapper();
        const notifications: ServerNotification[] = (
            response?.notifications ?? []
        ).map((item: any) => ({
            actions: item.actions ?? [],
            // The room id sits beside the event, not in it, and an encrypted
            // event without one is taken for a to-device message and fails.
            event: mapper({ ...item.event, room_id: item.room_id }),
            profile_tag: item.profile_tag ?? null,
            read: !!item.read,
            room_id: item.room_id,
            ts: item.ts,
        }));
        // The mapper kicks off decryption but returns synchronously, and these
        // events are on no timeline, so nothing would redraw the inbox when it
        // finished. A bundled edit is a second event that supplies the content.
        await Promise.all(
            notifications
                .flatMap(({ event }) => [event, event.replacingEvent()])
                .filter((event) => !!event)
                .map((event) =>
                    client.decryptEventIfNeeded(event).catch(() => {}),
                ),
        );
        return {
            status: "ok",
            notifications,
            nextToken: response?.next_token,
        };
    } catch (error: any) {
        if (
            error?.httpStatus === 404 ||
            error?.errcode === "M_UNRECOGNIZED" ||
            error?.data?.errcode === "M_UNRECOGNIZED"
        ) {
            return { status: "unsupported" };
        }
        return { status: "error", error };
    }
}
