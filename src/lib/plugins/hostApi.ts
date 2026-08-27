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
import { hostBridge } from "./hostBridge";
import {
    sendEventContent,
    sendReaction,
    getPluginRoomSummary,
    getPluginRoomMembers,
} from "../matrix/client";

export interface BuildHostApiOptions {
    pluginId: string;
    manifest: Manifest;
    registry: PluginRegistryData;
    appVersion: string;
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

    // Track every Disposable so disposeAll removes exactly this plugin's
    // contributions. Wrap so self-dispose and disposeAll share one idempotent
    // removal.
    const disposables: Disposable[] = [];
    const track = (inner: Disposable): Disposable => {
        let done = false;
        const wrapped: Disposable = {
            dispose() {
                if (done) return;
                done = true;
                inner.dispose();
            },
        };
        disposables.push(wrapped);
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
    const settingsKey = `zam.plugin.${pluginId}.settings`;
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
                hostBridge.startReply?.(ctx);
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
            onDoubleTap: (h) =>
                track(addEntry(registry, "doubleTapHandlers", pluginId, h)),
            addAction: (a) =>
                track(addEntry(registry, "messageActions", pluginId, a)),
            decorate: (fn) =>
                track(addEntry(registry, "decorators", pluginId, fn)),
            registerEmbed: (e) =>
                track(addEntry(registry, "embeds", pluginId, e)),
        },

        room: {
            addHeaderButton: (btn) =>
                track(addEntry(registry, "headerButtons", pluginId, btn)),
        },

        shortcuts: {
            register: (sc) =>
                track(addEntry(registry, "shortcuts", pluginId, sc)),
        },

        ui: {
            openPopover: (o) =>
                hostBridge.openPopover
                    ? track(hostBridge.openPopover(o))
                    : warnNoopDisposable("ui.openPopover"),
            registerPanel: (p) =>
                track(addEntry(registry, "panels", pluginId, p)),
            notify: (o) => {
                hostBridge.notify?.(o);
            },
        },

        events: {
            on: (event, handler) =>
                track(
                    addEntry(registry, "eventSubs", pluginId, {
                        event,
                        handler,
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
            getRoomSummary: (roomId) => getPluginRoomSummary(roomId),
            getMembers: (roomId) => getPluginRoomMembers(roomId),
            react: (roomId, eventId, key) => sendReaction(roomId, eventId, key),
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
        disposables.length = 0;
        changeListeners.clear();
    };

    return { zam, disposeAll, setSettings };
}
