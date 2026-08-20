export interface CallNotifyContent {
    application: "m.call";
    call_id: string;
    "m.mentions": { user_ids: string[]; room: false };
    notify_type: "ring" | "notify";
}

/** MSC4075 m.call.notify content. `call_id: ""` is the room-scoped MatrixRTC
 *  call. Recipients come from m.mentions (the push rule notifies them). */
export function buildCallNotifyContent(opts: {
    calleeUserIds: string[];
    callId?: string;
    notifyType?: "ring" | "notify";
}): CallNotifyContent {
    return {
        application: "m.call",
        call_id: opts.callId ?? "",
        "m.mentions": {
            user_ids: [...new Set(opts.calleeUserIds)],
            room: false,
        },
        notify_type: opts.notifyType ?? "ring",
    };
}
