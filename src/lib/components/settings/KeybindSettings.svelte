<script lang="ts">
    import { t } from "$lib/i18n";
    // Settings > Keybinds: every keyboard shortcut, Discord's defaults, and
    // a recorder to change them. Push to talk / push to mute also take a bare
    // modifier or a mouse side button.
    import { onDestroy } from "svelte";
    import {
        KEYBIND_CATEGORIES,
        KEYBIND_DEFS,
        bindingAllowed,
        eventToBinding,
        isModifierKey,
        eventKey,
        mouseButtonKey,
        isKeybindAction,
        type Binding,
        type KeybindAction,
    } from "$lib/keybinds/keybinds";
    import { keybindCategoryLabel, keybindLabel } from "$lib/keybinds/labels";
    import {
        bindingFor,
        isDefaultBinding,
        keybindsState,
        resetAllKeybinds,
        resetKeybind,
        setGlobalVoiceKeybinds,
        setKeybind,
    } from "$lib/stores/keybinds.svelte";
    import {
        globalHotkeysState,
        configureGlobalShortcuts,
        requestGlobalHotkeyPermission,
    } from "$lib/keybinds/desktopHotkeys.svelte";
    import { GLOBAL_ACTIONS } from "$lib/keybinds/globalHotkeys";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import { refreshMicGate } from "$lib/stores/voiceCall.svelte";
    import KeyCaps from "$lib/components/keybinds/KeyCaps.svelte";

    let recordingId = $state<KeybindAction | null>(null);
    /** A modifier pressed on its own while recording a hold action. */
    let pendingModifier: string | null = null;
    let notice = $state("");

    const groups = $derived.by(() => {
        void keybindsState.overrides;
        return KEYBIND_CATEGORIES.map((c) => ({
            category: c,
            rows: KEYBIND_DEFS.filter((d) => d.category === c).map((d) => ({
                def: d,
                binding: bindingFor(d.id),
                isDefault: isDefaultBinding(d.id),
            })),
        }));
    });

    /** A voice action on a mouse button, which the Wayland portal can't
     *  bind. */
    const hasMouseVoiceBinding = $derived.by(() => {
        void keybindsState.overrides;
        return GLOBAL_ACTIONS.some((id) =>
            bindingFor(id)?.key.startsWith("mouse"),
        );
    });

    function hint(id: KeybindAction): string | null {
        if (id === "pushToTalk") return t("keybinds.pushToTalkHint");
        if (id === "pushToMute") return t("keybinds.pushToMuteHint");
        return null;
    }

    function isHold(id: KeybindAction): boolean {
        return !!KEYBIND_DEFS.find((d) => d.id === id)?.hold;
    }

    function startRecording(id: KeybindAction) {
        stopRecording();
        recordingId = id;
        pendingModifier = null;
        notice = "";
        keybindsState.recording = true;
        // Capture phase, so nothing else in the app sees the keys.
        window.addEventListener("keydown", onRecordKeydown, true);
        window.addEventListener("keyup", onRecordKeyup, true);
        window.addEventListener("mousedown", onRecordMouse, true);
    }

    function stopRecording() {
        window.removeEventListener("keydown", onRecordKeydown, true);
        window.removeEventListener("keyup", onRecordKeyup, true);
        window.removeEventListener("mousedown", onRecordMouse, true);
        recordingId = null;
        pendingModifier = null;
        keybindsState.recording = false;
    }

    onDestroy(stopRecording);

    function commit(id: KeybindAction, b: Binding | null) {
        const cleared = setKeybind(id, b);
        if (id === "pushToTalk") refreshMicGate();
        notice = cleared.length
            ? t("keybinds.removedFrom", {
                  actions: cleared.map(keybindLabel).join(", "),
              })
            : "";
        stopRecording();
    }

    function onRecordKeydown(e: KeyboardEvent) {
        const id = recordingId;
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return;
        const key = eventKey(e);
        // Escape on its own cancels; with a modifier it's a binding.
        if (
            key === "escape" &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey &&
            !e.shiftKey
        ) {
            stopRecording();
            return;
        }
        if (isModifierKey(key)) {
            pendingModifier = key;
            return;
        }
        pendingModifier = null;
        const b = eventToBinding(e);
        if (bindingAllowed(b, isHold(id))) commit(id, b);
    }

    function onRecordKeyup(e: KeyboardEvent) {
        const id = recordingId;
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        // A modifier pressed and released on its own: hold actions take it.
        const key = eventKey(e);
        if (pendingModifier && key === pendingModifier && isHold(id)) {
            commit(id, {
                ctrl: false,
                shift: false,
                alt: false,
                meta: false,
                key,
            });
        }
        pendingModifier = null;
    }

    function onRecordMouse(e: MouseEvent) {
        const id = recordingId;
        if (!id || !isHold(id)) return;
        const key = mouseButtonKey(e.button);
        if (!key) return;
        e.preventDefault();
        e.stopPropagation();
        commit(id, {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            key,
        });
    }

    function clear(id: KeybindAction) {
        commit(id, null);
    }

    function reset(id: KeybindAction) {
        resetKeybind(id);
        if (id === "pushToTalk") refreshMicGate();
        notice = "";
    }

    function resetAll() {
        stopRecording();
        resetAllKeybinds();
        refreshMicGate();
        notice = "";
    }
</script>

<div class="flex flex-col gap-6">
    <section>
        <div class="flex items-start gap-3">
            <p class="flex-1 text-sm text-discord-textMuted">
                {t("keybinds.intro")}
            </p>
            <button
                type="button"
                onclick={resetAll}
                class="flex-shrink-0 px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary"
                >{t("keybinds.resetAll")}</button
            >
        </div>
        {#if notice}
            <p class="mt-2 text-xs text-discord-warning" role="status">
                {notice}
            </p>
        {/if}
    </section>

    {#each groups as g (g.category)}
        <section data-setting-anchor="keybinds-{g.category}">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                {keybindCategoryLabel(g.category)}
            </p>
            {#if g.category === "voice" && globalHotkeysState.status}
                {@const status = globalHotkeysState.status}
                <div class="py-2 border-b border-discord-divider">
                    {#if status.state === "wayland"}
                        <p class="text-sm text-discord-textPrimary">
                            {t("keybinds.globalVoice")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("keybinds.globalWayland")}
                        </p>
                    {:else}
                        <div class="flex items-center gap-3">
                            <div class="flex-1">
                                <p class="text-sm text-discord-textPrimary">
                                    {t("keybinds.globalVoice")}
                                </p>
                                <p class="text-xs text-discord-textMuted">
                                    {status.backend === "portal"
                                        ? t("keybinds.globalPortalHint")
                                        : t("keybinds.globalVoiceHint")}
                                </p>
                            </div>
                            <ToggleSwitch
                                checked={keybindsState.globalVoice}
                                onChange={setGlobalVoiceKeybinds}
                                label={t("keybinds.globalVoice")}
                            />
                        </div>
                        {#if keybindsState.globalVoice && status.state === "permission"}
                            <div
                                class="mt-2 flex flex-wrap items-center gap-2"
                                role="status"
                            >
                                <p
                                    class="flex-1 min-w-[12rem] text-xs text-discord-warning"
                                >
                                    {t("keybinds.globalPermission")}
                                </p>
                                <button
                                    type="button"
                                    onclick={() =>
                                        void requestGlobalHotkeyPermission()}
                                    class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary"
                                    >{t("keybinds.globalOpenSettings")}</button
                                >
                            </div>
                        {:else if keybindsState.globalVoice && status.state === "error"}
                            <p
                                class="mt-2 text-xs text-discord-warning"
                                role="status"
                            >
                                {t(
                                    status.backend === "portal"
                                        ? "keybinds.globalPortalError"
                                        : "keybinds.globalError",
                                    { error: status.error ?? "" },
                                )}
                            </p>
                        {:else if keybindsState.globalVoice && status.state === "active" && status.backend === "portal"}
                            <div class="mt-2 flex flex-col gap-1" role="status">
                                <p class="text-xs text-discord-textMuted">
                                    {t("keybinds.globalPortalAssigned")}
                                </p>
                                {#each status.shortcuts ?? [] as s (s.id)}
                                    <p class="text-xs text-discord-textPrimary">
                                        {isKeybindAction(s.id)
                                            ? keybindLabel(s.id)
                                            : s.id}:
                                        <span
                                            class={s.trigger
                                                ? "font-medium"
                                                : "text-discord-textMuted"}
                                            >{s.trigger ||
                                                t("keybinds.notSet")}</span
                                        >
                                    </p>
                                {/each}
                                {#if hasMouseVoiceBinding}
                                    <p class="text-xs text-discord-warning">
                                        {t("keybinds.globalPortalMouse")}
                                    </p>
                                {/if}
                                {#if status.configurable}
                                    <button
                                        type="button"
                                        onclick={configureGlobalShortcuts}
                                        class="self-start mt-1 px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary"
                                        >{t(
                                            "keybinds.globalPortalConfigure",
                                        )}</button
                                    >
                                {/if}
                            </div>
                        {/if}
                    {/if}
                </div>
            {/if}
            {#each g.rows as row (row.def.id)}
                {@const id = row.def.id}
                {@const recording = recordingId === id}
                <div
                    class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b border-discord-divider"
                >
                    <div class="flex-1 min-w-[10rem]">
                        <p class="text-sm text-discord-textPrimary">
                            {keybindLabel(id)}
                        </p>
                        {#if hint(id)}
                            <p class="text-xs text-discord-textMuted">
                                {hint(id)}
                            </p>
                        {/if}
                    </div>
                    <button
                        type="button"
                        onclick={() =>
                            recording ? stopRecording() : startRecording(id)}
                        aria-label={t("keybinds.changeFor", {
                            action: keybindLabel(id),
                        })}
                        aria-pressed={recording}
                        class="min-w-[9rem] px-2 py-1 rounded border text-start {recording
                            ? 'border-discord-accent bg-discord-backgroundTertiary'
                            : 'border-transparent bg-discord-backgroundTertiary hover:border-discord-divider'}"
                    >
                        {#if recording}
                            <span class="text-xs text-discord-accent"
                                >{isHold(id)
                                    ? t("keybinds.pressKeyOrButton")
                                    : t("keybinds.pressKey")}</span
                            >
                        {:else if row.binding}
                            <KeyCaps binding={row.binding} />
                        {:else}
                            <span class="text-xs text-discord-textMuted"
                                >{t("keybinds.notSet")}</span
                            >
                        {/if}
                    </button>
                    <div class="flex items-center gap-1 w-[4.5rem] justify-end">
                        {#if row.binding}
                            <button
                                type="button"
                                onclick={() => clear(id)}
                                title={t("keybinds.clear")}
                                aria-label={t("keybinds.clearFor", {
                                    action: keybindLabel(id),
                                })}
                                class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover"
                            >
                                <svg
                                    class="w-4 h-4"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden="true"
                                    ><path
                                        d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z"
                                    /></svg
                                >
                            </button>
                        {/if}
                        {#if !row.isDefault}
                            <button
                                type="button"
                                onclick={() => reset(id)}
                                title={t("keybinds.reset")}
                                aria-label={t("keybinds.resetFor", {
                                    action: keybindLabel(id),
                                })}
                                class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
                            >
                                <svg
                                    class="w-4 h-4"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    aria-hidden="true"
                                    ><path
                                        d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"
                                    /></svg
                                >
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </section>
    {/each}
</div>
