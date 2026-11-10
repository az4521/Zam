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
    /** `msgtype` is the event's `msgtype` (`m.audio`, `m.text`, ...), so an
     *  action can limit itself to one kind of message. */
    when?(ctx: { roomId: string; eventId: string; msgtype: string }): boolean;
    onSelect(ctx: {
        roomId: string;
        eventId: string;
        msgtype: string;
    }): void | Promise<void>;
}

export type MessageDecorator = (ctx: {
    roomId: string;
    eventId: string;
    senderId: string;
}) => { badge?: string; tooltip?: string } | null;

/** Text shown under a voice message (a transcript, say). `busy` shows a
 *  spinner in place of, or beside, the text. */
export interface MessageAnnotation {
    text?: string;
    busy?: boolean;
}

export type MessageAnnotator = (ctx: {
    roomId: string;
    eventId: string;
    msgtype: string;
}) => MessageAnnotation | null;

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

/** A section of the room settings dialog (beside General, Access, ...). */
export interface RoomSettingsTabRegistration {
    id: string;
    label: string;
    /** Whether the room gets this tab. Defaults to every room and space. */
    when?(ctx: { roomId: string; isSpace: boolean }): boolean;
    /** Runs each time the tab is opened; the cleanup when it is left or the
     *  dialog closes. */
    render(
        el: HTMLElement,
        ctx: { roomId: string; isSpace: boolean },
    ): void | (() => void);
}

/** A page of the app settings dialog, listed under the "Plugins" group. */
export interface SettingsPageRegistration {
    id: string;
    label: string;
    render(el: HTMLElement): void | (() => void);
}

/** What a member list row shows beside a user. `subtitle` is the second
 *  line (a status, say); `badge` a short tag after the name. */
export interface MemberDecoration {
    badge?: string;
    subtitle?: string;
    tooltip?: string;
}

export type MemberDecorator = (ctx: {
    roomId: string;
    userId: string;
}) => MemberDecoration | null;

/** A button on a user's profile card. */
export interface UserActionItem {
    id: string;
    label: string;
    when?(ctx: UserActionContext): boolean;
    onSelect(ctx: UserActionContext): void | Promise<void>;
}

export interface UserActionContext {
    userId: string;
    /** The room the card was opened from. */
    roomId: string;
    isSelf: boolean;
}

/** Plugin content inside a user's profile card, under the profile fields. */
export interface ProfileSectionRegistration {
    id: string;
    render(el: HTMLElement, ctx: UserActionContext): void | (() => void);
}

/** An entry in a room's right-click / long-press menu in the room list. */
export interface RoomActionItem {
    id: string;
    label: string;
    when?(ctx: { roomId: string; isSpace: boolean }): boolean;
    onSelect(ctx: { roomId: string; isSpace: boolean }): void | Promise<void>;
}

/** Renders timeline events Zam has no view of its own for: a custom event
 *  type (`eventType`, e.g. "com.example.superreact"), or a custom `msgtype`
 *  of `m.room.message`. Zam's own types can't be taken over. */
export interface MessageRenderer {
    eventType?: string;
    msgtype?: string;
    render(el: HTMLElement, ctx: MessageRenderContext): void | (() => void);
}

export interface MessageRenderContext {
    roomId: string;
    eventId: string;
    sender: string;
    type: string;
    /** A copy of the (latest edit of the) content. */
    content: Record<string, unknown>;
    timestamp: number;
    isOwn: boolean;
}

/** Named parts of Zam's window, for zam.dom.region. Each is marked with a
 *  `data-zam-region` attribute, which is also fine to use in CSS. */
export type ZamRegion =
    | "app"
    | "space-sidebar"
    | "room-list"
    | "room-header"
    | "timeline"
    | "composer"
    | "member-list";

export interface DomObserver {
    /** Runs for every element matching the selector, now and as they
     *  appear. A function it returns runs when the element leaves the page
     *  or the observer is disposed. */
    added(el: HTMLElement): void | (() => void);
}

export interface OverlayOptions {
    render(el: HTMLElement): void | (() => void);
    /** Let the overlay take clicks. Off by default: clicks go through it to
     *  Zam, except on children that set `pointer-events: auto`. */
    interactive?: boolean;
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

/** Rewrites the URL a link preview is fetched from (the link itself, as
 *  shown and opened, is unchanged). Return the URL to request instead. */
export type PreviewUrlTransform = (url: string) => string;

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

export type SwipeThreshold = "short" | "far";

export type SwipeHandler = (ctx: {
    roomId: string;
    eventId: string;
    isOwn: boolean;
    canEdit: boolean;
    threshold: SwipeThreshold;
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

/** A timeline event as plugins see it: a plain copy, never a MatrixEvent. */
export interface PluginTimelineEvent {
    roomId: string;
    eventId: string;
    sender: string;
    type: string;
    content: Record<string, unknown>;
    timestamp: number;
    isOwn: boolean;
    /** False for events that came in with the first sync after start-up
     *  (history, not news). */
    isLive: boolean;
}

/** What each `events.on` name hands its handler. */
export interface PluginEventMap {
    /** A new message, sticker, poll or file offer in a room's main
     *  timeline (not thread replies or edits). */
    message: PluginTimelineEvent;
    /** Same as "message"; kept for older plugins. */
    timeline: PluginTimelineEvent;
    /** The server accepted an event sent from this device. */
    "message-sent": {
        roomId: string;
        eventId: string;
        type: string;
        content: Record<string, unknown>;
    };
    "reaction-added": {
        roomId: string;
        eventId: string;
        sender: string;
        /** The reacted-to event and the reaction key (an emoji or mxc://). */
        targetEventId: string | null;
        key: string | null;
        relatesTo: unknown;
        isOwn: boolean;
        isLive: boolean;
    };
    /** Someone joined a room you are in (after start-up). */
    "member-join": { roomId: string; userId: string; displayName: string };
    /** Who is typing in a room changed. Excludes you. */
    typing: { roomId: string; userIds: string[] };
    /** The user opened a room (`roomId` null: left for a non-room view). */
    "room-enter": { roomId: string | null; previousRoomId: string | null };
    "room-update": Record<string, never>;
    /** Zam showed a desktop notification for a message. */
    notification: {
        roomId: string;
        eventId: string;
        title: string;
        body: string;
    };
    sync: { state: "PREPARED" | "RECONNECTED" };
}

export interface EventSubscription {
    event: PluginEventName;
    handler: (payload: unknown) => void;
}

/** Plain, serializable recent-message summary — never a live MatrixEvent. */
export interface PluginTimelineMessage {
    eventId: string;
    sender: string;
    msgtype: string;
    body: string;
    timestamp: number;
    isRedacted: boolean;
    isOwn: boolean;
}

/** Plain, serializable room summary handed to plugins — never a live Room. */
export interface PluginRoomSummary {
    roomId: string;
    name: string;
    topic: string | null;
    memberCount: number;
    /** http avatar URL (already proxied from mxc), or null. */
    avatarUrl: string | null;
    /** m.room.join_rules value ("invite"/"public"/…); "invite" if unset. */
    joinRule: string;
    isSpace: boolean;
}

/** One loaded event, for matrix.getEvent. */
export interface PluginEventSummary {
    eventId: string;
    roomId: string;
    sender: string;
    type: string;
    /** Latest edit's content; a copy. */
    content: Record<string, unknown>;
    timestamp: number;
    isRedacted: boolean;
    isOwn: boolean;
}

export interface PluginPresenceState {
    presence: "online" | "unavailable" | "offline";
    statusMsg: string | null;
    /** Unix ms of the user's last activity, if known. */
    lastActiveAt: number | null;
    currentlyActive: boolean;
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

/** One running instance of a mic filter, in the chain's 48 kHz context. */
export interface MicFilterInstance {
    /** Input 0: the mic (mono). Output 0: the filtered mic. */
    node: AudioNode;
    /** Output carrying the unfiltered mic delayed to line up with output 0,
     *  if the filter has one: Zam's pause gate then quietens what the filter
     *  leaves between words. Without it, no gate. */
    dryOutput?: number;
    /** Zam sets this: call it if the filter stops coping mid-stream (too
     *  slow, its backend died) and Zam swaps DeepFilterNet3 in. */
    onFailure: ((reason: string) => void) | null;
    /** Release everything; the node is already disconnected. */
    close(): void;
}

/** What Zam asks of a noise filter when building it. */
export interface MicFilterOptions {
    /** Most the filter may take off any part of the signal, in dB (the
     *  Debug settings slider; 25 by default, 100 is effectively unlimited). A
     *  filter without such a cap can ignore it. */
    attenuationDb: number;
}

/** A rule for embedded pages (zam.frames): a script, a referrer, or both. */
export interface FrameScript {
    /** Each names at least a whole origin, e.g. "https://www.youtube.com/"
     *  or "https://www.youtube.com/embed/". */
    urlPrefixes: string[];
    /** Source run in the frame's page, as with a <script> there. */
    script?: string;
    /** Sent as the Referer when a frame loads a matching URL, in place of
     *  Zam's own address (an absolute http(s) URL, e.g.
     *  "https://example.com/"). With several rules, the first added wins. */
    referrer?: string;
}

/** A noise filter for the user's own microphone (zam.audio). It appears in
 *  Settings > Voice & Audio > Noise suppression; Zam's AGC (WebRTC AGC2), soft clipper
 *  and (with dryOutput) pause gate run after it, and DeepFilterNet3 stands in
 *  wherever it can't run. */
export interface MicFilter {
    id: string;
    label: string;
    /** One sentence for the settings page. */
    description?: string;
    /** False where it can't run (e.g. a device it found too slow): Zam goes
     *  straight to DeepFilterNet3. Defaults to true. */
    available?(): boolean;
    /** Ahead of a call: get ready so create() is quick. "failed" means it
     *  won't run here (Zam readies DeepFilterNet3 instead); "timeout" that
     *  it is still getting ready. */
    prepare?(timeoutMs: number): Promise<"ready" | "timeout" | "failed">;
    /** Background download of its files, some time after startup. */
    prefetch?(): Promise<void>;
    /** Build an instance for `ctx` (48 kHz). Throw if it can't run here. */
    create(
        ctx: AudioContext,
        opts?: MicFilterOptions,
    ): Promise<MicFilterInstance>;
}

interface PluginPresenceBase {
    /** The plugin's own name for the entry: setting the same id again
     *  replaces it. */
    id: string;
    /** Unix ms when the entry stops counting. Omit and Zam keeps it on the
     *  profile until it is cleared or the plugin unloads. At most 15 minutes
     *  ahead. */
    expiry?: number;
    /** Up to 3, http(s) links only. */
    buttons?: { label: string; url: string }[];
}

/** Rich presence (MSC4544): what the user is doing, on their profile. */
export interface PluginPresenceActivity extends PluginPresenceBase {
    kind: "activity";
    name: string;
    state?: string;
    details?: string;
    /** Unix ms, shown as elapsed or remaining time. */
    since?: number;
    until?: number;
    /** mxc:// URIs (zam.matrix.uploadMedia). A small icon needs a large one. */
    largeIconUrl?: string;
    smallIconUrl?: string;
    largeIconTooltip?: string;
    smallIconTooltip?: string;
}

export interface PluginPresenceMusic extends PluginPresenceBase {
    kind: "music";
    track: string;
    artist?: string;
    album?: string;
    playerName?: string;
    /** mxc:// URI. */
    coverUrl?: string;
    /** Unix ms; both or neither. */
    progress?: { since: number; until: number };
}

export type PluginPresence = PluginPresenceActivity | PluginPresenceMusic;

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
        /** Rewrite the URL a link preview is requested for, e.g. to route a
         *  site the homeserver cannot reach through a mirror. */
        transformPreviewUrl(fn: PreviewUrlTransform): Disposable;
        onDoubleTap(handler: DoubleTapHandler): Disposable;
        /** Fired when a message row is swiped left past a threshold (item 6).
         *  short = reply intent, far = edit intent (gated on canEdit: your own
         *  editable text message). Detection stays core; the action is the plugin's. */
        onSwipe(handler: SwipeHandler): Disposable;
        addAction(action: MessageActionItem): Disposable;
        decorate(fn: MessageDecorator): Disposable;
        /** Text under a voice message (`m.audio`) with the sender's waveform,
         *  e.g. a transcript. The function runs again for every message each
         *  time `refresh()` is called, so keep it cheap and pure. */
        annotate(fn: MessageAnnotator): Disposable;
        /** Re-run the `annotate` functions after the plugin's own data
         *  changed. */
        refresh(): void;
        registerEmbed(embed: MessageEmbed): Disposable;
        /** Show a custom event type or msgtype in the timeline (see
         *  MessageRenderer). Throws for types Zam renders itself. */
        registerRenderer(renderer: MessageRenderer): Disposable;
    };

    room: {
        addHeaderButton(btn: HeaderButton): Disposable;
        /** A tab of the room settings dialog. */
        addSettingsTab(tab: RoomSettingsTabRegistration): Disposable;
    };

    /** The room list. */
    rooms: {
        /** An entry in a room's context menu. */
        addAction(action: RoomActionItem): Disposable;
    };

    /** The member list and profile cards. */
    members: {
        /** A badge and/or second line beside users in the member list. Runs
         *  for every visible member each time the list or `refresh()`
         *  changes, so keep it cheap; fetch elsewhere and refresh. */
        decorate(fn: MemberDecorator): Disposable;
        /** Re-run the `decorate` functions after the plugin's data changed. */
        refresh(): void;
        /** A button on profile cards. */
        addAction(action: UserActionItem): Disposable;
        /** Content on profile cards. */
        addProfileSection(section: ProfileSectionRegistration): Disposable;
    };

    /** Where the user is. */
    navigation: {
        /** The open room, or null when another view (inbox, space home) is
         *  showing. Listen to the "room-enter" event for changes. */
        getActiveRoomId(): string | null;
        /** Open a room, switching space if needed; with `eventId`, scroll to
         *  that message. */
        openRoom(roomId: string, opts?: { eventId?: string }): void;
    };

    /**
     * Zam's own DOM. Plugins run in the page with full access, but Zam's
     * markup is Svelte's: it re-renders and drops what a plugin changed, and
     * removing or moving its nodes breaks it. So: read it, decorate it with
     * `style()` and classes, put your own nodes beside it or in an overlay,
     * and treat anything not named here (a Tailwind class, nesting depth) as
     * changeable without notice. The stable hooks are `data-zam-region`,
     * `data-event-id` and `data-sender` on message rows, `data-user-id` on
     * member rows and `data-room-id` on room list rows.
     */
    dom: {
        region(name: ZamRegion): HTMLElement | null;
        /** The row of a message in the open timeline, if it is on screen. */
        messageElement(eventId: string): HTMLElement | null;
        /** Watch for elements matching a CSS selector (see DomObserver). */
        observe(selector: string, observer: DomObserver): Disposable;
        /** Set inline styles (CSS property names, e.g. "transform",
         *  "--my-var") on any element; disposing, or unloading the plugin,
         *  puts the old values back. */
        style(el: HTMLElement, props: Record<string, string>): Disposable;
    };

    shortcuts: { register(sc: ShortcutRegistration): Disposable };

    ui: {
        openPopover(opts: {
            anchor: HTMLElement;
            render(el: HTMLElement): void | (() => void);
            /** Accessible name of the popover dialog; defaults to the plugin's name. */
            label?: string;
        }): Disposable;
        /** A side panel beside the timeline, opened with `openPanel`. */
        registerPanel(panel: PanelRegistration): Disposable;
        /** Open a registered panel for a room (the active one if omitted),
         *  closing whatever side panel was open. */
        openPanel(id: string, opts?: { roomId?: string }): void;
        /** Close this plugin's panel if one is open. */
        closePanel(): void;
        /** A layer over the whole window (effects, animations, games). */
        addOverlay(opts: OverlayOptions): Disposable;
        /** A page of the app settings, for more than a `settings` schema
         *  can express. */
        addSettingsPage(page: SettingsPageRegistration): Disposable;
        notify(opts: { title?: string; body: string }): void;
        /** Add CSS to the app (a theme, a tweak), after Zam's own styles and
         *  before the user's custom CSS. Removed when the returned handle is
         *  disposed or the plugin unloads. Call it again for a new stylesheet;
         *  each call is its own. The theme's colours are variables set on <html>
         *  (`--discord-bg`, ...), so override them with `!important`. */
        addStyles(css: string): Disposable;
    };

    events: {
        on<K extends PluginEventName>(
            event: K,
            handler: (payload: PluginEventMap[K]) => void,
        ): Disposable;
    };

    matrix: {
        sendMessage(roomId: string, content: object): Promise<void>;
        /**
         * Send an image message (m.image) with the given url and info.
         * **IMPORTANT:** This sends PLAINTEXT (unencrypted) even in encrypted
         * rooms. Prefer `sendMedia` for new code, which encrypts attachments in
         * encrypted rooms.
         */
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
        /**
         * Upload a Blob and send it as a media message (m.image/m.video/m.audio/m.file).
         * **Encrypts attachments in encrypted rooms** (except m.video, which is queued).
         * Prefer this over `uploadMedia` + `sendImage` for new plugin code.
         */
        sendMedia(
            roomId: string,
            blob: Blob,
            opts?: {
                name?: string;
                type?: string;
                body?: string;
                msgtype?: string;
            },
        ): Promise<void>;
        getRoomSummary(roomId: string): PluginRoomSummary | null;
        getMembers(roomId: string): PluginMemberSummary[];
        react(roomId: string, eventId: string, key: string): Promise<void>;
        /** The logged-in user's Matrix ID, or null if not logged in. Lets a
         *  decorator/handler tell "is this mine?" from a bare senderId. */
        getCurrentUserId(): string | null;
        /** The attachment of an `m.audio`, `m.video`, `m.image` or `m.file`
         *  message, downloaded and decrypted if the room is encrypted. Rejects
         *  when the event is not found or has no attachment. */
        getMedia(
            roomId: string,
            eventId: string,
        ): Promise<{ blob: Blob; mimetype: string }>;
        /** Last `limit` renderable messages in the room (default 20, max 100),
         *  chronological, as plain summaries — never live MatrixEvents. */
        getRecentMessages(
            roomId: string,
            limit?: number,
        ): PluginTimelineMessage[];
        /**
         * Upload a Blob/File and resolve to its `mxc://` URL, e.g. to then
         * `sendImage`. **Uploads PLAINTEXT (unencrypted)** even in encrypted rooms.
         * Prefer `sendMedia` for new code, which encrypts in encrypted rooms.
         * Rejects if not logged in / upload fails.
         */
        uploadMedia(
            file: Blob,
            opts?: { name?: string; type?: string },
        ): Promise<{ mxcUrl: string }>;
        /** Redact one of YOUR OWN events (unsend). Rejects if the event is not
         *  yours or not found — a plugin cannot redact others' messages here. */
        redactOwn(
            roomId: string,
            eventId: string,
            reason?: string,
        ): Promise<void>;
        /** Send an event of any non-state type (a custom one such as
         *  "com.example.superreact", say), encrypted in encrypted rooms.
         *  Resolves with its event id once the server has it. */
        sendEvent(
            roomId: string,
            type: string,
            content: Record<string, unknown>,
        ): Promise<{ eventId: string }>;
        /** One event the client has loaded, or null. */
        getEvent(roomId: string, eventId: string): PluginEventSummary | null;
        /** The rooms (not spaces) and spaces you have joined. */
        getRooms(): PluginRoomSummary[];
        /** A room state event's content, or null if unset. */
        getState(
            roomId: string,
            type: string,
            stateKey?: string,
        ): Record<string, unknown> | null;
        /** Every state event of a type, one per state key. */
        listState(
            roomId: string,
            type: string,
        ): {
            stateKey: string;
            sender: string;
            content: Record<string, unknown>;
        }[];
        /** Whether you have the power level to send that state event type. */
        canSetState(roomId: string, type: string): boolean;
        /** Set a room state event (needs the power level for it). */
        setState(
            roomId: string,
            type: string,
            content: Record<string, unknown>,
            stateKey?: string,
        ): Promise<void>;
        /** Your account data (synced to all your devices), or null. With
         *  `roomId`, your data for that room. */
        getAccountData(
            type: string,
            roomId?: string,
        ): Record<string, unknown> | null;
        setAccountData(
            type: string,
            content: Record<string, unknown>,
            roomId?: string,
        ): Promise<void>;
        /** A user's global display name and avatar, from the server. */
        getProfile(
            userId: string,
        ): Promise<{ displayName: string | null; avatarUrl: string | null }>;
        /** A user's online status as Zam last heard it, or null when the
         *  server sends none. */
        getPresence(userId: string): PluginPresenceState | null;
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

    /** Files listed in the manifest's `assets`, from the plugin's pinned
     *  commit, checked against their SHA-256 and kept on the device. Repo
     *  plugins only. */
    assets: {
        get(path: string): Promise<ArrayBuffer>;
        /** A blob: URL (a worklet or worker module, a wasm file); revoke it
         *  when done. */
        url(path: string, type?: string): Promise<string>;
        /** Whether it is on the device already (no download needed). */
        cached(path: string): Promise<boolean>;
    };

    /** Needs the "audio" capability. */
    audio: {
        registerMicFilter(filter: MicFilter): Disposable;
    };

    /** The plugin's own native code (manifest `native`): desktop and
     *  Android apps, needs the "native" capability, and runs only after the
     *  user agrees in a system dialog. Zam downloads and checks the files,
     *  then starts the platform's host: on desktop a script in a utility
     *  process (it receives each port as a {type: "connect"} message on
     *  process.parentPort); on Android a class loaded into the app
     *  (moe.crafty.matrix.PluginNativeHost). Each connect() is a new
     *  MessagePort to it; send only strings and ArrayBuffers over it, and
     *  don't transfer the buffers (copy them): Electron drops transferred
     *  ones, Android's ports carry nothing else. */
    native: {
        available(): boolean;
        connect(): Promise<MessagePort>;
    };

    /** Rules for the pages embedded in Zam (a YouTube player, say). For
     *  every iframe whose URL starts with one of `urlPrefixes`, the desktop
     *  app sends `referrer` as its Referer, and runs `script` each time it
     *  finishes loading its DOM, in that page's own context (where the
     *  plugin's own code can't reach across origins). Desktop only, needs
     *  the "frames" capability; elsewhere inject() does nothing. */
    frames: {
        available(): boolean;
        inject(rule: FrameScript): Disposable;
    };

    /** Rich presence (MSC4544), the "Playing ..." / "Listening to ..." card
     *  on profiles. */
    presence: {
        /** Put an entry on the user's profile, or replace the one with the
         *  same id. Needs the "presence" capability. It appears under the
         *  plugin's name in Settings > Rich presence, where the user can
         *  switch it off; then nothing is published, and set() still
         *  succeeds. Malformed entries throw. Disposing clears the entry. */
        set(entry: PluginPresence): Disposable;
        /** Take one entry (or, with no id, all of this plugin's) off. */
        clear(id?: string): void;
        /** Current entries on a user's profile (the logged-in user when
         *  omitted), from what Zam has loaded; asks the server for a fresh
         *  copy in the background when it is older than a minute. */
        get(userId?: string): PluginPresence[];
    };

    /** Full-power escape hatch (full-trust model). Returns the live matrix-js-sdk
     *  client instance (or null before login). You own the stability + safety risk —
     *  this is unmediated SDK access that can change across app refactors. Prefer the
     *  curated `matrix.*` API where it covers your need. */
    unsafe: {
        getClient(): unknown;
    };
}

/** The shape a plugin bundle's default export (or built-in module) satisfies. */
export interface PluginModule {
    onload(zam: ZamPluginApi): void | Promise<void>;
    onunload?(): void | Promise<void>;
}
