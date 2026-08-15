<script lang="ts">
    import { onMount } from "svelte";
    import {
        APP_VERSION,
        CAN_INSTALL_UPDATE,
        checkForUpdate,
        openReleasePage,
        reloadToLatest,
        type UpdateInfo,
    } from "$lib/update";
    import { clearCacheAndReload } from "$lib/matrix/client";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        updateStatusView,
        type UpdateStatusInput,
        type UpdateStatusView,
    } from "$lib/utils/updateStatus";
    import {
        isDesktopUpdater,
        desktopCheck,
        desktopDownload,
        desktopRestartToInstall,
        desktopSetAutoDownload,
        onDesktopUpdateStatus,
    } from "$lib/desktopUpdater";
    import {
        pickApkAsset,
        versionCodeFromSemver,
    } from "$lib/utils/androidUpdate";
    import {
        isAndroidUpdater,
        downloadApk,
        installApk,
        canInstall,
        openUnknownSourcesSettings,
    } from "$lib/androidUpdater";
    import {
        settingsState,
        setAutoUpdateEnabled,
    } from "$lib/stores/settings.svelte";

    let checking = $state(false);
    let info = $state<UpdateInfo | null>(null);
    let error = $state("");
    let reloading = $state(false);
    let clearingCache = $state(false);

    // Packaged-desktop auto-updater. The main process streams status objects
    // WITHOUT `autoEnabled`, so the view model merges the device toggle in on
    // every render below. On web/Android `isDesktopUpdater()` is false, the
    // onMount below never subscribes, and none of this renders.
    let desktopStatus = $state<UpdateStatusInput>({
        phase: "idle",
        autoEnabled: settingsState.autoUpdateEnabled,
    });
    const view = $derived(
        updateStatusView({
            ...desktopStatus,
            autoEnabled: settingsState.autoUpdateEnabled,
        }),
    );

    // Android updater: unlike desktop (pushed from the main process), the
    // renderer drives this state machine itself. `info` (shared with the web
    // path) holds the checked release incl. its downloadable `assets`.
    let androidStatus = $state<UpdateStatusInput>({
        phase: "idle",
        autoEnabled: settingsState.autoUpdateEnabled,
    });
    let androidApkPath = $state<string | null>(null);
    const androidView = $derived(
        updateStatusView({
            ...androidStatus,
            platform: "android",
            autoEnabled: settingsState.autoUpdateEnabled,
        }),
    );

    onMount(() => {
        if (isAndroidUpdater()) {
            // Refresh the passive About surface with real status on open,
            // mirroring the desktop branch; androidCheck auto-downloads when
            // the toggle is on. No subscription to tear down.
            void androidCheck();
            return;
        }
        if (!isDesktopUpdater()) return;
        // ONE-TIME wiring (not a reactive $effect): seed the main process with
        // the current toggle, kick a check so opening About refreshes the
        // passive surface to real status (it dropped the background launch
        // check's events while unsubscribed), then subscribe. The callback only
        // assigns `desktopStatus` (which this body never reads), so there is no
        // reactive loop; the returned unsub is the cleanup.
        desktopSetAutoDownload(settingsState.autoUpdateEnabled);
        desktopCheck();
        const unsub = onDesktopUpdateStatus((s) => (desktopStatus = s));
        return unsub;
    });

    function releaseUrl(): string {
        return info?.url ?? "https://github.com/az4521/Zam/releases/latest";
    }

    function runDesktopAction(): void {
        switch (view.action) {
            case "check":
                desktopCheck();
                break;
            case "download":
                desktopDownload();
                break;
            case "restart":
                desktopRestartToInstall();
                break;
            case "open-release":
                openReleasePage(releaseUrl());
                break;
        }
    }

    async function androidCheck(manual = false): Promise<void> {
        androidStatus = { ...androidStatus, phase: "checking" };
        try {
            const result = await checkForUpdate();
            info = result;
            if (!result.updateAvailable) {
                androidStatus = {
                    ...androidStatus,
                    phase: "up-to-date",
                    version: result.latest,
                };
                return;
            }
            androidStatus = {
                ...androidStatus,
                phase: "available",
                version: result.latest,
            };
            // Auto-download only on a background (app-open) check when the
            // toggle is on — a manual "Check for updates" tap stays confirm-
            // gated: it just shows the "Download" choice. (Android still ends in
            // a manual Install tap; it can't self-install a sideloaded APK.)
            if (!manual && settingsState.autoUpdateEnabled) {
                await androidDownload();
            }
        } catch (checkError) {
            androidStatus = {
                ...androidStatus,
                phase: "error",
                message:
                    (checkError as Error)?.message ?? "Update check failed",
            };
        }
    }

    async function androidDownload(): Promise<void> {
        const url = info ? pickApkAsset(info.assets ?? []) : null;
        if (!url) {
            // No .apk attached to the release → fall back to the release page.
            androidStatus = { ...androidStatus, phase: "unsupported" };
            return;
        }
        androidStatus = { ...androidStatus, phase: "downloading", percent: 0 };
        try {
            // Floor = the version the user was shown, so native also refuses a
            // rolled-back-but-still-signed archive.
            const minVersionCode = versionCodeFromSemver(info?.latest ?? "");
            const path = await downloadApk(url, minVersionCode, (percent) => {
                androidStatus = {
                    ...androidStatus,
                    phase: "downloading",
                    percent,
                };
            });
            androidApkPath = path;
            androidStatus = { ...androidStatus, phase: "downloaded" };
        } catch (downloadError) {
            androidStatus = {
                ...androidStatus,
                phase: "error",
                message: (downloadError as Error)?.message ?? "Download failed",
            };
        }
    }

    async function androidInstall(): Promise<void> {
        if (!androidApkPath) return;
        try {
            const granted = await canInstall();
            if (!granted) {
                // Route to the OS "install unknown apps" screen; the user
                // grants, returns, and taps Install again.
                await openUnknownSourcesSettings();
                return;
            }
            // No path argument: native installs its own private download, so a
            // compromised renderer cannot steer what gets installed.
            await installApk();
        } catch (installError) {
            androidStatus = {
                ...androidStatus,
                phase: "error",
                message: (installError as Error)?.message ?? "Install failed",
            };
        }
    }

    function runAndroidAction(): void {
        switch (androidView.action) {
            case "check":
                void androidCheck(true);
                break;
            case "download":
                void androidDownload();
                break;
            case "install":
                void androidInstall();
                break;
            case "open-release":
                openReleasePage(releaseUrl());
                break;
        }
    }

    function onToggleAuto(next: boolean): void {
        // The toggle governs only whether a BACKGROUND check auto-downloads;
        // it never kicks off a download for an already-found update. A pending
        // "available" keeps its explicit "Download & install" choice, so
        // flipping this setting never starts an unconfirmed download.
        setAutoUpdateEnabled(next);
        desktopSetAutoDownload(next);
    }

    function clearCache() {
        clearingCache = true;
        void clearCacheAndReload();
    }

    async function check() {
        checking = true;
        error = "";
        info = null;
        try {
            info = await checkForUpdate();
        } catch (checkError) {
            error =
                (checkError as Error)?.message ??
                "Failed to check for updates.";
        } finally {
            checking = false;
        }
    }

    async function apply(update: UpdateInfo) {
        if (CAN_INSTALL_UPDATE) {
            openReleasePage(update.url);
            return;
        }
        reloading = true;
        try {
            await reloadToLatest();
        } catch {
            reloading = false;
        }
    }
</script>

{#snippet actionButton(v: UpdateStatusView, run: () => void)}
    {#if v.action !== "none"}
        <button
            onclick={run}
            disabled={v.busy}
            class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
        >
            {v.actionLabel}
        </button>
    {/if}
{/snippet}

{#snippet updaterStatus(v: UpdateStatusView, autoDesc: string)}
    <div class="py-2 border-b border-discord-divider space-y-2">
        <p class="text-sm text-discord-textMuted">{v.label}</p>
        {#if v.percent !== null}
            <div
                class="h-1.5 w-full overflow-hidden rounded-full bg-discord-backgroundTertiary"
            >
                <div
                    class="h-full rounded-full bg-discord-accent transition-all"
                    style="width: {v.percent}%"
                ></div>
            </div>
        {/if}
    </div>
    <div class="flex items-center gap-3 py-2">
        <div class="flex-1 min-w-0">
            <p class="text-sm text-discord-textPrimary">Automatic updates</p>
            <p class="text-xs text-discord-textMuted">{autoDesc}</p>
        </div>
        <ToggleSwitch
            checked={settingsState.autoUpdateEnabled}
            onChange={onToggleAuto}
            label="Automatic updates"
        />
    </div>
{/snippet}

<div class="space-y-6">
    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Version
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Zam</p>
                <p class="text-xs text-discord-textMuted">
                    Current version v{APP_VERSION}
                </p>
            </div>
            {#if isDesktopUpdater()}
                {@render actionButton(view, runDesktopAction)}
            {:else if isAndroidUpdater()}
                {@render actionButton(androidView, runAndroidAction)}
            {:else}
                <button
                    onclick={check}
                    disabled={checking}
                    class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
                >
                    {checking ? "Checking…" : "Check for updates"}
                </button>
            {/if}
        </div>

        {#if isDesktopUpdater()}
            {@render updaterStatus(
                view,
                "Download and install updates automatically.",
            )}
        {:else if isAndroidUpdater()}
            {@render updaterStatus(
                androidView,
                "Download updates automatically. Installing still needs one tap.",
            )}
        {/if}
    </section>

    {#if !isDesktopUpdater() && !isAndroidUpdater()}
        {#if error}
            <p class="text-sm text-discord-textMuted">{error}</p>
        {:else if info?.updateAvailable}
            <div
                class="rounded-lg border border-discord-accent bg-discord-accent/10 p-4 flex items-center gap-4"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-discord-textPrimary">
                        Update available
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        v{info.current} → v{info.latest}
                    </p>
                </div>
                <button
                    onclick={() => apply(info!)}
                    disabled={reloading}
                    class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors flex-shrink-0 disabled:opacity-50"
                >
                    {reloading
                        ? "Reloading…"
                        : CAN_INSTALL_UPDATE
                          ? "Update"
                          : "Reload to update"}
                </button>
            </div>
        {:else if info}
            <p class="text-sm text-discord-textMuted">
                You’re on the latest version.
            </p>
        {/if}
    {/if}

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Troubleshooting
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Clear cache and resync
                </p>
                <p class="text-xs text-discord-textMuted">
                    Re-downloads your rooms from the server. Fixes rooms that
                    are missing or stuck. You stay signed in.
                </p>
            </div>
            <button
                onclick={clearCache}
                disabled={clearingCache}
                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50 flex-shrink-0"
            >
                {clearingCache ? "Resyncing…" : "Clear cache"}
            </button>
        </div>
    </section>
</div>
