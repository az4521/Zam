/**
 * Builds the per-plugin `zam` host object (spec §6). Every register/add/on
 * pushes an entry into the shared registry and returns a Disposable; every
 * Disposable is tracked so disposeAll() (disable/onunload) removes exactly
 * this plugin's contributions. The ONLY plugin module that imports client.ts.
 * matrix.* are thin 2-arg-safe wrappers returning plain summaries; storage and
 * settings are namespaced per plugin. Imperative UI (openPopover/notify/
 * startReply) routes through hostBridge, wired by later items.
 */
import type { Manifest } from "./manifest";
import type { ZamPluginApi, Disposable } from "./types";
import type { PluginRegistryData } from "./registry";
import { addEntry } from "./registry";
import {
    validateSchema,
    coerceValues,
    type SettingsSchema,
} from "./settingsSchema";
import { settingsStorageKey } from "./pluginSettingsStore";
import { hostBridge } from "./hostBridge";
import { createAssetAccess, type PluginFileSource } from "./pluginAssets";
import { connectNative, nativeAvailable } from "./pluginNative";
import { framesAvailable, injectFrameScript } from "./pluginFrames";
import { removeStyleSheet, setStyleSheet } from "../utils/customCss";
import {
    messageElement,
    observeDom,
    regionElement,
    styleElement,
} from "./pluginDom";
import { rendererProblem } from "./pluginRenderers";
import { closePluginPanelOf, openRegisteredPanel } from "./pluginPanel.svelte";
import { navigateToRoom } from "../stores/rooms.svelte";
import { viewedRoomId } from "./pluginNav.svelte";
import { sendReaction, getOwnUserId, getClient } from "../matrix/client";
import {
    sendEventContent,
    getPluginRoomSummary,
    getPluginRoomMembers,
    sendPluginSticker,
    getPluginRecentMessages,
    uploadPluginMedia,
    sendPluginMedia,
    redactOwnEvent,
    getPluginMedia,
    sendPluginEvent,
    getPluginEvent,
    getPluginRooms,
    getPluginState,
    listPluginState,
    canSetPluginState,
    setPluginState,
    getPluginAccountData,
    setPluginAccountData,
    getPluginProfile,
    getPluginPresence,
} from "../matrix/pluginHost";
import {
    clearPluginPresence,
    setPluginPresence,
} from "../stores/richPresence.svelte";
import {
    getCachedProfile,
    requestProfile,
} from "../stores/profileFields.svelte";
import { PROFILE_FIELDS, readFieldWithLegacy } from "../utils/extendedProfile";
import { parseRpcField } from "../utils/richPresence";
import { entryToPluginPresence, pluginPresenceToEntry } from "./pluginPresence";

export interface BuildHostApiOptions {
    pluginId: string;
    manifest: Manifest;
    registry: PluginRegistryData;
    appVersion: string;
    /** Where a repo plugin's files come from (null: built-in). */
    source?: PluginFileSource | null;
}

export interface PluginHost {
    zam: ZamPluginApi;
    /** Tear down every registration + settings subscription this plugin made. */
    disposeAll(): void;
    /** Persist + broadcast new settings values (called by the settings form,
     *  item 5). Values are coerced against the plugin's schema first. */
    setSettings(values: Record<string, unknown>): void;
}

function warnNoopDisposable(what: string): Disposable {
    console.warn(`[zam] ${what} is not wired yet (pending a later build item)`);
    return { dispose() {} };
}

export function buildHostApi(opts: BuildHostApiOptions): PluginHost {
    const { pluginId, manifest, registry, appVersion } = opts;
    const source = opts.source ?? null;

    // Track every Disposable so disposeAll removes exactly this plugin's
    // contributions. Wrap so self-dispose and disposeAll share one idempotent
    // removal.
    const disposables = new Set<Disposable>();
    let styleCount = 0;
    const track = (inner: Disposable): Disposable => {
        let done = false;
        const wrapped: Disposable = {
            dispose() {
                if (done) return;
                done = true;
                inner.dispose();
                disposables.delete(wrapped);
            },
        };
        disposables.add(wrapped);
        return wrapped;
    };

    // --- storage: per-plugin namespaced localStorage ---
    const storageKey = (k: string) => `zam.plugin.${pluginId}.storage.${k}`;
    const storage = {
        get<T>(k: string, fb?: T): T {
            try {
                const raw = localStorage.getItem(storageKey(k));
                return raw === null ? (fb as T) : (JSON.parse(raw) as T);
            } catch {
                return fb as T;
            }
        },
        set(k: string, v: unknown): void {
            try {
                localStorage.setItem(storageKey(k), JSON.stringify(v));
            } catch {
                /* quota / serialization — ignore, storage is best-effort */
            }
        },
        delete(k: string): void {
            try {
                localStorage.removeItem(storageKey(k));
            } catch {
                /* ignore */
            }
        },
    };

    // --- settings: schema-driven, namespaced, coerced ---
    // Key sourced from pluginSettingsStore so the Manager's settings form and
    // this host read/write the exact same localStorage entry.
    const settingsKey = settingsStorageKey(pluginId);
    let schema: SettingsSchema = manifest.settings ?? [];
    const changeListeners = new Set<(v: Record<string, unknown>) => void>();
    const readStored = (): Record<string, unknown> => {
        try {
            const raw = localStorage.getItem(settingsKey);
            const parsed = raw ? JSON.parse(raw) : {};
            return typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch {
            return {};
        }
    };
    const currentValues = (): Record<string, unknown> =>
        coerceValues(schema, readStored());
    const persist = (vals: Record<string, unknown>): void => {
        try {
            localStorage.setItem(settingsKey, JSON.stringify(vals));
        } catch {
            /* ignore */
        }
    };

    const setSettings = (values: Record<string, unknown>): void => {
        const coerced = coerceValues(schema, values);
        persist(coerced);
        for (const l of [...changeListeners]) {
            try {
                l(coerced);
            } catch (e) {
                console.error(
                    `[plugin ${pluginId}] settings onChange threw`,
                    e,
                );
            }
        }
    };

    const settings = {
        define(s: SettingsSchema): void {
            const res = validateSchema(s);
            if (!res.valid) {
                throw new Error(
                    `[plugin ${pluginId}] invalid settings schema: ${res.errors.join("; ")}`,
                );
            }
            schema = s;
            // Seed coerced defaults so get() is stable before the user edits.
            persist(currentValues());
        },
        get<T>(k: string, fb?: T): T {
            const v = currentValues()[k];
            return (v === undefined ? fb : v) as T;
        },
        onChange(
            handler: (values: Record<string, unknown>) => void,
        ): Disposable {
            changeListeners.add(handler);
            return track({
                dispose() {
                    changeListeners.delete(handler);
                },
            });
        },
    };

    const zam: ZamPluginApi = {
        app: { version: appVersion },
        plugin: { id: pluginId, manifest },

        commands: {
            register: (cmd) =>
                track(addEntry(registry, "commands", pluginId, cmd)),
        },

        composer: {
            addButton: (btn) =>
                track(addEntry(registry, "composerButtons", pluginId, btn)),
            addAction: (action) =>
                track(addEntry(registry, "composerActions", pluginId, action)),
            startReply: (ctx) => {
                if (hostBridge.startReply) {
                    hostBridge.startReply(ctx);
                } else {
                    console.warn(
                        "[zam] composer.startReply is not wired yet (pending a later build item)",
                    );
                }
            },
            startEdit: (ctx) => {
                if (hostBridge.startEdit) {
                    hostBridge.startEdit(ctx);
                } else {
                    console.warn(
                        "[zam] composer.startEdit is not wired yet (no room area mounted)",
                    );
                }
            },
            insertText: (ctx) => {
                if (hostBridge.insertText) {
                    hostBridge.insertText(ctx);
                } else {
                    console.warn(
                        "[zam] composer.insertText is not wired yet (no composer mounted)",
                    );
                }
            },
        },

        messages: {
            transformOutgoing: (fn) =>
                track(
                    addEntry(registry, "outgoingTextTransforms", pluginId, fn),
                ),
            transformOutgoingContent: (fn) =>
                track(
                    addEntry(
                        registry,
                        "outgoingContentTransforms",
                        pluginId,
                        fn,
                    ),
                ),
            transformPreviewUrl: (fn) =>
                track(addEntry(registry, "previewUrlTransforms", pluginId, fn)),
            onDoubleTap: (h) =>
                track(addEntry(registry, "doubleTapHandlers", pluginId, h)),
            onSwipe: (h) =>
                track(addEntry(registry, "swipeHandlers", pluginId, h)),
            addAction: (a) =>
                track(addEntry(registry, "messageActions", pluginId, a)),
            decorate: (fn) =>
                track(addEntry(registry, "decorators", pluginId, fn)),
            annotate: (fn) =>
                track(addEntry(registry, "annotators", pluginId, fn)),
            refresh: () => {
                registry.tick++;
            },
            registerEmbed: (e) =>
                track(addEntry(registry, "embeds", pluginId, e)),
            registerRenderer: (r) => {
                const problem = rendererProblem(r);
                if (problem)
                    throw new Error(
                        `[plugin ${pluginId}] registerRenderer: ${problem}`,
                    );
                return track(
                    addEntry(registry, "messageRenderers", pluginId, r),
                );
            },
        },

        room: {
            addHeaderButton: (btn) =>
                track(addEntry(registry, "headerButtons", pluginId, btn)),
            addSettingsTab: (tab) =>
                track(addEntry(registry, "roomSettingsTabs", pluginId, tab)),
        },

        rooms: {
            addAction: (a) =>
                track(addEntry(registry, "roomActions", pluginId, a)),
        },

        members: {
            decorate: (fn) =>
                track(addEntry(registry, "memberDecorators", pluginId, fn)),
            refresh: () => {
                registry.tick++;
            },
            addAction: (a) =>
                track(addEntry(registry, "userActions", pluginId, a)),
            addProfileSection: (sec) =>
                track(addEntry(registry, "profileSections", pluginId, sec)),
        },

        navigation: {
            getActiveRoomId: () => viewedRoomId(),
            openRoom: (roomId, o) => navigateToRoom(roomId, o?.eventId),
        },

        dom: {
            region: (name) => regionElement(name),
            messageElement: (eventId) => messageElement(eventId),
            observe: (selector, observer) =>
                track(observeDom(selector, observer)),
            style: (el, props) => track(styleElement(el, props)),
        },

        shortcuts: {
            register: (sc) =>
                track(addEntry(registry, "shortcuts", pluginId, sc)),
        },

        ui: {
            openPopover: (o) =>
                hostBridge.openPopover
                    ? track(
                          hostBridge.openPopover({
                              ...o,
                              label: o.label ?? manifest.name,
                          }),
                      )
                    : warnNoopDisposable("ui.openPopover"),
            registerPanel: (p) =>
                track(addEntry(registry, "panels", pluginId, p)),
            openPanel: (id, o) => {
                const entry = registry.panels.find(
                    (e) => e.pluginId === pluginId && e.value.id === id,
                );
                if (!entry)
                    throw new Error(
                        `[plugin ${pluginId}] openPanel: no panel "${id}" registered`,
                    );
                const roomId = o?.roomId ?? viewedRoomId();
                if (!roomId) return;
                openRegisteredPanel(pluginId, roomId, entry.value);
            },
            closePanel: () => closePluginPanelOf(pluginId),
            addOverlay: (o) =>
                track(addEntry(registry, "overlays", pluginId, o)),
            addSettingsPage: (page) =>
                track(addEntry(registry, "settingsPages", pluginId, page)),
            addStyles: (css) => {
                const id = `plugin:${pluginId}:${++styleCount}`;
                setStyleSheet(id, String(css));
                return track({ dispose: () => removeStyleSheet(id) });
            },
            notify: (o) => {
                if (hostBridge.notify) {
                    hostBridge.notify(o);
                } else {
                    console.warn(
                        "[zam] ui.notify is not wired yet (pending a later build item)",
                    );
                }
            },
        },

        events: {
            on: (event, handler) =>
                track(
                    addEntry(registry, "eventSubs", pluginId, {
                        event,
                        handler: handler as (payload: unknown) => void,
                    }),
                ),
        },

        matrix: {
            sendMessage: (roomId, content) =>
                sendEventContent(
                    roomId,
                    content as Record<string, unknown>,
                ).then(() => {}),
            sendImage: (roomId, file) =>
                sendEventContent(roomId, {
                    msgtype: "m.image",
                    body: file.body ?? "image",
                    url: file.url,
                    info: file.info ?? {},
                }).then(() => {}),
            sendSticker: (roomId, sticker, thread) =>
                sendPluginSticker(roomId, sticker, thread),
            sendMedia: (roomId, blob, opts) =>
                sendPluginMedia(roomId, blob, opts ?? {}),
            getRoomSummary: (roomId) => getPluginRoomSummary(roomId),
            getMembers: (roomId) => getPluginRoomMembers(roomId),
            react: (roomId, eventId, key) => sendReaction(roomId, eventId, key),
            getCurrentUserId: () => getOwnUserId(),
            getMedia: (roomId, eventId) => getPluginMedia(roomId, eventId),
            getRecentMessages: (roomId, limit) =>
                getPluginRecentMessages(roomId, limit),
            uploadMedia: async (file, opts) => ({
                mxcUrl: await uploadPluginMedia(
                    file,
                    opts?.name ?? "upload",
                    opts?.type,
                ),
            }),
            redactOwn: (roomId, eventId, reason) =>
                redactOwnEvent(roomId, eventId, reason),
            sendEvent: async (roomId, type, content) => ({
                eventId: await sendPluginEvent(roomId, type, content),
            }),
            getEvent: (roomId, eventId) => getPluginEvent(roomId, eventId),
            getRooms: () => getPluginRooms(),
            getState: (roomId, type, stateKey) =>
                getPluginState(roomId, type, stateKey),
            listState: (roomId, type) => listPluginState(roomId, type),
            canSetState: (roomId, type) => canSetPluginState(roomId, type),
            setState: (roomId, type, content, stateKey) =>
                setPluginState(roomId, type, content, stateKey),
            getAccountData: (type, roomId) =>
                getPluginAccountData(type, roomId),
            setAccountData: (type, content, roomId) =>
                setPluginAccountData(type, content, roomId),
            getProfile: (userId) => getPluginProfile(userId),
            getPresence: (userId) => getPluginPresence(userId),
        },

        presence: {
            set: (entry) => {
                if (!manifest.capabilities?.includes("presence"))
                    throw new Error(
                        `[plugin ${pluginId}] presence.set needs the "presence" capability`,
                    );
                const parsed = pluginPresenceToEntry(entry, Date.now());
                if (typeof parsed === "string")
                    throw new Error(
                        `[plugin ${pluginId}] presence.set: ${parsed}`,
                    );
                setPluginPresence(
                    pluginId,
                    manifest.name,
                    parsed,
                    entry.expiry !== undefined,
                );
                const id = parsed.id;
                return track({
                    dispose: () => clearPluginPresence(pluginId, id),
                });
            },
            clear: (id) => clearPluginPresence(pluginId, id),
            get: (userId) => {
                const who = userId ?? getOwnUserId();
                if (!who) return [];
                requestProfile(who, 60_000);
                const value = readFieldWithLegacy(
                    getCachedProfile(who),
                    PROFILE_FIELDS.rpc,
                );
                return parseRpcField(value, Date.now()).map(
                    entryToPluginPresence,
                );
            },
        },

        unsafe: {
            getClient: () => getClient(),
        },

        assets: createAssetAccess(pluginId, manifest.assets, source),

        audio: {
            registerMicFilter: (filter) =>
                track(addEntry(registry, "micFilters", pluginId, filter)),
        },

        native: {
            available: () => nativeAvailable(manifest, source),
            connect: () => connectNative(pluginId, manifest, source),
        },

        frames: {
            available: () => framesAvailable(manifest),
            inject: (rule) =>
                track(injectFrameScript(pluginId, manifest, rule)),
        },

        storage,
        settings,
    };

    const disposeAll = (): void => {
        for (const d of [...disposables]) {
            try {
                d.dispose();
            } catch (e) {
                console.error(`[plugin ${pluginId}] dispose threw`, e);
            }
        }
        disposables.clear();
        changeListeners.clear();
        // Entries set without keeping the handle go too.
        clearPluginPresence(pluginId);
        closePluginPanelOf(pluginId);
    };

    return { zam, disposeAll, setSettings };
}
