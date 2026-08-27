/**
 * Type contracts for the Zam plugin host API. Pure types only — no runtime,
 * no SDK/DOM imports. `ZamPluginApi` is the `zam` object a plugin's onload
 * receives; the value types below are what each extension point stores in the
 * registry. Grown as extension points are wired; keep it the single source of
 * truth for the plugin contract.
 */
import type { Manifest } from "./manifest";
import type { SettingsSchema } from "./settingsSchema";

/** One undo handle. `dispose()` is idempotent by contract. */
export interface Disposable {
    dispose(): void;
}

interface PluginCommandBase {
    name: string;
    aliases?: string[];
    description: string;
    argKind?: "none" | "text" | "user" | "roomAlias";
}

/** Action command — MessageInput calls `run(ctx)`; the host composes nothing.
 *  The default plugin-command flavor (sample plugin, third-party tools). */
export interface PluginActionCommand extends PluginCommandBase {
    run(ctx: { roomId: string; arg: string }): void | Promise<void>;
}

/** Transform/emote command — the host composes a standard `m.text`/`m.emote`
 *  from the command's pure `transform` (text-transform) or the raw arg (emote),
 *  routed through the SAME core send path as a built-in slash command, so
 *  markdown, mentions, thread targeting and reply-clear are all preserved.
 *  Used by the built-in fun commands. `transform` MUST be pure and MUST NOT
 *  throw (the host guards, but treat it as a contract). */
export interface PluginTransformCommand extends PluginCommandBase {
    kind: "text-transform" | "emote";
    /** text-transform: rewrite the arg into the body. Omit for emote (body = arg). */
    transform?: (arg: string) => string;
    /** text-transform: send verbatim, bypassing markdown (like core /plain). */
    plain?: boolean;
    /** A missing arg is a usage error (shows a toast, sends nothing). */
    requiresArg?: boolean;
    /** Popup hint, e.g. "[message]" / "<message>". */
    argHint?: string;
}

export type PluginCommand = PluginActionCommand | PluginTransformCommand;

export interface ComposerButton {
    id: string;
    label: string;
    icon?: string;
    onClick(ctx: {
        roomId: string;
        anchor: HTMLElement;
        /** Root event id when opened from a thread composer, else null —
         *  lets a plugin post to the active thread (e.g. sticker send). */
        threadRootId: string | null;
    }): void | Promise<void>;
}

export interface ComposerAction {
    id: string;
    label: string;
    icon?: string;
    onSelect(ctx: { roomId: string }): void | Promise<void>;
}

export interface MessageActionItem {
    id: string;
    label: string;
    icon?: string;
    when?(ctx: { roomId: string; eventId: string }): boolean;
    onSelect(ctx: { roomId: string; eventId: string }): void | Promise<void>;
}

export type MessageDecorator = (ctx: {
    roomId: string;
    eventId: string;
    senderId: string;
}) => { badge?: string; tooltip?: string } | null;

export interface MessageEmbed {
    match(url: string): boolean;
    render(
        el: HTMLElement,
        ctx: {
            url: string;
            /**
             * Set `el`'s content from an HTML string, sanitized by the host
             * through `sanitizeMatrixHtml` (Matrix allowlist: no <script>,
             * event handlers, <style>, <iframe>, non-mxc <img src>). This is
             * the host-sanitized render path (spec §6/§7). A plugin may also
             * build DOM imperatively on `el` (its own full-trust DOM, like
             * ui.openPopover); only `ctx.html` is host-sanitized. The Matrix
             * allowlist also strips `class` and `style` attributes; for custom
             * styling build DOM on `el` rather than via `ctx.html`.
             */
            html(markup: string): void;
        },
    ): void | (() => void);
}

export interface HeaderButton {
    id: string;
    label: string;
    icon?: string;
    render(el: HTMLElement, ctx: { roomId: string }): void | (() => void);
}

export interface ShortcutRegistration {
    keys: string;
    description: string;
    run(): void | Promise<void>;
}

export interface PanelRegistration {
    id: string;
    title: string;
    render(el: HTMLElement): void | (() => void);
}

export type OutgoingTextTransform = (
    text: string,
    ctx: { roomId: string },
) => string;

export type OutgoingContentTransform = (
    content: Record<string, unknown>,
    ctx: { roomId: string },
) => Record<string, unknown>;

export type DoubleTapHandler = (ctx: {
    roomId: string;
    eventId: string;
    isOwn: boolean;
}) => void;

export type PluginEventName =
    | "message"
    | "message-sent"
    | "timeline"
    | "reaction-added"
    | "member-join"
    | "typing"
    | "room-enter"
    | "room-update"
    | "notification"
    | "sync";

export interface EventSubscription {
    event: PluginEventName;
    handler: (payload: unknown) => void;
}

/** Plain, serializable room summary handed to plugins — never a live Room. */
export interface PluginRoomSummary {
    roomId: string;
    name: string;
    topic: string | null;
    memberCount: number;
}

/** Plain member summary — never a live RoomMember. */
export interface PluginMemberSummary {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    powerLevel: number;
}

/** Plain, serializable sticker payload a plugin sends — the compose side of
 *  `m.sticker` (rendering stays core, interop rule). Structurally satisfied by
 *  the object the sticker picker yields on select. */
export interface PluginSticker {
    mxcUrl: string;
    body?: string;
    shortcode?: string;
    info?: object;
}

/** The `zam` object a plugin's `onload` receives (spec §6). */
export interface ZamPluginApi {
    app: { version: string };
    plugin: { id: string; manifest: Manifest };

    commands: { register(cmd: PluginCommand): Disposable };

    composer: {
        addButton(btn: ComposerButton): Disposable;
        addAction(action: ComposerAction): Disposable;
        startReply(ctx: { roomId: string; eventId: string }): void;
        /** Start inline edit of your own text message (double-tap-reply's
         *  "edit" action). No-op if the event is not your own editable text. */
        startEdit(ctx: { roomId: string; eventId: string }): void;
        /** Append text to the active composer for the room (URL-as-text rail).
         *  Targets the main composer; no-op if none is mounted for the room. */
        insertText(ctx: { roomId: string; text: string }): void;
    };

    messages: {
        transformOutgoing(fn: OutgoingTextTransform): Disposable;
        transformOutgoingContent(fn: OutgoingContentTransform): Disposable;
        onDoubleTap(handler: DoubleTapHandler): Disposable;
        addAction(action: MessageActionItem): Disposable;
        decorate(fn: MessageDecorator): Disposable;
        registerEmbed(embed: MessageEmbed): Disposable;
    };

    room: { addHeaderButton(btn: HeaderButton): Disposable };

    shortcuts: { register(sc: ShortcutRegistration): Disposable };

    ui: {
        openPopover(opts: {
            anchor: HTMLElement;
            render(el: HTMLElement): void | (() => void);
        }): Disposable;
        registerPanel(panel: PanelRegistration): Disposable;
        notify(opts: { title?: string; body: string }): void;
    };

    events: {
        on(
            event: PluginEventName,
            handler: (payload: unknown) => void,
        ): Disposable;
    };

    matrix: {
        sendMessage(roomId: string, content: object): Promise<void>;
        sendImage(
            roomId: string,
            file: { url: string; info?: object; body?: string },
        ): Promise<void>;
        /** Send a standard `m.sticker` (compose side of the sticker picker).
         *  `thread.rootEventId` targets a thread; omit for the main timeline. */
        sendSticker(
            roomId: string,
            sticker: PluginSticker,
            thread?: { rootEventId: string },
        ): Promise<void>;
        getRoomSummary(roomId: string): PluginRoomSummary | null;
        getMembers(roomId: string): PluginMemberSummary[];
        react(roomId: string, eventId: string, key: string): Promise<void>;
    };

    storage: {
        get<T>(k: string, fb?: T): T;
        set(k: string, v: unknown): void;
        delete(k: string): void;
    };

    settings: {
        define(schema: SettingsSchema): void;
        get<T>(k: string, fb?: T): T;
        onChange(
            handler: (values: Record<string, unknown>) => void,
        ): Disposable;
    };
}

/** The shape a plugin bundle's default export (or built-in module) satisfies. */
export interface PluginModule {
    onload(zam: ZamPluginApi): void | Promise<void>;
    onunload?(): void | Promise<void>;
}
