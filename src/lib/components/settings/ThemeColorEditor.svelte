<script lang="ts">
    import { onDestroy } from "svelte";
    import {
        settingsState,
        setActivePreset,
        saveCustomPreset,
        deleteCustomPreset,
        forkActivePreset,
        activeBase,
        getPresetColors,
        renameCustomPreset,
        setMessageFontSize,
        setMessageFont,
        uploadCustomFont,
        removeCustomFont,
    } from "$lib/stores/settings.svelte";
    import { applyThemeColors } from "$lib/utils/theme";
    import {
        THEME_TOKENS,
        resolveEffectiveColors,
        paletteContrastWarnings,
        type ThemeColors,
        type ThemeTokenKey,
    } from "$lib/utils/themePalette";
    import {
        MESSAGE_FONTS,
        messageFontFamily,
        type MessageFontKey,
        appTextScalePercent,
        MSG_FONT_SIZE_DEFAULT,
    } from "$lib/utils/messageDisplay";
    import {
        encodeThemePreset,
        decodeThemePreset,
    } from "$lib/utils/themeShare";
    import {
        orderedPresetNames,
        isBuiltinPreset,
    } from "$lib/utils/themePreset";

    // Current edit state
    let draft = $state<ThemeColors>({
        ...getPresetColors(settingsState.activePreset),
    });
    let saveNameInput = $state("");
    let importText = $state("");
    let importError = $state("");
    let copied = $state(false);
    let renamingName = $state<string | null>(null);
    let renameValue = $state("");
    let fontFileInput = $state<HTMLInputElement | null>(null);
    let fontUploadError = $state<string | null>(null);
    let fontUploadBusy = $state(false);

    async function handleFontFile(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ""; // allow re-selecting the same filename later
        if (!file) return;
        fontUploadError = null;
        fontUploadBusy = true;
        const res = await uploadCustomFont(file);
        fontUploadBusy = false;
        if (!res.ok) fontUploadError = res.reason;
    }

    async function handleRemoveFont() {
        fontUploadBusy = true;
        fontUploadError = null;
        await removeCustomFont();
        fontUploadBusy = false;
    }

    const activePresetName = $derived(settingsState.activePreset);
    const activeIsBuiltin = $derived(isBuiltinPreset(activePresetName));
    const allPresetNames = $derived(
        orderedPresetNames(settingsState.themePresets),
    );
    const currentBase = $derived(activeBase());

    const effective = $derived(resolveEffectiveColors(currentBase, draft));
    const warnings = $derived(paletteContrastWarnings(effective));

    function setColor(key: ThemeTokenKey, value: string) {
        if (activeIsBuiltin) return; // Built-ins are read-only
        draft = { ...draft, [key]: value };
        // Live-update the active custom preset
        saveCustomPreset(activePresetName, currentBase, draft);
        applyThemeColors(draft);
    }

    function resetColor(key: ThemeTokenKey) {
        if (activeIsBuiltin) return;
        const updated = { ...draft };
        delete updated[key];
        draft = updated;
        saveCustomPreset(activePresetName, currentBase, draft);
        applyThemeColors(draft);
    }

    function selectPreset(name: string) {
        setActivePreset(name);
        draft = { ...getPresetColors(name) };
    }

    function handleDelete(name: string) {
        deleteCustomPreset(name);
    }

    function handleSave() {
        const name = saveNameInput.trim();
        if (!name) return;
        try {
            saveCustomPreset(name, currentBase, draft);
            setActivePreset(name);
            saveNameInput = "";
        } catch (err) {
            importError =
                err instanceof Error ? err.message : "Cannot save preset";
            setTimeout(() => {
                importError = "";
            }, 3000);
        }
    }

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(
                encodeThemePreset({
                    name: activePresetName || undefined,
                    base: currentBase,
                    colors: draft,
                }),
            );
            copied = true;
            setTimeout(() => {
                copied = false;
            }, 2000);
        } catch {
            // Permission denied or insecure context - do nothing
        }
    }

    function handleImport() {
        const p = decodeThemePreset(importText);
        if (p === null) {
            importError = "Not a valid theme code";
        } else {
            const importName = p.name || "Imported";
            try {
                saveCustomPreset(importName, p.base, p.colors);
                setActivePreset(importName);
                draft = { ...p.colors };
                importError = "";
                importText = "";
            } catch (err) {
                importError =
                    err instanceof Error ? err.message : "Cannot import preset";
            }
        }
    }

    function handleDuplicate() {
        if (!activeIsBuiltin) return;
        const copyName = `${activePresetName} (Copy)`;
        forkActivePreset(copyName, draft);
        setActivePreset(copyName);
        draft = { ...getPresetColors(copyName) };
    }

    function startRename(name: string) {
        renamingName = name;
        renameValue = name;
    }

    function commitRename() {
        if (renamingName === null) return;
        const oldName = renamingName;
        const newName = renameValue.trim();
        renamingName = null;

        if (!newName || newName === oldName) {
            // Empty or unchanged - just cancel
            return;
        }

        const success = renameCustomPreset(oldName, newName);
        if (!success) {
            // Collision or invalid - keep editing
            renamingName = oldName;
        }
    }

    function cancelRename() {
        renamingName = null;
        renameValue = "";
    }

    function focus(el: HTMLElement) {
        el.focus();
    }

    onDestroy(() => {
        // Restore active preset's colors on unmount
        const activeColors = getPresetColors(settingsState.activePreset);
        applyThemeColors(
            Object.keys(activeColors).length > 0 ? activeColors : null,
        );
    });
</script>

<div>
    <p
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
    >
        Theme colors
    </p>

    <!-- Top control row: Save | Import [Copy] -->
    <div class="flex flex-col gap-3 mb-4 pb-4 border-b border-discord-divider">
        <!-- Save section -->
        <div>
            <span class="text-xs text-discord-textMuted mb-1 block">Save</span>
            <div class="flex items-center gap-2">
                <input
                    type="text"
                    bind:value={saveNameInput}
                    placeholder="Preset name"
                    class="flex-1 px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border border-discord-divider focus:border-discord-accent outline-none"
                />
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 disabled:opacity-50 transition-colors"
                    disabled={saveNameInput.trim() === ""}
                    onclick={handleSave}
                >
                    Save preset
                </button>
            </div>
        </div>

        <!-- Import + Copy section -->
        <div>
            <span class="text-xs text-discord-textMuted mb-1 block">Import</span
            >
            <div class="flex items-center gap-2">
                <input
                    type="text"
                    bind:value={importText}
                    placeholder="Paste theme code"
                    class="flex-1 px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border {importError
                        ? 'border-discord-danger'
                        : 'border-discord-divider focus:border-discord-accent'} outline-none"
                />
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 disabled:opacity-50 transition-colors"
                    disabled={importText.trim() === ""}
                    onclick={handleImport}
                >
                    Import
                </button>
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                    onclick={handleCopy}
                    title="Copy current preset to clipboard"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
        </div>
    </div>

    {#if importError}
        <p class="text-xs text-discord-danger mb-3">{importError}</p>
    {/if}

    <!-- Presets list -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-2">Presets</p>
        <div class="flex flex-col gap-1">
            {#each allPresetNames as name (name)}
                {@const isBuiltin = isBuiltinPreset(name)}
                {@const isActive = name === activePresetName}
                {@const isRenaming = renamingName === name}
                <div
                    class="flex items-center gap-2 px-3 py-2 rounded {isActive
                        ? 'bg-discord-accent/20 border border-discord-accent'
                        : 'border border-discord-divider hover:bg-discord-messageHover'} transition-colors {isRenaming
                        ? ''
                        : 'cursor-pointer'}"
                    onclick={(e) => {
                        if (isRenaming) return;
                        // A click on a control in the row (rename ✎ / delete) must
                        // not also activate the preset. stopPropagation on those
                        // buttons is unreliable with Svelte's event delegation, so
                        // guard here on the actual click target.
                        if ((e.target as HTMLElement).closest("button")) return;
                        selectPreset(name);
                    }}
                    role="button"
                    tabindex={isRenaming ? -1 : 0}
                    onkeydown={(e) => {
                        // Enter/Space only activates when the ROW is focused. Keys
                        // typed in the rename input (a descendant) bubble here after
                        // commitRename has cleared the renaming flag, which would
                        // otherwise select the preset — ignore those.
                        if ((e.target as HTMLElement).closest("input, button"))
                            return;
                        if (
                            !isRenaming &&
                            (e.key === "Enter" || e.key === " ")
                        ) {
                            e.preventDefault();
                            selectPreset(name);
                        }
                    }}
                >
                    {#if isRenaming}
                        <input
                            type="text"
                            bind:value={renameValue}
                            class="flex-1 px-2 py-1 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border border-discord-accent outline-none"
                            onblur={commitRename}
                            onkeydown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    commitRename();
                                } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelRename();
                                }
                            }}
                            use:focus
                        />
                        <button
                            type="button"
                            class="px-2 py-1 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                            onpointerdown={(e) => {
                                // pointerdown fires before the input's blur, and
                                // preventDefault keeps focus so onblur→commitRename
                                // never runs — otherwise "Cancel" would save.
                                e.preventDefault();
                                e.stopPropagation();
                                cancelRename();
                            }}
                        >
                            Cancel
                        </button>
                    {:else}
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{name}</span
                        >
                        {#if isBuiltin}
                            <span
                                class="px-2 py-0.5 rounded bg-discord-backgroundTertiary text-xs text-discord-textMuted"
                                >Default</span
                            >
                        {:else}
                            <button
                                type="button"
                                class="px-2 py-1 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    startRename(name);
                                }}
                                title="Rename"
                            >
                                ✎
                            </button>
                            <button
                                type="button"
                                class="px-2 py-1 rounded text-xs text-discord-danger hover:bg-discord-danger hover:text-white transition-colors"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(name);
                                }}
                            >
                                Delete
                            </button>
                        {/if}
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    {#if activeIsBuiltin}
        <div
            class="mb-4 p-3 rounded bg-discord-backgroundTertiary border border-discord-divider"
        >
            <p class="text-sm text-discord-textPrimary mb-2">
                Built-in presets are read-only. Duplicate to customize:
            </p>
            <button
                type="button"
                class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 transition-colors"
                onclick={handleDuplicate}
            >
                Duplicate to customize
            </button>
        </div>
    {/if}

    <!-- Color pickers (grouped) -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-3">Colors</p>

        <!-- Backgrounds -->
        <div class="mb-4">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Backgrounds
            </p>
            <div class="flex flex-col gap-2">
                {#each THEME_TOKENS.filter( (t) => ["background", "backgroundSecondary", "backgroundTertiary"].includes(t.key), ) as token}
                    <div
                        class="flex items-center gap-2 py-2 border-b border-discord-divider"
                    >
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{token.label}</span
                        >
                        <input
                            type="color"
                            value={effective[token.key]}
                            oninput={(e) =>
                                setColor(token.key, e.currentTarget.value)}
                            disabled={activeIsBuiltin}
                            class="w-10 h-8 rounded {activeIsBuiltin
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer'}"
                        />
                        <span
                            class="text-xs text-discord-textMuted font-mono w-20"
                            >{effective[token.key]}</span
                        >
                        <button
                            type="button"
                            class="px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 transition-colors"
                            onclick={() => resetColor(token.key)}
                            disabled={activeIsBuiltin}
                            title="Reset to default"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Text -->
        <div class="mb-4">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Text
            </p>
            <div class="flex flex-col gap-2">
                {#each THEME_TOKENS.filter( (t) => ["textPrimary", "textSecondary", "textMuted"].includes(t.key), ) as token}
                    <div
                        class="flex items-center gap-2 py-2 border-b border-discord-divider"
                    >
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{token.label}</span
                        >
                        <input
                            type="color"
                            value={effective[token.key]}
                            oninput={(e) =>
                                setColor(token.key, e.currentTarget.value)}
                            disabled={activeIsBuiltin}
                            class="w-10 h-8 rounded {activeIsBuiltin
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer'}"
                        />
                        <span
                            class="text-xs text-discord-textMuted font-mono w-20"
                            >{effective[token.key]}</span
                        >
                        <button
                            type="button"
                            class="px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 transition-colors"
                            onclick={() => resetColor(token.key)}
                            disabled={activeIsBuiltin}
                            title="Reset to default"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Accents & semantics -->
        <div class="mb-4">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Accents & semantics
            </p>
            <div class="flex flex-col gap-2">
                {#each THEME_TOKENS.filter( (t) => ["accent", "link", "danger", "positive", "warning"].includes(t.key), ) as token}
                    <div
                        class="flex items-center gap-2 py-2 border-b border-discord-divider"
                    >
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{token.label}</span
                        >
                        <input
                            type="color"
                            value={effective[token.key]}
                            oninput={(e) =>
                                setColor(token.key, e.currentTarget.value)}
                            disabled={activeIsBuiltin}
                            class="w-10 h-8 rounded {activeIsBuiltin
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer'}"
                        />
                        <span
                            class="text-xs text-discord-textMuted font-mono w-20"
                            >{effective[token.key]}</span
                        >
                        <button
                            type="button"
                            class="px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 transition-colors"
                            onclick={() => resetColor(token.key)}
                            disabled={activeIsBuiltin}
                            title="Reset to default"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Presence -->
        <div class="mb-4">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Presence
            </p>
            <div class="flex flex-col gap-2">
                {#each THEME_TOKENS.filter( (t) => ["online", "idle", "dnd", "offline"].includes(t.key), ) as token}
                    <div
                        class="flex items-center gap-2 py-2 border-b border-discord-divider"
                    >
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{token.label}</span
                        >
                        <input
                            type="color"
                            value={effective[token.key]}
                            oninput={(e) =>
                                setColor(token.key, e.currentTarget.value)}
                            disabled={activeIsBuiltin}
                            class="w-10 h-8 rounded {activeIsBuiltin
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer'}"
                        />
                        <span
                            class="text-xs text-discord-textMuted font-mono w-20"
                            >{effective[token.key]}</span
                        >
                        <button
                            type="button"
                            class="px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 transition-colors"
                            onclick={() => resetColor(token.key)}
                            disabled={activeIsBuiltin}
                            title="Reset to default"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Details -->
        <div class="mb-4">
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                Details
            </p>
            <div class="flex flex-col gap-2">
                {#each THEME_TOKENS.filter( (t) => ["divider", "mention", "spoilerBackground", "ownBubbleBackground"].includes(t.key), ) as token}
                    <div
                        class="flex items-center gap-2 py-2 border-b border-discord-divider"
                    >
                        <span class="flex-1 text-sm text-discord-textPrimary"
                            >{token.label}</span
                        >
                        <input
                            type="color"
                            value={effective[token.key]}
                            oninput={(e) =>
                                setColor(token.key, e.currentTarget.value)}
                            disabled={activeIsBuiltin}
                            class="w-10 h-8 rounded {activeIsBuiltin
                                ? 'opacity-60 cursor-not-allowed'
                                : 'cursor-pointer'}"
                        />
                        <span
                            class="text-xs text-discord-textMuted font-mono w-20"
                            >{effective[token.key]}</span
                        >
                        <button
                            type="button"
                            class="px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-30 transition-colors"
                            onclick={() => resetColor(token.key)}
                            disabled={activeIsBuiltin}
                            title="Reset to default"
                        >
                            ✕
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    </div>

    <!-- Contrast warnings -->
    {#if warnings.length > 0}
        <div class="mb-4">
            <p class="text-sm text-discord-textPrimary mb-2">
                Contrast warnings
            </p>
            <div class="flex flex-col gap-1">
                {#each warnings as warning}
                    <p class="text-xs text-discord-danger">
                        ⚠ {warning.label}: {warning.ratio}:1
                    </p>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Message display -->
    <div class="mt-6 pt-4 border-t border-discord-divider">
        <p class="text-sm font-semibold text-discord-textPrimary">
            Message display
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            Saved on this device only. Not synced across your account.
        </p>

        <div class="flex items-center justify-between mb-1">
            <label
                class="block text-sm text-discord-textPrimary"
                for="msg-size-range"
            >
                App text size: {Math.round(
                    appTextScalePercent(settingsState.messageFontSize),
                )}%
            </label>
            <button
                type="button"
                class="px-2 py-0.5 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                onclick={() => setMessageFontSize(MSG_FONT_SIZE_DEFAULT)}
            >
                Reset to default
            </button>
        </div>
        <input
            id="msg-size-range"
            type="range"
            min="12"
            max="24"
            step="1"
            class="w-full accent-discord-accent"
            value={settingsState.messageFontSize}
            oninput={(e) => setMessageFontSize(Number(e.currentTarget.value))}
        />
        <p class="mt-1 text-xs text-discord-textMuted">
            Scales all text and spacing across the app.
        </p>

        <label
            class="block text-sm text-discord-textPrimary mt-4 mb-1"
            for="msg-font-select"
        >
            Font
        </label>
        <select
            id="msg-font-select"
            class="input-dark rounded px-2 py-1 w-full"
            value={settingsState.messageFont}
            onchange={(e) =>
                setMessageFont(e.currentTarget.value as MessageFontKey)}
        >
            {#each MESSAGE_FONTS as f (f.key)}
                <option value={f.key}>{f.label}</option>
            {/each}
            {#if settingsState.customFontName}
                <option value="custom"
                    >Custom - {settingsState.customFontName}</option
                >
            {/if}
        </select>
        <input
            bind:this={fontFileInput}
            type="file"
            accept=".woff2,.ttf,.otf"
            class="hidden"
            onchange={handleFontFile}
        />
        <div class="mt-2 flex flex-wrap items-center gap-2">
            <button
                type="button"
                class="px-3 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50 transition-colors"
                onclick={() => fontFileInput?.click()}
                disabled={fontUploadBusy}
            >
                {settingsState.customFontName
                    ? "Replace custom font…"
                    : "Upload custom font…"}
            </button>
            {#if settingsState.customFontName}
                <button
                    type="button"
                    class="px-2 py-1 rounded text-xs text-discord-danger hover:bg-discord-danger hover:text-white disabled:opacity-50 transition-colors"
                    onclick={handleRemoveFont}
                    disabled={fontUploadBusy}
                >
                    Remove
                </button>
            {/if}
        </div>
        {#if fontUploadError}
            <p class="mt-1 text-xs text-discord-danger">{fontUploadError}</p>
        {/if}
        <p class="mt-1 text-xs text-discord-textMuted">
            .woff2, .ttf, or .otf up to 10 MB. Stored on this device only.
        </p>

        <p
            class="mt-3 text-discord-textPrimary"
            style="font-size: 0.875rem; font-family: {messageFontFamily(
                settingsState.messageFont,
            ) ?? 'inherit'};"
        >
            The quick brown fox jumps over the lazy dog.
        </p>
    </div>
</div>
