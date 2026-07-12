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
        return {
            status: "ok",
            notifications: (response?.notifications ?? []).map((item: any) => ({
                actions: item.actions ?? [],
                event: mapper(item.event),
                profile_tag: item.profile_tag ?? null,
                read: !!item.read,
                room_id: item.room_id,
                ts: item.ts,
            })),
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
