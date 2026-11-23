/**
 * Pure helpers for Matrix widgets: parsing room widget state, building the
 * templated iframe URL, refusing unsafe URLs and describing capabilities.
 * No SDK runtime imports (the event-capability parser from matrix-widget-api
 * is a pure function), so everything here is unit-testable.
 */
import {
    EventDirection,
    EventKind,
    WidgetEventCapability,
} from "matrix-widget-api";

/** Both state types rooms use for widgets; `m.widget` is the newer one. */
export const WIDGET_STATE_TYPES = [
    "im.vector.modular.widgets",
    "m.widget",
] as const;
export type WidgetStateType = (typeof WIDGET_STATE_TYPES)[number];

export interface RoomWidget {
    /** state_key */
    id: string;
    stateType: WidgetStateType;
    /** content.type (e.g. "m.custom", "jitsi", "m.etherpad") */
    type: string;
    /** Raw template url from content. */
    url: string;
    /** content.name, falling back to the url host. */
    name: string;
    /** content.data or {}. */
    data: Record<string, unknown>;
    creatorUserId: string;
    senderId: string;
    waitForIframeLoad: boolean;
    /** content.avatar_url (mxc) or null. */
    avatarUrl: string | null;
}

const CALL_WIDGET_TYPES: ReadonlySet<string> = new Set([
    "m.call",
    "io.element.call",
    "org.matrix.msc3401.call",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses the url if it is an absolute http(s) URL, else null. */
function parseHttpUrl(raw: string): URL | null {
    try {
        const parsed = new URL(raw);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
            ? parsed
            : null;
    } catch {
        return null;
    }
}

/**
 * Parses one widget state event. Returns null for anything that is not a
 * usable widget: an unknown state type, an empty state key, removed (empty)
 * content, a missing type or url, or a url that is not http(s).
 */
export function parseWidgetState(
    stateType: string,
    stateKey: string,
    content: unknown,
    sender: string,
): RoomWidget | null {
    if (!(WIDGET_STATE_TYPES as readonly string[]).includes(stateType))
        return null;
    const id = stateKey.trim();
    if (!id) return null;
    if (!isPlainObject(content) || Object.keys(content).length === 0)
        return null;

    const type = typeof content.type === "string" ? content.type.trim() : "";
    const rawUrl = typeof content.url === "string" ? content.url.trim() : "";
    if (!type || !rawUrl) return null;
    const parsed = parseHttpUrl(rawUrl);
    if (!parsed) return null;

    const declaredName =
        typeof content.name === "string" ? content.name.trim() : "";
    const creator =
        typeof content.creatorUserId === "string" && content.creatorUserId
            ? content.creatorUserId
            : sender;
    const avatar =
        typeof content.avatar_url === "string" &&
        content.avatar_url.startsWith("mxc://")
            ? content.avatar_url
            : null;

    return {
        id,
        stateType: stateType as WidgetStateType,
        type,
        url: rawUrl,
        name: declaredName || parsed.host,
        data: isPlainObject(content.data) ? content.data : {},
        creatorUserId: creator,
        senderId: sender,
        waitForIframeLoad:
            typeof content.waitForIframeLoad === "boolean"
                ? content.waitForIframeLoad
                : true,
        avatarUrl: avatar,
    };
}

/** Element Call widgets: hidden, because Zam has native MatrixRTC calls. */
export function isCallWidget(w: Pick<RoomWidget, "type">): boolean {
    return CALL_WIDGET_TYPES.has(w.type);
}

/**
 * One entry per widget id. The same id under both state types keeps the
 * `m.widget` entry. The result is sorted by name, then id.
 */
export function dedupeWidgets(list: RoomWidget[]): RoomWidget[] {
    const byId = new Map<string, RoomWidget>();
    for (const w of list) {
        const existing = byId.get(w.id);
        if (
            !existing ||
            (w.stateType === "m.widget" && existing.stateType !== "m.widget")
        ) {
            byId.set(w.id, w);
        }
    }
    return [...byId.values()].sort(
        (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}

export interface WidgetUrlContext {
    userId: string;
    displayName: string;
    avatarUrl: string;
    roomId: string;
    deviceId: string;
    baseUrl: string;
    theme: "light" | "dark";
    language: string;
    /** "moe.crafty.zam" */
    clientId: string;
}

/**
 * Replaces the template variables in a widget url, then sets the `widgetId`
 * and `parentUrl` query parameters. Values are URI-encoded. The longest names
 * are replaced first so a short key never matches inside a longer one.
 */
export function buildWidgetUrl(
    w: Pick<RoomWidget, "id" | "url" | "data">,
    ctx: WidgetUrlContext,
    parentUrl: string,
): string {
    const vars = new Map<string, string>([
        ["$matrix_user_id", ctx.userId],
        ["$matrix_room_id", ctx.roomId],
        ["$matrix_display_name", ctx.displayName],
        ["$matrix_avatar_url", ctx.avatarUrl],
        ["$matrix_widget_id", w.id],
        ["$org.matrix.msc2873.client_id", ctx.clientId],
        ["$org.matrix.msc2873.client_theme", ctx.theme],
        ["$org.matrix.msc2873.client_language", ctx.language],
        ["$org.matrix.msc3819.matrix_device_id", ctx.deviceId],
        ["$org.matrix.msc4039.matrix_base_url", ctx.baseUrl],
    ]);
    for (const [key, value] of Object.entries(w.data)) {
        if (
            typeof value !== "string" &&
            typeof value !== "number" &&
            typeof value !== "boolean"
        ) {
            continue;
        }
        const name = `$${key}`;
        if (!vars.has(name)) vars.set(name, String(value));
    }

    // encodeURIComponent never emits "$", so a substituted value cannot be
    // matched by a later, shorter key.
    let out = w.url;
    const names = [...vars.keys()].sort((a, b) => b.length - a.length);
    for (const name of names) {
        out = out.split(name).join(encodeURIComponent(vars.get(name) ?? ""));
    }

    const url = new URL(out);
    url.searchParams.set("widgetId", w.id);
    url.searchParams.set("parentUrl", parentUrl);
    return url.toString();
}

/** The origin of an absolute URL, or null if it cannot be parsed. */
export function widgetOrigin(url: string): string | null {
    try {
        const origin = new URL(url).origin;
        return origin === "null" ? null : origin;
    } catch {
        return null;
    }
}

/**
 * True when the widget url must not be loaded: not http(s), unparsable, or on
 * the app's own origin (same-origin plus allow-scripts would escape the
 * iframe sandbox).
 */
export function isUnsafeWidgetUrl(url: string, appOrigin: string): boolean {
    const parsed = parseHttpUrl(url);
    if (!parsed) return true;
    const app = widgetOrigin(appOrigin) ?? appOrigin;
    return parsed.origin === app;
}

export type CapabilityDescription = {
    key: string;
    params: Record<string, string>;
};

const SIMPLE_CAPABILITY_KEYS: Record<string, string> = {
    "m.always_on_screen": "widgets.cap.alwaysOnScreen",
    "org.matrix.msc2931.always_on_screen": "widgets.cap.alwaysOnScreen",
    "m.capability.screenshot": "widgets.cap.screenshot",
    "org.matrix.msc2931.navigate": "widgets.cap.navigate",
    "io.element.requires_client": "widgets.cap.requiresClient",
    "org.matrix.msc3973.user_directory_search": "widgets.cap.userDirectory",
    "org.matrix.msc4039.upload_file": "widgets.cap.uploadFile",
    "org.matrix.msc4039.download_file": "widgets.cap.downloadFile",
};

const TIMELINE_PREFIX = "org.matrix.msc2762.timeline:";

/** Every i18n key `describeCapability` can return; the UI checks these are translated. */
export const WIDGET_CAP_KEYS: string[] = [
    "widgets.cap.alwaysOnScreen",
    "widgets.cap.screenshot",
    "widgets.cap.navigate",
    "widgets.cap.requiresClient",
    "widgets.cap.userDirectory",
    "widgets.cap.uploadFile",
    "widgets.cap.downloadFile",
    "widgets.cap.timelineAll",
    "widgets.cap.timelineRoom",
    "widgets.cap.sendState",
    "widgets.cap.sendStateAny",
    "widgets.cap.receiveState",
    "widgets.cap.receiveStateAny",
    "widgets.cap.sendEvent",
    "widgets.cap.sendMessage",
    "widgets.cap.receiveEvent",
    "widgets.cap.receiveMessage",
    "widgets.cap.sendToDevice",
    "widgets.cap.receiveToDevice",
    "widgets.cap.unknown",
];

/** Maps a capability string to an i18n key under `widgets.cap.*` plus params. */
export function describeCapability(cap: string): CapabilityDescription {
    const simple = SIMPLE_CAPABILITY_KEYS[cap];
    if (simple) return { key: simple, params: {} };

    if (cap.startsWith(TIMELINE_PREFIX)) {
        const roomId = cap.slice(TIMELINE_PREFIX.length);
        if (roomId === "*")
            return { key: "widgets.cap.timelineAll", params: {} };
        return { key: "widgets.cap.timelineRoom", params: { roomId } };
    }

    const [parsed] = WidgetEventCapability.findEventCapabilities([cap]);
    if (parsed && parsed.kind !== EventKind.RoomAccount) {
        const send = parsed.direction === EventDirection.Send;
        const eventType = parsed.eventType;
        if (parsed.kind === EventKind.State) {
            const stateKey = parsed.keyStr ?? "";
            if (send) {
                return stateKey
                    ? {
                          key: "widgets.cap.sendState",
                          params: { eventType, stateKey },
                      }
                    : {
                          key: "widgets.cap.sendStateAny",
                          params: { eventType },
                      };
            }
            return stateKey
                ? {
                      key: "widgets.cap.receiveState",
                      params: { eventType, stateKey },
                  }
                : { key: "widgets.cap.receiveStateAny", params: { eventType } };
        }
        if (parsed.kind === EventKind.Event) {
            if (parsed.keyStr) {
                const msgtype = parsed.keyStr;
                return send
                    ? { key: "widgets.cap.sendMessage", params: { msgtype } }
                    : {
                          key: "widgets.cap.receiveMessage",
                          params: { msgtype },
                      };
            }
            return send
                ? { key: "widgets.cap.sendEvent", params: { eventType } }
                : { key: "widgets.cap.receiveEvent", params: { eventType } };
        }
        if (parsed.kind === EventKind.ToDevice) {
            return send
                ? { key: "widgets.cap.sendToDevice", params: { eventType } }
                : { key: "widgets.cap.receiveToDevice", params: { eventType } };
        }
    }

    return { key: "widgets.cap.unknown", params: { capability: cap } };
}
