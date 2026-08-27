<script lang="ts">
    import { onMount } from "svelte";
    import {
        installedPlugins,
        pluginRegistry,
        pluginRepos,
    } from "$lib/stores/plugins.svelte";
    import {
        enablePlugin,
        disablePlugin,
        addRepo,
        removeRepo,
        installRepoPlugin,
        uninstallRepoPlugin,
        disableAllPlugins,
    } from "$lib/plugins/pluginBoot";
    import {
        OFFICIAL_REPO,
        mergeRepoList,
        canAddRepo,
        sortInstalledPlugins,
    } from "$lib/plugins/repoList";
    import {
        normalizeRepoRef,
        rawUrl,
        parseIndex,
        type PluginIndexEntry,
    } from "$lib/plugins/repo";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        Settings,
        Trash2,
        RefreshCw,
        Power,
        TriangleAlert,
    } from "lucide-svelte";
    import PluginSettingsForm from "$lib/components/settings/PluginSettingsForm.svelte";
    import {
        interfaceState,
        openSubPage,
        clearSubPageIfOwner,
    } from "$lib/stores/interface.svelte";
    import { untrack } from "svelte";

    // Installed list — reactively sorted, re-renders on tick
    const installedList = $derived(
        (void pluginRegistry.tick,
        sortInstalledPlugins(
            Object.values(installedPlugins).map((r) => ({
                id: r.manifest.id,
                name: r.manifest.name,
                version: r.manifest.version,
                author: r.manifest.author,
                source: r.source,
                enabled: r.enabled,
                error: r.error,
            })),
        )),
    );

    // Repos list — official first, user repos after
    const repoList = $derived(mergeRepoList(pluginRepos.refs));

    // Per-plugin busy state for enable/disable
    let busy = $state<Record<string, boolean>>({});

    // The plugin whose settings form is open in place (null = manager list).
    let settingsForPluginId = $state<string | null>(null);

    // Stable identity: it is the sub-page ownership token, so it must not be
    // recreated per render. Resets local state only (it runs from the store's own
    // close/supersede paths, so reaching back into the store here is wrong).
    function closeSettingsForm() {
        settingsForPluginId = null;
    }

    // On DESKTOP only, register the form's close with the central dismiss stack so
    // Escape / back pops the form before the settings dialog. On mobile, AppSettings
    // already owns the sub-page slot for the plugins drill-down; claiming it here
    // would supersede AppSettings' handler and unmount this whole tab, so we skip it
    // (Escape on mobile returns straight to the settings category list — acceptable).
    // Mirrors AppSettings' untrack + clearSubPageIfOwner pattern to avoid
    // effect_update_depth_exceeded.
    $effect(() => {
        if (!settingsForPluginId || interfaceState.isMobile) return;
        untrack(() => openSubPage(closeSettingsForm));
        return () => clearSubPageIfOwner(closeSettingsForm);
    });

    async function toggle(id: string, next: boolean) {
        busy[id] = true;
        try {
            if (next) {
                await enablePlugin(id);
            } else {
                await disablePlugin(id);
            }
        } finally {
            busy[id] = false;
        }
    }

    async function remove(id: string) {
        await uninstallRepoPlugin(id);
    }

    // Repos add
    let repoInput = $state("");
    let repoError = $state("");

    function submitAddRepo() {
        const res = canAddRepo(pluginRepos.refs, repoInput);
        if (!res.ok) {
            repoError = res.reason ?? "Cannot add this repo.";
            return;
        }
        addRepo(res.normalized!);
        repoError = "";
        repoInput = "";
        void loadRepo(res.normalized!);
    }

    // Browse state per repo
    type BrowseState = {
        loading: boolean;
        entries: PluginIndexEntry[];
        error: string | null;
    };
    let browse = $state<Record<string, BrowseState>>({});

    async function loadRepo(ref: string) {
        browse[ref] = { loading: true, entries: [], error: null };
        try {
            const parsed = normalizeRepoRef(ref);
            const res = await fetch(rawUrl(parsed, "index.json"));
            if (!res.ok) {
                browse[ref] = {
                    loading: false,
                    entries: [],
                    error: `No index.json (${res.status})`,
                };
                return;
            }
            browse[ref] = {
                loading: false,
                entries: parseIndex(await res.json()),
                error: null,
            };
        } catch (e) {
            browse[ref] = {
                loading: false,
                entries: [],
                error: (e as Error).message,
            };
        }
    }

    // Initial Browse fetch on mount
    onMount(() => {
        for (const r of mergeRepoList(pluginRepos.refs)) {
            void loadRepo(r.ref);
        }
    });

    // Install a repo plugin
    let installError = $state("");

    async function install(ref: string, entry: PluginIndexEntry) {
        installError = "";
        const res = await installRepoPlugin(ref, entry);
        if (!res.ok) {
            installError = res.error ?? "Install failed.";
        }
    }

    // Disable all plugins
    async function disableAll() {
        await disableAllPlugins();
    }
</script>

{#if settingsForPluginId}
    <PluginSettingsForm
        pluginId={settingsForPluginId}
        onBack={closeSettingsForm}
    />
{:else}
    <div class="space-y-6">
        <!-- Installed -->
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                Installed
            </p>
            {#if installedList.length === 0}
                <p class="text-sm text-discord-textMuted text-center py-8">
                    No plugins installed.
                </p>
            {:else}
                <div class="space-y-2">
                    {#each installedList as p (p.id)}
                        {@const hasSettings =
                            (installedPlugins[p.id]?.manifest.settings
                                ?.length ?? 0) > 0}
                        <div
                            class="flex items-start gap-3 p-3 rounded bg-discord-backgroundTertiary"
                        >
                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-sm font-medium text-discord-textPrimary"
                                >
                                    {p.name}
                                </p>
                                <p class="text-xs text-discord-textMuted">
                                    v{p.version} · {p.author}
                                </p>
                                {#if p.error}
                                    <div class="flex items-center gap-1.5 mt-1">
                                        <TriangleAlert
                                            size={14}
                                            class="text-discord-danger flex-shrink-0"
                                        />
                                        <p class="text-xs text-discord-danger">
                                            {p.error}
                                        </p>
                                    </div>
                                {/if}
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                {#if hasSettings}
                                    <button
                                        type="button"
                                        onclick={() =>
                                            (settingsForPluginId = p.id)}
                                        title="Plugin settings"
                                        class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                                    >
                                        <Settings size={16} />
                                    </button>
                                {/if}
                                <ToggleSwitch
                                    checked={p.enabled}
                                    onChange={(next) => toggle(p.id, next)}
                                    label="Enable {p.name}"
                                    title={busy[p.id]
                                        ? "Working..."
                                        : undefined}
                                />
                                {#if p.source === "repo"}
                                    <button
                                        type="button"
                                        onclick={() => remove(p.id)}
                                        title="Remove plugin"
                                        class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>

        <!-- Browse -->
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                Browse
            </p>
            {#if installError}
                <p class="text-sm text-discord-danger mb-2">{installError}</p>
            {/if}
            <div class="space-y-4">
                {#each repoList as repo (repo.ref)}
                    <div>
                        <p
                            class="text-sm font-semibold text-discord-textPrimary mb-2"
                        >
                            {repo.ref}
                        </p>
                        {#if browse[repo.ref]?.loading}
                            <p class="text-xs text-discord-textMuted">
                                Loading...
                            </p>
                        {:else if browse[repo.ref]?.error}
                            <p class="text-xs text-discord-textMuted">
                                {browse[repo.ref].error}
                            </p>
                        {:else if !browse[repo.ref]?.entries.length}
                            <p class="text-xs text-discord-textMuted">
                                No plugins in this repo yet.
                            </p>
                        {:else}
                            <div class="space-y-2">
                                {#each browse[repo.ref].entries as entry (entry.id)}
                                    {@const alreadyInstalled =
                                        entry.id in installedPlugins}
                                    <div
                                        class="flex items-start gap-3 p-2 rounded bg-discord-backgroundSecondary"
                                    >
                                        <div class="flex-1 min-w-0">
                                            <p
                                                class="text-sm font-medium text-discord-textPrimary"
                                            >
                                                {entry.name}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textMuted"
                                            >
                                                v{entry.version} · {entry.author}
                                            </p>
                                            <p
                                                class="text-xs text-discord-textSecondary mt-0.5"
                                            >
                                                {entry.description}
                                            </p>
                                        </div>
                                        {#if alreadyInstalled}
                                            <span
                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundTertiary text-discord-textMuted"
                                                >Installed</span
                                            >
                                        {:else}
                                            <button
                                                type="button"
                                                onclick={() =>
                                                    install(repo.ref, entry)}
                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
                                                >Install</button
                                            >
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>

        <!-- Repos -->
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                Repos
            </p>
            <div class="space-y-2 mb-4">
                {#each repoList as repo (repo.ref)}
                    <div
                        class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                    >
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-sm text-discord-textPrimary truncate"
                            >
                                {repo.ref}
                            </p>
                            {#if repo.official}
                                <p class="text-xs text-discord-textMuted">
                                    Official
                                </p>
                            {/if}
                        </div>
                        {#if !repo.official}
                            <button
                                type="button"
                                onclick={() => removeRepo(repo.ref)}
                                title="Remove repo"
                                class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="p-3 rounded bg-discord-backgroundTertiary space-y-3">
                <p class="text-xs text-discord-textPrimary font-medium">
                    Add a repo
                </p>
                <p class="text-xs text-discord-textMuted">
                    Third-party repos run full-trust code with full access to
                    your account and messages. Only add repos you trust.
                </p>
                <div class="flex gap-2">
                    <input
                        type="text"
                        bind:value={repoInput}
                        placeholder="owner/repo or GitHub URL"
                        class="flex-1 px-2.5 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary border border-discord-divider focus:border-discord-accent outline-none"
                        onkeydown={(e) => {
                            if (e.key === "Enter") submitAddRepo();
                        }}
                    />
                    <button
                        type="button"
                        onclick={submitAddRepo}
                        class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
                        >Add repo</button
                    >
                </div>
                {#if repoError}
                    <p class="text-xs text-discord-danger">{repoError}</p>
                {/if}
            </div>
        </section>

        <!-- Actions -->
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                Actions
            </p>
            <div class="space-y-3">
                <button
                    type="button"
                    disabled
                    title="Coming in a later update"
                    class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-discord-backgroundTertiary text-sm font-semibold text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50 disabled:hover:bg-discord-backgroundTertiary"
                >
                    <RefreshCw size={16} />
                    Sync plugins
                </button>

                <button
                    type="button"
                    onclick={disableAll}
                    class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-discord-backgroundTertiary text-sm font-semibold text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                >
                    <Power size={16} />
                    Disable all plugins
                </button>

                <div
                    class="flex items-center gap-3 py-2 border-t border-discord-divider pt-3"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            Auto-update plugins
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            Coming soon.
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={false}
                        onChange={() => {}}
                        label="Auto-update plugins"
                        title="Coming in a later update"
                    />
                </div>
            </div>
        </section>
    </div>
{/if}
