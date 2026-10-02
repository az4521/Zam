<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import {
        installedPlugins,
        pluginRegistry,
        pluginRepos,
        pluginPrefs,
        pluginUpdates,
        pluginNeedsUpdate,
    } from "$lib/stores/plugins.svelte";
    import {
        enablePlugin,
        disablePlugin,
        addRepo,
        removeRepo,
        installRepoPlugin,
        uninstallRepoPlugin,
        disableAllPlugins,
        pushPluginSync,
        getPullSummary,
        applyPull,
        applyUpdateCheck,
        updateRepoPlugin,
        setGlobalAutoUpdate,
        setPluginAutoUpdate,
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
        repoKey,
        type PluginIndexEntry,
    } from "$lib/plugins/repo";
    import type {
        PullSummary,
        PluginSyncPayload,
    } from "$lib/plugins/pluginSync";
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

    let { navSignal = 0 }: { navSignal?: number } = $props();

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
                repoRef: r.repoRef,
                sha: r.sha,
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

    // Sync sub-view state
    let syncView = $state(false);
    let syncBusy = $state(false);
    let syncMessage = $state("");
    let syncError = $state("");
    let pullSummary = $state<PullSummary | null>(null);
    let pullPayload = $state<PluginSyncPayload | null>(null);

    function openSync() {
        syncView = true;
        syncMessage = "";
        syncError = "";
        pullSummary = null;
        pullPayload = null;
    }
    function closeSync() {
        syncView = false;
        pullSummary = null;
        pullPayload = null;
    }

    // Reselecting the "Plugins" tab (or navigating to it) bumps `navSignal` in
    // AppSettings. Without a remount, re-assigning the already-active tab is a
    // no-op, so a plugin's settings form / the sync sub-view would stay open.
    // Snap back to the manager list whenever the signal changes. This reads ONLY
    // `navSignal`; its writes (settingsForPluginId, syncView, pull*) don't feed
    // back into navSignal, so it cannot self-retrigger. On the initial mount the
    // list is already showing, so the reset is a harmless no-op.
    $effect(() => {
        void navSignal;
        closeSettingsForm();
        closeSync();
    });

    async function doPush() {
        syncBusy = true;
        syncError = "";
        syncMessage = "";
        const res = await pushPluginSync();
        syncBusy = false;
        if (res.ok)
            syncMessage = t("pluginsSettings.pushedYourPluginSetToYour");
        else syncError = res.error ?? t("pluginsSettings.pushFailed");
    }

    async function doPullPreview() {
        syncBusy = true;
        syncError = "";
        syncMessage = "";
        pullSummary = null;
        pullPayload = null;
        const res = await getPullSummary();
        syncBusy = false;
        if (res.ok && res.summary && res.payload) {
            pullSummary = res.summary;
            pullPayload = res.payload;
        } else {
            syncError = res.error ?? t("pluginsSettings.pullFailed");
        }
    }

    async function doApplyPull() {
        if (!pullPayload) return;
        syncBusy = true;
        try {
            const { failed } = await applyPull(pullPayload);
            pullSummary = null;
            pullPayload = null;
            syncMessage = t("pluginsSettings.appliedTheSyncedPluginSet");
            if (failed.length)
                syncError = t("pluginsSettings.couldNotInstall", {
                    join: failed.map((f) => `${f.id} (${f.error})`).join(", "),
                });
        } finally {
            syncBusy = false;
        }
    }

    // Global auto-update toggle
    async function toggleAutoUpdate(next: boolean) {
        setGlobalAutoUpdate(next);
    }

    // Per-plugin override select value: "default" | "on" | "off"
    function overrideValue(id: string): "default" | "on" | "off" {
        const v = pluginPrefs.perPlugin[id];
        return v === undefined ? "default" : v ? "on" : "off";
    }
    function setOverride(id: string, val: string) {
        setPluginAutoUpdate(id, val === "default" ? undefined : val === "on");
    }

    // Update a single repo plugin now
    let updateBusy = $state<Record<string, boolean>>({});
    let updateError = $state<Record<string, string>>({});
    async function doUpdate(id: string) {
        updateBusy[id] = true;
        delete updateError[id];
        const res = await updateRepoPlugin(id);
        if (!res.ok)
            updateError[id] = res.error ?? t("pluginsSettings.updateFailed");
        refreshUpdates();
        updateBusy[id] = false;
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

    // Remove is irreversible, so the trash button only arms an inline
    // Cancel/Remove step (audit UX-10); the second click uninstalls.
    let removePending = $state<string | null>(null);
    let removeError = $state<Record<string, string>>({});
    async function remove(id: string) {
        removePending = null;
        busy[id] = true;
        delete removeError[id];
        try {
            await uninstallRepoPlugin(id);
        } catch (err) {
            removeError[id] =
                err instanceof Error && err.message
                    ? t("pluginsSettings.couldnTRemovePlugin", {
                          message: err.message,
                      })
                    : t("pluginsSettings.couldnTRemovePlugin2");
        } finally {
            busy[id] = false;
        }
    }

    // Repos add
    let repoInput = $state("");
    let repoError = $state("");

    function submitAddRepo() {
        const res = canAddRepo(
            pluginRepos.refs,
            repoInput,
            import.meta.env.DEV,
        );
        if (!res.ok) {
            repoError = res.reason ?? t("pluginsSettings.cannotAddThisRepo");
            return;
        }
        addRepo(res.normalized!);
        repoError = "";
        repoInput = "";
        void loadRepo(res.normalized!).then(refreshUpdates);
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
                    error: t("pluginsSettings.noIndexJson", {
                        status: res.status,
                    }),
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
        (async () => {
            await Promise.all(
                mergeRepoList(pluginRepos.refs).map((r) => loadRepo(r.ref)),
            );
            refreshUpdates();
        })();
    });

    /** `owner/repo` for the installed row; the raw ref if it doesn't parse. */
    function repoLabel(ref: string): string {
        try {
            const r = normalizeRepoRef(ref);
            return `${r.owner}/${r.repo}`;
        } catch {
            return ref;
        }
    }

    function refreshUpdates() {
        const latestByRepo: Record<string, Record<string, string>> = {};
        for (const [ref, state] of Object.entries(browse)) {
            const key = repoKey(ref);
            if (!latestByRepo[key]) latestByRepo[key] = {};
            for (const entry of state.entries) {
                latestByRepo[key][entry.id] = entry.version;
            }
        }
        void applyUpdateCheck(latestByRepo);
    }

    // Install a repo plugin
    let installError = $state("");

    async function install(ref: string, entry: PluginIndexEntry) {
        installError = "";
        const res = await installRepoPlugin(ref, entry);
        if (!res.ok) {
            installError = res.error ?? t("pluginsSettings.installFailed");
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
{:else if syncView}
    <div class="space-y-4">
        <button
            type="button"
            onclick={closeSync}
            class="text-sm text-discord-textMuted hover:text-discord-textPrimary"
        >
            {t("pluginsSettings.back")}
        </button>
        <p class="text-xs text-discord-textMuted">
            {t("pluginsSettings.syncYourEnabledPluginsSettingsTo")}
        </p>
        <div class="flex gap-2">
            <button
                type="button"
                onclick={doPush}
                disabled={syncBusy}
                class="flex-1 px-3 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
            >
                {t("pluginsSettings.pushToAccount")}
            </button>
            <button
                type="button"
                onclick={doPullPreview}
                disabled={syncBusy}
                class="flex-1 px-3 py-2 rounded text-sm font-semibold bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
            >
                {t("pluginsSettings.pullFromAccount")}
            </button>
        </div>
        {#if syncMessage}
            <p class="text-sm text-discord-textSecondary">{syncMessage}</p>
        {/if}
        {#if syncError}
            <p class="text-sm text-discord-danger">{syncError}</p>
        {/if}
        {#if pullSummary}
            <div
                class="p-3 rounded bg-discord-backgroundTertiary space-y-2 text-sm"
            >
                <p class="font-semibold text-discord-textPrimary">
                    {t("pluginsSettings.thisPullWill")}
                </p>
                {#if pullSummary.reposToAdd.length}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.addRepos", {
                            join: pullSummary.reposToAdd.join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.toInstall.length}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.installFromRepos", {
                            join: pullSummary.toInstall
                                .map((p) => `${p.id} (${p.repoRef})`)
                                .join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.toEnable.length}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.enable", {
                            join: pullSummary.toEnable.join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.toDisable.length}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.disable", {
                            join: pullSummary.toDisable.join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.settingsChanges.length}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.updateSettingsFor", {
                            join: pullSummary.settingsChanges.join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.autoUpdateChange !== null}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.setAutoUpdate", {
                            value: pullSummary.autoUpdateChange ? "on" : "off",
                        })}
                    </p>
                {/if}
                {#if pullSummary.autoUpdateOverrides.length}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.setPerPluginAutoUpdate", {
                            join: pullSummary.autoUpdateOverrides
                                .map((o) => `${o.id}=${o.value ? "on" : "off"}`)
                                .join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.notInstalledHere.length}
                    <p class="text-discord-textMuted text-xs">
                        {t("pluginsSettings.notInstalledOnThisDeviceInstall", {
                            join: pullSummary.notInstalledHere
                                .map((n) => n.id)
                                .join(", "),
                        })}
                    </p>
                {/if}
                {#if pullSummary.reposToAdd.length === 0 && pullSummary.toInstall.length === 0 && pullSummary.toEnable.length === 0 && pullSummary.toDisable.length === 0 && pullSummary.settingsChanges.length === 0 && pullSummary.autoUpdateChange === null && pullSummary.autoUpdateOverrides.length === 0}
                    <p class="text-discord-textSecondary">
                        {t("pluginsSettings.nothingToChangeAlreadyInSync")}
                    </p>
                {/if}
                <div class="flex gap-2 pt-1">
                    <button
                        type="button"
                        onclick={doApplyPull}
                        disabled={syncBusy}
                        class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
                    >
                        {t("pluginsSettings.apply")}
                    </button>
                    <button
                        type="button"
                        onclick={() => {
                            pullSummary = null;
                            pullPayload = null;
                        }}
                        class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors"
                    >
                        {t("common.cancel")}
                    </button>
                </div>
            </div>
        {/if}
    </div>
{:else}
    <div class="space-y-6">
        <!-- Installed -->
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                {t("pluginsSettings.installed")}
            </p>
            {#if installedList.length === 0}
                <p class="text-sm text-discord-textMuted text-center py-8">
                    {t("pluginsSettings.noPluginsInstalled")}
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
                                    {#if p.source === "repo" && p.repoRef}
                                        · {repoLabel(
                                            p.repoRef,
                                        )}{#if p.sha}@{p.sha.slice(0, 7)}{/if}
                                    {/if}
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
                                {#if pluginUpdates.available[p.id] || pluginNeedsUpdate[p.id]}
                                    <div class="flex items-center gap-2 mt-1">
                                        {#if pluginNeedsUpdate[p.id]}
                                            <span
                                                class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-discord-danger/20 text-discord-danger"
                                            >
                                                {t(
                                                    "pluginsSettings.needsUpdate",
                                                )}
                                            </span>
                                        {:else if pluginUpdates.available[p.id]}
                                            <span
                                                class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-discord-accent/20 text-discord-accent"
                                            >
                                                {t(
                                                    "pluginsSettings.updateToV",
                                                    {
                                                        value: pluginUpdates
                                                            .available[p.id],
                                                    },
                                                )}
                                            </span>
                                        {/if}
                                        <button
                                            type="button"
                                            onclick={() => doUpdate(p.id)}
                                            disabled={updateBusy[p.id]}
                                            class="text-xs text-discord-accent hover:underline disabled:opacity-50"
                                        >
                                            {updateBusy[p.id]
                                                ? t("pluginsSettings.updating")
                                                : t("pluginsSettings.update")}
                                        </button>
                                    </div>
                                {/if}
                                {#if updateError[p.id]}
                                    <p
                                        class="text-xs text-discord-danger mt-1"
                                        role="alert"
                                    >
                                        {updateError[p.id]}
                                    </p>
                                {/if}
                                {#if removeError[p.id]}
                                    <p
                                        class="text-xs text-discord-danger mt-1"
                                        role="alert"
                                    >
                                        {removeError[p.id]}
                                    </p>
                                {/if}
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                {#if hasSettings}
                                    <button
                                        type="button"
                                        onclick={() =>
                                            (settingsForPluginId = p.id)}
                                        title={t(
                                            "pluginsSettings.pluginSettings",
                                        )}
                                        class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                                    >
                                        <Settings size={16} />
                                    </button>
                                {/if}
                                <ToggleSwitch
                                    checked={p.enabled}
                                    onChange={(next) => toggle(p.id, next)}
                                    label={t("pluginsSettings.enable2", {
                                        name: p.name,
                                    })}
                                    title={busy[p.id]
                                        ? t("pluginsSettings.working")
                                        : undefined}
                                />
                                {#if p.source === "repo"}
                                    <select
                                        value={overrideValue(p.id)}
                                        onchange={(e) =>
                                            setOverride(
                                                p.id,
                                                e.currentTarget.value,
                                            )}
                                        title={t(
                                            "pluginsSettings.autoUpdateThisPlugin",
                                        )}
                                        class="text-xs rounded bg-discord-backgroundSecondary text-discord-textMuted border border-discord-divider px-1 py-0.5"
                                    >
                                        <option value="default"
                                            >{t(
                                                "pluginsSettings.autoDefault",
                                            )}</option
                                        >
                                        <option value="on"
                                            >{t(
                                                "pluginsSettings.autoOn",
                                            )}</option
                                        >
                                        <option value="off"
                                            >{t(
                                                "pluginsSettings.autoOff",
                                            )}</option
                                        >
                                    </select>
                                    {#if removePending === p.id}
                                        <button
                                            type="button"
                                            onclick={() =>
                                                (removePending = null)}
                                            class="px-2 py-1 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                                        >
                                            {t("common.cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            onclick={() => remove(p.id)}
                                            aria-label={t(
                                                "pluginsSettings.confirmRemove",
                                                { name: p.name },
                                            )}
                                            class="px-2 py-1 rounded text-xs text-white bg-discord-danger hover:bg-discord-dangerHover transition-colors"
                                        >
                                            {t("common.remove")}
                                        </button>
                                    {:else}
                                        <button
                                            type="button"
                                            onclick={() =>
                                                (removePending = p.id)}
                                            disabled={busy[p.id]}
                                            title={t(
                                                "pluginsSettings.removePlugin",
                                            )}
                                            aria-label={t(
                                                "pluginsSettings.remove",
                                                { name: p.name },
                                            )}
                                            class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    {/if}
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
                {t("pluginsSettings.browse")}
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
                                {t("pluginsSettings.loading")}
                            </p>
                        {:else if browse[repo.ref]?.error}
                            <p class="text-xs text-discord-textMuted">
                                {browse[repo.ref].error}
                            </p>
                        {:else if !browse[repo.ref]?.entries.length}
                            <p class="text-xs text-discord-textMuted">
                                {t("pluginsSettings.noPluginsInThisRepoYet")}
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
                                                >{t(
                                                    "pluginsSettings.installed",
                                                )}</span
                                            >
                                        {:else}
                                            <button
                                                type="button"
                                                onclick={() =>
                                                    install(repo.ref, entry)}
                                                class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
                                                >{t(
                                                    "pluginsSettings.install",
                                                )}</button
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
                {t("pluginsSettings.repos")}
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
                                    {t("pluginsSettings.official")}
                                </p>
                            {/if}
                        </div>
                        {#if !repo.official}
                            <button
                                type="button"
                                onclick={() => removeRepo(repo.ref)}
                                title={t("pluginsSettings.removeRepo")}
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
                    {t("pluginsSettings.addARepo")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("pluginsSettings.thirdPartyReposRunFullTrust")}
                </p>
                <div class="flex gap-2">
                    <input
                        type="text"
                        bind:value={repoInput}
                        placeholder={t("pluginsSettings.ownerRepoOrGithubUrl")}
                        class="flex-1 px-2.5 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary border border-discord-divider focus:border-discord-accent outline-none"
                        onkeydown={(e) => {
                            if (e.key === "Enter") submitAddRepo();
                        }}
                    />
                    <button
                        type="button"
                        onclick={submitAddRepo}
                        class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
                        >{t("pluginsSettings.addRepo")}</button
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
                {t("common.actions")}
            </p>
            <div class="space-y-3">
                <button
                    type="button"
                    onclick={openSync}
                    class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-discord-backgroundTertiary text-sm font-semibold text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                >
                    <RefreshCw size={16} />
                    {t("pluginsSettings.syncPlugins")}
                </button>

                <button
                    type="button"
                    onclick={disableAll}
                    class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-discord-backgroundTertiary text-sm font-semibold text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                >
                    <Power size={16} />
                    {t("pluginsSettings.disableAllPlugins")}
                </button>

                <div
                    class="flex items-center gap-3 py-2 border-t border-discord-divider pt-3"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {t("pluginsSettings.autoUpdatePlugins")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t(
                                "pluginsSettings.automaticallyPullNewerVersionsOfRepo",
                            )}
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={pluginPrefs.autoUpdate}
                        onChange={(next) => toggleAutoUpdate(next)}
                        label={t("pluginsSettings.autoUpdatePlugins")}
                    />
                </div>
            </div>
        </section>
    </div>
{/if}
