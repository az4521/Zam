<script lang="ts">
    import { onDestroy } from "svelte";
    import {
        settingsState,
        saveThemePreset,
        deleteThemePreset,
        setActivePreset,
        activePresetColors,
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
        encodeThemePreset,
        decodeThemePreset,
    } from "$lib/utils/themeShare";

    let draft = $state<ThemeColors>({ ...(activePresetColors() ?? {}) });
    let presetName = $state(settingsState.activePreset);
    let importText = $state("");
    let importError = $state("");
    let copied = $state(false);

    const effective = $derived(
        resolveEffectiveColors(settingsState.theme, draft),
    );
    const warnings = $derived(paletteContrastWarnings(effective));

    function setColor(key: ThemeTokenKey, value: string) {
        draft = { ...draft, [key]: value };
        applyThemeColors(draft);
    }

    function resetColor(key: ThemeTokenKey) {
        const updated = { ...draft };
        delete updated[key];
        draft = updated;
        applyThemeColors(draft);
    }

    function applyPreset(name: string) {
        setActivePreset(name);
        if (name === "") {
            draft = {};
            presetName = "";
            applyThemeColors(null);
        } else {
            draft = { ...settingsState.themePresets[name] };
            presetName = name;
        }
    }

    function handleDeletePreset(name: string) {
        const wasActive = settingsState.activePreset === name;
        deleteThemePreset(name);
        if (wasActive) {
            draft = {};
            presetName = "";
        }
    }

    function handleSave() {
        const name = presetName.trim();
        saveThemePreset(name, draft);
        setActivePreset(name);
    }

    async function handleCopyTheme() {
        try {
            await navigator.clipboard.writeText(
                encodeThemePreset({
                    name: presetName || undefined,
                    base: settingsState.theme,
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
            draft = { ...p.colors };
            presetName = p.name ?? presetName;
            applyThemeColors(draft);
            importError = "";
            importText = "";
        }
    }

    onDestroy(() => {
        applyThemeColors(activePresetColors());
    });
</script>

<div>
    <p
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
    >
        Theme colors
    </p>

    <!-- Preset picker -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-2">Presets</p>
        <div class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2 py-1.5">
                <span class="flex-1 text-sm text-discord-textPrimary"
                    >Default (no custom colors)</span
                >
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 transition-colors"
                    onclick={() => applyPreset("")}
                >
                    Apply
                </button>
            </div>
            {#each Object.keys(settingsState.themePresets) as name}
                <div class="flex items-center gap-2 py-1.5">
                    <span class="flex-1 text-sm text-discord-textPrimary"
                        >{name}</span
                    >
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 transition-colors"
                        onclick={() => applyPreset(name)}
                    >
                        Apply
                    </button>
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-discord-danger text-sm text-white hover:bg-discord-danger/90 transition-colors"
                        onclick={() => handleDeletePreset(name)}
                    >
                        Delete
                    </button>
                </div>
            {/each}
        </div>
    </div>

    <!-- Color pickers -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-2">Colors</p>
        <div class="flex flex-col gap-2">
            {#each THEME_TOKENS as token}
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
                        class="w-10 h-8 rounded cursor-pointer"
                    />
                    <span class="text-xs text-discord-textMuted font-mono w-20"
                        >{effective[token.key]}</span
                    >
                    <button
                        type="button"
                        class="px-2 py-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                        onclick={() => resetColor(token.key)}
                        title="Reset to default"
                    >
                        ✕
                    </button>
                </div>
            {/each}
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

    <!-- Save preset -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-2">Save preset</p>
        <div class="flex items-center gap-2">
            <input
                type="text"
                bind:value={presetName}
                placeholder="Preset name"
                class="flex-1 px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border border-discord-divider focus:border-discord-accent outline-none"
            />
            <button
                type="button"
                class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 disabled:opacity-50 disabled:hover:bg-discord-accent transition-colors"
                disabled={presetName.trim() === "" ||
                    Object.keys(draft).length === 0}
                onclick={handleSave}
            >
                Save preset
            </button>
        </div>
    </div>

    <!-- Share -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-2">Share</p>
        <button
            type="button"
            class="px-3 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
            onclick={handleCopyTheme}
        >
            {copied ? "Copied!" : "Copy theme code"}
        </button>
    </div>

    <!-- Import -->
    <div class="mb-4">
        <p class="text-sm text-discord-textPrimary mb-2">Import</p>
        <div class="flex flex-col gap-2">
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
                    class="px-3 py-1.5 rounded bg-discord-accent text-sm text-white hover:bg-discord-accent/90 disabled:opacity-50 disabled:hover:bg-discord-accent transition-colors"
                    disabled={importText.trim() === ""}
                    onclick={handleImport}
                >
                    Import
                </button>
            </div>
            {#if importError}
                <p class="text-xs text-discord-danger">{importError}</p>
            {/if}
        </div>
    </div>
</div>
