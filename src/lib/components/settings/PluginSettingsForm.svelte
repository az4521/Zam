<script lang="ts">
    import {
        installedPlugins,
        getPluginHost,
    } from "$lib/stores/plugins.svelte";
    import {
        readPluginSettings,
        writePluginSettings,
    } from "$lib/plugins/pluginSettingsStore";
    import {
        addListRow,
        removeListRow,
        moveListRow,
        setListCell,
        setFieldValue,
    } from "$lib/plugins/settingsForm";
    import type {
        SettingsField,
        ScalarField,
        ListField,
        SelectField,
        NumberField,
        TextField,
    } from "$lib/plugins/settingsSchema";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        ArrowLeft,
        Plus,
        Trash2,
        ChevronUp,
        ChevronDown,
    } from "lucide-svelte";

    interface Props {
        pluginId: string;
        onBack: () => void;
    }
    let { pluginId, onBack }: Props = $props();

    const record = $derived(installedPlugins[pluginId]);
    const schema = $derived<SettingsField[]>(record?.manifest.settings ?? []);
    const pluginName = $derived(record?.manifest.name ?? pluginId);

    // Initialize once from storage. The user is editing from here on, so this
    // must NOT re-read reactively.
    let values = $state<Record<string, unknown>>(
        readPluginSettings(pluginId, record?.manifest.settings ?? []),
    );

    /** Single write path: update local state, then persist + broadcast via the
     *  live host if enabled, else straight to storage. */
    function persist(next: Record<string, unknown>): void {
        values = next;
        const host = getPluginHost(pluginId);
        if (host) host.setSettings(next);
        else writePluginSettings(pluginId, schema, next);
    }

    function setScalar(key: string, value: unknown): void {
        persist(setFieldValue(values, key, value));
    }

    function rowsOf(key: string): Record<string, unknown>[] {
        const v = values[key];
        return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
    }

    function addRow(field: ListField): void {
        persist(
            setFieldValue(
                values,
                field.key,
                addListRow(rowsOf(field.key), field.fields),
            ),
        );
    }
    function removeRow(field: ListField, i: number): void {
        persist(
            setFieldValue(
                values,
                field.key,
                removeListRow(rowsOf(field.key), i),
            ),
        );
    }
    function moveRow(field: ListField, from: number, to: number): void {
        persist(
            setFieldValue(
                values,
                field.key,
                moveListRow(rowsOf(field.key), from, to),
            ),
        );
    }
    function setCell(
        field: ListField,
        i: number,
        key: string,
        value: unknown,
    ): void {
        persist(
            setFieldValue(
                values,
                field.key,
                setListCell(rowsOf(field.key), i, key, value),
            ),
        );
    }

    const inputClass =
        "w-full px-2.5 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary border border-discord-divider focus:border-discord-accent outline-none";
    const selectClass = inputClass;
</script>

<div class="space-y-4">
    <div class="flex items-center gap-2">
        <button
            type="button"
            onclick={onBack}
            aria-label="Back to plugins"
            class="-ml-2 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
        >
            <ArrowLeft size={20} />
        </button>
        <h3
            class="text-base font-bold text-discord-textPrimary min-w-0 truncate"
        >
            {pluginName} settings
        </h3>
    </div>

    {#if schema.length === 0}
        <p class="text-sm text-discord-textMuted">
            This plugin has no settings.
        </p>
    {:else}
        <div class="space-y-4">
            {#each schema as field (field.key)}
                {#if field.type === "toggle"}
                    <div class="flex items-center gap-3">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm text-discord-textPrimary">
                                {field.label}
                            </p>
                            {#if field.description}
                                <p class="text-xs text-discord-textMuted">
                                    {field.description}
                                </p>
                            {/if}
                        </div>
                        <ToggleSwitch
                            checked={values[field.key] === true}
                            onChange={(next) => setScalar(field.key, next)}
                            label={field.label}
                        />
                    </div>
                {:else if field.type === "text"}
                    <div>
                        <label
                            class="block text-sm text-discord-textPrimary mb-1"
                            for="pf-{field.key}">{field.label}</label
                        >
                        {#if field.description}
                            <p class="text-xs text-discord-textMuted mb-1">
                                {field.description}
                            </p>
                        {/if}
                        <input
                            id="pf-{field.key}"
                            type="text"
                            class={inputClass}
                            placeholder={field.placeholder ?? ""}
                            value={String(values[field.key] ?? "")}
                            oninput={(e) =>
                                setScalar(field.key, e.currentTarget.value)}
                        />
                    </div>
                {:else if field.type === "number"}
                    <div>
                        <label
                            class="block text-sm text-discord-textPrimary mb-1"
                            for="pf-{field.key}">{field.label}</label
                        >
                        {#if field.description}
                            <p class="text-xs text-discord-textMuted mb-1">
                                {field.description}
                            </p>
                        {/if}
                        <input
                            id="pf-{field.key}"
                            type="number"
                            class={inputClass}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={Number(values[field.key] ?? 0)}
                            oninput={(e) =>
                                setScalar(
                                    field.key,
                                    e.currentTarget.value === ""
                                        ? ""
                                        : Number(e.currentTarget.value),
                                )}
                        />
                    </div>
                {:else if field.type === "select"}
                    <div>
                        <label
                            class="block text-sm text-discord-textPrimary mb-1"
                            for="pf-{field.key}">{field.label}</label
                        >
                        {#if field.description}
                            <p class="text-xs text-discord-textMuted mb-1">
                                {field.description}
                            </p>
                        {/if}
                        <select
                            id="pf-{field.key}"
                            class={selectClass}
                            value={String(values[field.key] ?? "")}
                            onchange={(e) =>
                                setScalar(field.key, e.currentTarget.value)}
                        >
                            {#each field.options as opt (opt.value)}
                                <option value={opt.value}>{opt.label}</option>
                            {/each}
                        </select>
                    </div>
                {:else if field.type === "list"}
                    <div>
                        <p class="text-sm text-discord-textPrimary mb-1">
                            {field.label}
                        </p>
                        {#if field.description}
                            <p class="text-xs text-discord-textMuted mb-2">
                                {field.description}
                            </p>
                        {/if}
                        <div class="space-y-2">
                            {#each rowsOf(field.key) as row, i (i)}
                                <div
                                    class="flex items-start gap-2 p-2 rounded bg-discord-backgroundTertiary"
                                >
                                    <div class="flex-1 min-w-0 space-y-2">
                                        {#each field.fields as sub (sub.key)}
                                            {#if sub.type === "toggle"}
                                                <div
                                                    class="flex items-center gap-2"
                                                >
                                                    <span
                                                        class="flex-1 text-xs text-discord-textMuted"
                                                        >{sub.label}</span
                                                    >
                                                    <ToggleSwitch
                                                        checked={row[
                                                            sub.key
                                                        ] === true}
                                                        onChange={(next) =>
                                                            setCell(
                                                                field,
                                                                i,
                                                                sub.key,
                                                                next,
                                                            )}
                                                        label={sub.label}
                                                    />
                                                </div>
                                            {:else if sub.type === "select"}
                                                {@const selectField =
                                                    sub as SelectField}
                                                <select
                                                    class={selectClass}
                                                    aria-label={selectField.label}
                                                    value={String(
                                                        row[selectField.key] ??
                                                            "",
                                                    )}
                                                    onchange={(e) =>
                                                        setCell(
                                                            field,
                                                            i,
                                                            selectField.key,
                                                            e.currentTarget
                                                                .value,
                                                        )}
                                                >
                                                    {#each selectField.options as opt (opt.value)}
                                                        <option
                                                            value={opt.value}
                                                            >{opt.label}</option
                                                        >
                                                    {/each}
                                                </select>
                                            {:else if sub.type === "number"}
                                                {@const numberField =
                                                    sub as NumberField}
                                                <input
                                                    type="number"
                                                    class={inputClass}
                                                    aria-label={numberField.label}
                                                    placeholder={numberField.label}
                                                    min={numberField.min}
                                                    max={numberField.max}
                                                    step={numberField.step}
                                                    value={Number(
                                                        row[numberField.key] ??
                                                            0,
                                                    )}
                                                    oninput={(e) =>
                                                        setCell(
                                                            field,
                                                            i,
                                                            numberField.key,
                                                            e.currentTarget
                                                                .value === ""
                                                                ? ""
                                                                : Number(
                                                                      e
                                                                          .currentTarget
                                                                          .value,
                                                                  ),
                                                        )}
                                                />
                                            {:else}
                                                {@const textField =
                                                    sub as TextField}
                                                <input
                                                    type="text"
                                                    class={inputClass}
                                                    aria-label={textField.label}
                                                    placeholder={textField.type ===
                                                    "text"
                                                        ? (textField.placeholder ??
                                                          textField.label)
                                                        : textField.label}
                                                    value={String(
                                                        row[textField.key] ??
                                                            "",
                                                    )}
                                                    oninput={(e) =>
                                                        setCell(
                                                            field,
                                                            i,
                                                            textField.key,
                                                            e.currentTarget
                                                                .value,
                                                        )}
                                                />
                                            {/if}
                                        {/each}
                                    </div>
                                    <div
                                        class="flex flex-col gap-1 flex-shrink-0"
                                    >
                                        <button
                                            type="button"
                                            onclick={() =>
                                                moveRow(field, i, i - 1)}
                                            disabled={i === 0}
                                            aria-label="Move up"
                                            class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                                        >
                                            <ChevronUp size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() =>
                                                moveRow(field, i, i + 1)}
                                            disabled={i ===
                                                rowsOf(field.key).length - 1}
                                            aria-label="Move down"
                                            class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                                        >
                                            <ChevronDown size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => removeRow(field, i)}
                                            aria-label="Remove row"
                                            class="p-1 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <button
                            type="button"
                            onclick={() => addRow(field)}
                            class="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold bg-discord-backgroundTertiary text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                        >
                            <Plus size={14} />
                            Add
                        </button>
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</div>
