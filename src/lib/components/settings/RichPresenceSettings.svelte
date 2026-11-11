<script lang="ts">
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import {
        setRichPresenceArrpc,
        setRichPresenceAutoRestartDiscord,
        setRichPresenceEnabled,
        setRichPresenceFakeDiscord,
        setRichPresenceMedia,
        setRichPresenceScan,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import {
        addCustomGame,
        disableSteam,
        enableSteam,
        forgetApp,
        listRunningPrograms,
        refreshRichPresenceStatus,
        removeCustomGame,
        richPresenceAvailable,
        richPresenceState,
        setAppAllowed,
        syncRichPresence,
        type SteamDebugOutcome,
    } from "$lib/stores/richPresence.svelte";

    // Desktop only: apps on this computer report what they are doing and it is
    // published to the profile (MSC4544). Off until switched on here, and each
    // app is allowed until switched off.

    const apps = $derived(
        Object.entries(richPresenceState.apps).sort(
            (a, b) => b[1].lastSeen - a[1].lastSeen,
        ),
    );
    const status = $derived(richPresenceState.status);
    const desktop = richPresenceAvailable();
    // Off the desktop app only plugins publish, so only they are listed.
    const hasPlugins = $derived(apps.some(([, a]) => a.source === "plugin"));

    function onToggleShare(next: boolean): void {
        setRichPresenceEnabled(next);
        void syncRichPresence();
    }

    function onToggleScan(next: boolean): void {
        setRichPresenceScan(next);
        void syncRichPresence();
    }

    function onToggleMedia(next: boolean): void {
        setRichPresenceMedia(next);
        void syncRichPresence();
    }

    function onToggleArrpc(next: boolean): void {
        setRichPresenceArrpc(next);
        void syncRichPresence();
    }

    function onToggleAutoRestart(next: boolean): void {
        setRichPresenceAutoRestartDiscord(next);
        void syncRichPresence();
    }

    function onToggleFake(next: boolean): void {
        setRichPresenceFakeDiscord(next);
        void syncRichPresence();
    }

    // Steam: the debug flag is written first (Windows asks for permission), so
    // the source only turns on once that worked. Turning it off always tries to
    // remove the flag; the outcome is shown rather than swallowed.
    let steamBusy = $state(false);
    let steamEnableError = $state<string | null>(null);
    let steamDisable = $state<SteamDebugOutcome | null>(null);
    let confirmingSteamRestart = $state(false);
    let steamRestarting = $state(false);
    let steamRestartError = $state<string | null>(null);
    let steamPoll: ReturnType<typeof setInterval> | null = null;

    const steamVisible = $derived(
        status?.steam?.supported !== false ||
            status?.steam?.needsPermission === true,
    );
    // The flag is still set after a failed removal, per the last status read.
    const steamFlagLeft = $derived(
        !settingsState.richPresenceSteam &&
            steamDisable !== null &&
            !steamDisable.ok &&
            status?.steam?.enabled !== false,
    );

    function stopSteamPoll(): void {
        if (steamPoll) clearInterval(steamPoll);
        steamPoll = null;
    }

    $effect(() => stopSteamPoll);

    /** After a restart Steam's port takes a moment: look every 2s, for 30s. */
    function pollSteamPort(): void {
        stopSteamPoll();
        let tries = 0;
        steamPoll = setInterval(async () => {
            tries++;
            await refreshRichPresenceStatus();
            if (richPresenceState.status?.steam?.portOpen || tries >= 15)
                stopSteamPoll();
        }, 2000);
    }

    async function onToggleSteam(next: boolean): Promise<void> {
        if (steamBusy) return;
        steamEnableError = null;
        steamDisable = null;
        steamBusy = true;
        if (next) {
            const res = await enableSteam();
            if (!res.ok)
                steamEnableError = res.cancelled
                    ? t("richPresence.steamUacCancelled")
                    : t("richPresence.steamEnableFailed", {
                          error: res.error ?? "",
                      });
        } else {
            stopSteamPoll();
            steamDisable = await disableSteam();
        }
        steamBusy = false;
    }

    async function restartSteam(): Promise<void> {
        confirmingSteamRestart = false;
        steamRestarting = true;
        steamRestartError = null;
        try {
            const res = await window.desktop?.richPresence?.restartSteam();
            if (res && !res.ok) steamRestartError = res.error ?? "";
        } catch (e) {
            steamRestartError = String((e as Error)?.message ?? e);
        }
        await refreshRichPresenceStatus();
        steamRestarting = false;
        if (steamRestartError === null) pollSteamPort();
    }

    // Discord holds the first slot when it started before Zam.
    const discordFirst = $derived(
        settingsState.richPresenceEnabled &&
            settingsState.richPresenceArrpc &&
            status?.arrpc.running === true &&
            (status.arrpc.slot ?? 0) > 0,
    );
    let confirmingRestart = $state(false);
    let restarting = $state(false);
    let restartError = $state<string | null>(null);

    async function restartDiscord(): Promise<void> {
        confirmingRestart = false;
        restarting = true;
        restartError = null;
        try {
            const res = await window.desktop?.richPresence?.restartDiscord();
            if (res && !res.ok) restartError = res.error ?? "";
        } catch (e) {
            restartError = String((e as Error)?.message ?? e);
        }
        await syncRichPresence();
        restarting = false;
    }

    // Added games: pick a running program, name it, and it is a game.
    let picking = $state(false);
    let programs = $state<{ path: string; name: string }[]>([]);
    let loadingPrograms = $state(false);
    let query = $state("");
    let chosen = $state<{ path: string; name: string } | null>(null);
    let gameName = $state("");

    const shownPrograms = $derived.by(() => {
        const q = query.trim().toLowerCase();
        return programs
            .filter(
                (p) =>
                    !q ||
                    p.name.toLowerCase().includes(q) ||
                    p.path.toLowerCase().includes(q),
            )
            .slice(0, 100);
    });

    async function loadPrograms(): Promise<void> {
        loadingPrograms = true;
        programs = await listRunningPrograms();
        loadingPrograms = false;
    }

    function startPicking(): void {
        picking = true;
        chosen = null;
        query = "";
        void loadPrograms();
    }

    function choose(p: { path: string; name: string }): void {
        chosen = p;
        gameName = p.name;
    }

    function confirmAdd(): void {
        if (!chosen || !gameName.trim()) return;
        addCustomGame(gameName, chosen.path);
        picking = false;
        chosen = null;
    }

    const lastPlayed = (ts: number): string => {
        if (!ts) return t("richPresence.neverPlayed");
        const days = Math.round((ts - Date.now()) / 86_400_000);
        const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
        let when: string;
        if (Math.abs(days) >= 30)
            when = rtf.format(Math.round(days / 30), "month");
        else if (Math.abs(days) >= 1) when = rtf.format(days, "day");
        else
            when = rtf.format(
                Math.round((ts - Date.now()) / 3_600_000),
                "hour",
            );
        return t("richPresence.lastPlayed", { when });
    };
</script>

{#if desktop || hasPlugins}
    <section data-setting-anchor="cust-rich-presence">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("richPresence.heading")}
        </p>
        {#if !desktop && richPresenceState.error}
            <p class="text-xs text-discord-danger mb-2">
                {t("richPresence.publishFailed")}
                {richPresenceState.error}
            </p>
        {/if}
        {#if desktop}
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        {t("richPresence.share")}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.shareHint")}
                    </p>
                    {#if settingsState.richPresenceEnabled && status?.msc4544.listening}
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.listening", {
                                port: String(status.msc4544.port),
                            })}
                        </p>
                    {/if}
                    {#if settingsState.richPresenceEnabled && status?.msc4544.socket}
                        <p class="text-xs text-discord-textMuted break-all">
                            {t("richPresence.socket", {
                                path: status.msc4544.socket,
                            })}
                        </p>
                    {/if}
                    {#if settingsState.richPresenceEnabled && status?.msc4544.error}
                        <p class="text-xs text-discord-danger">
                            {t("richPresence.listenFailed", {
                                error: status.msc4544.error,
                            })}
                        </p>
                    {/if}
                    {#if richPresenceState.error}
                        <p class="text-xs text-discord-danger">
                            {t("richPresence.publishFailed")}
                            {richPresenceState.error}
                        </p>
                    {/if}
                </div>
                <ToggleSwitch
                    checked={settingsState.richPresenceEnabled}
                    onChange={onToggleShare}
                    label={t("richPresence.share")}
                />
            </div>
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        {t("richPresence.arrpc")}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.arrpcHint")}
                    </p>
                    {#if !settingsState.richPresenceEnabled}
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.arrpcNeedsShare")}
                        </p>
                    {/if}
                    {#if discordFirst}
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.discordFirst")}
                        </p>
                        {#if status?.arrpc.canRestartDiscord}
                            <button
                                type="button"
                                class="mt-1 rounded bg-discord-backgroundSecondary px-2 py-1 text-xs text-discord-textPrimary hover:bg-discord-backgroundSecondaryAlt disabled:opacity-50"
                                disabled={restarting}
                                onclick={() => (confirmingRestart = true)}
                            >
                                {t("richPresence.restartDiscord")}
                            </button>
                        {:else if status?.arrpc.needsPermission}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.hostNeedsPermission")}
                            </p>
                            <code
                                class="mt-1 block select-all break-all rounded bg-discord-backgroundTertiary p-2 text-xs text-discord-textPrimary"
                            >
                                {t("richPresence.scanGrantCommand")}
                            </code>
                        {/if}
                    {/if}
                    {#if restartError !== null}
                        <p class="text-xs text-discord-danger">
                            {t("richPresence.restartDiscordFailed", {
                                error: restartError,
                            })}
                        </p>
                    {/if}
                    {#if settingsState.richPresenceEnabled && settingsState.richPresenceArrpc && status?.arrpc.error}
                        <p class="text-xs text-discord-danger">
                            {t("richPresence.arrpcFailed", {
                                error: status.arrpc.error,
                            })}
                        </p>
                    {/if}
                </div>
                <ToggleSwitch
                    checked={settingsState.richPresenceArrpc}
                    onChange={onToggleArrpc}
                    label={t("richPresence.arrpc")}
                />
            </div>

            {#if settingsState.richPresenceEnabled && settingsState.richPresenceArrpc && status?.arrpc.canRestartDiscord}
                <div
                    class="flex items-center gap-3 py-2 ps-4 border-b border-discord-divider"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {t("richPresence.autoRestart")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.autoRestartHint")}
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={settingsState.richPresenceAutoRestartDiscord}
                        onChange={onToggleAutoRestart}
                        label={t("richPresence.autoRestart")}
                    />
                </div>
            {/if}

            {#if settingsState.richPresenceEnabled && settingsState.richPresenceArrpc && status?.fake?.supported}
                <div
                    class="flex items-center gap-3 py-2 ps-4 border-b border-discord-divider"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {t("richPresence.fake")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.fakeHint")}
                        </p>
                        {#if status.fake.needsPermission}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.hostNeedsPermission")}
                            </p>
                            <code
                                class="mt-1 block select-all break-all rounded bg-discord-backgroundTertiary p-2 text-xs text-discord-textPrimary"
                            >
                                {t("richPresence.scanGrantCommand")}
                            </code>
                        {/if}
                        {#if settingsState.richPresenceFakeDiscord && status.fake.error}
                            <p class="text-xs text-discord-danger">
                                {t("richPresence.fakeFailed", {
                                    error: status.fake.error,
                                })}
                            </p>
                        {/if}
                    </div>
                    <ToggleSwitch
                        checked={settingsState.richPresenceFakeDiscord}
                        onChange={onToggleFake}
                        label={t("richPresence.fake")}
                    />
                </div>
            {/if}

            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        {t("richPresence.scan")}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.scanHint")}
                    </p>
                    {#if settingsState.richPresenceEnabled && settingsState.richPresenceScan && status?.scan.needsPermission}
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.scanNeedsPermission")}
                        </p>
                        <code
                            class="mt-1 block select-all break-all rounded bg-discord-backgroundTertiary p-2 text-xs text-discord-textPrimary"
                        >
                            {t("richPresence.scanGrantCommand")}
                        </code>
                    {:else if !settingsState.richPresenceEnabled}
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.arrpcNeedsShare")}
                        </p>
                    {/if}
                    {#if settingsState.richPresenceEnabled && settingsState.richPresenceScan && status?.scan.error}
                        <p class="text-xs text-discord-danger">
                            {t("richPresence.scanFailed", {
                                error: status.scan.error,
                            })}
                        </p>
                    {/if}
                    {#if settingsState.richPresenceEnabled && (settingsState.richPresenceScan || settingsState.richPresenceArrpc) && status?.games}
                        {#if status.games.downloading}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.gameListDownloading")}
                            </p>
                        {:else if status.games.updated !== null}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.gameList", {
                                    count: String(status.games.count),
                                    when: new Date(
                                        status.games.updated,
                                    ).toLocaleDateString(),
                                })}
                            </p>
                        {/if}
                        {#if status.games.error}
                            <p class="text-xs text-discord-danger">
                                {t("richPresence.gameListFailed", {
                                    error: status.games.error,
                                })}
                            </p>
                        {/if}
                    {/if}
                </div>
                <ToggleSwitch
                    checked={settingsState.richPresenceScan}
                    onChange={onToggleScan}
                    label={t("richPresence.scan")}
                />
            </div>

            {#if steamVisible}
                <div
                    class="flex items-center gap-3 py-2 border-b border-discord-divider {steamBusy
                        ? 'opacity-50 pointer-events-none'
                        : ''}"
                    aria-busy={steamBusy}
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {t("richPresence.steam")}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.steamHint")}
                        </p>
                        {#if !settingsState.richPresenceEnabled}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.arrpcNeedsShare")}
                            </p>
                        {/if}
                        {#if status?.steam?.needsPermission}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.hostNeedsPermission")}
                            </p>
                            <code
                                class="mt-1 block select-all break-all rounded bg-discord-backgroundTertiary p-2 text-xs text-discord-textPrimary"
                            >
                                {t("richPresence.scanGrantCommand")}
                            </code>
                        {/if}
                        {#if steamEnableError !== null}
                            <p class="text-xs text-discord-danger">
                                {steamEnableError}
                            </p>
                        {/if}
                        {#if steamFlagLeft && steamDisable}
                            <p class="text-xs text-discord-danger">
                                {steamDisable.cancelled
                                    ? t("richPresence.steamUacCancelled")
                                    : t("richPresence.steamDisableFailed", {
                                          error: steamDisable.error ?? "",
                                      })}
                            </p>
                        {/if}
                        {#if settingsState.richPresenceEnabled && settingsState.richPresenceSteam && status?.steam?.error}
                            <p class="text-xs text-discord-danger">
                                {t("richPresence.steamFailed", {
                                    error: status.steam.error,
                                })}
                            </p>
                        {/if}
                        {#if settingsState.richPresenceEnabled && settingsState.richPresenceSteam && status?.steam?.connected}
                            <p class="text-xs text-discord-textMuted">
                                {t("richPresence.steamConnected")}
                            </p>
                        {/if}
                        {#if settingsState.richPresenceSteam && status?.steam && !status.steam.portOpen}
                            {#if status.steam.steamRunning}
                                <p class="text-xs text-discord-textMuted">
                                    {t("richPresence.steamNeedsRestart")}
                                </p>
                                <button
                                    type="button"
                                    class="mt-1 rounded bg-discord-backgroundSecondary px-2 py-1 text-xs text-discord-textPrimary hover:bg-discord-backgroundSecondaryAlt disabled:opacity-50"
                                    disabled={steamRestarting}
                                    onclick={() =>
                                        (confirmingSteamRestart = true)}
                                >
                                    {t("richPresence.restartSteam")}
                                </button>
                            {:else}
                                <p class="text-xs text-discord-textMuted">
                                    {t("richPresence.steamNotRunning")}
                                </p>
                            {/if}
                        {/if}
                        {#if steamRestartError !== null}
                            <p class="text-xs text-discord-danger">
                                {t("richPresence.restartSteamFailed", {
                                    error: steamRestartError,
                                })}
                            </p>
                        {/if}
                    </div>
                    <ToggleSwitch
                        checked={settingsState.richPresenceSteam}
                        onChange={onToggleSteam}
                        label={t("richPresence.steam")}
                    />
                </div>
            {/if}

            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        {t("richPresence.media")}
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {t("richPresence.mediaHint")}
                    </p>
                    {#if !settingsState.richPresenceEnabled}
                        <p class="text-xs text-discord-textMuted">
                            {t("richPresence.arrpcNeedsShare")}
                        </p>
                    {/if}
                    {#if settingsState.richPresenceEnabled && settingsState.richPresenceMedia && status?.media?.error}
                        <p class="text-xs text-discord-danger">
                            {t("richPresence.mediaFailed", {
                                error: status.media.error,
                            })}
                        </p>
                    {/if}
                </div>
                <ToggleSwitch
                    checked={settingsState.richPresenceMedia}
                    onChange={onToggleMedia}
                    label={t("richPresence.media")}
                />
            </div>
        {/if}
        {#if desktop}
            <p class="text-sm text-discord-textPrimary mt-4 mb-1">
                {t("richPresence.addedGames")}
            </p>
            <p class="text-xs text-discord-textMuted mb-2">
                {t("richPresence.addedGamesHint")}
            </p>
        {/if}
        {#if apps.length === 0}
            <p class="text-xs text-discord-textMuted">
                {t("richPresence.noApps")}
            </p>
        {:else}
            <ul>
                {#each apps as [key, app] (key)}
                    {@const added = richPresenceState.games.find(
                        (g) => `arrpc:${g.id}` === key,
                    )}
                    <li
                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                    >
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-sm text-discord-textPrimary truncate"
                            >
                                {app.name}
                            </p>
                            {#if added}
                                <p
                                    class="text-xs text-discord-textMuted truncate"
                                    title={added.exe}
                                >
                                    {added.exe}
                                </p>
                            {:else}
                                <p class="text-xs text-discord-textMuted">
                                    {app.source === "plugin"
                                        ? t("richPresence.viaPlugin")
                                        : app.source !== "arrpc"
                                          ? t("richPresence.viaMatrix")
                                          : app.viaMedia
                                            ? t("richPresence.viaMedia")
                                            : app.viaScan ||
                                                app.viaRpc ||
                                                app.viaSteam
                                              ? [
                                                    app.viaRpc &&
                                                        t(
                                                            "richPresence.viaRpc",
                                                        ),
                                                    app.viaScan &&
                                                        t(
                                                            "richPresence.viaScan",
                                                        ),
                                                    app.viaSteam &&
                                                        t(
                                                            "richPresence.viaSteam",
                                                        ),
                                                ]
                                                    .filter(Boolean)
                                                    .join(" + ")
                                              : t("richPresence.viaDiscord")}
                                    · {lastPlayed(app.lastSeen)}
                                </p>
                            {/if}
                        </div>
                        <button
                            type="button"
                            class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                            aria-label={t("richPresence.forgetApp", {
                                name: app.name,
                            })}
                            onclick={() =>
                                added
                                    ? removeCustomGame(added.id)
                                    : forgetApp(key)}
                        >
                            {added
                                ? t("common.remove")
                                : t("richPresence.forget")}
                        </button>
                        <ToggleSwitch
                            checked={app.allowed}
                            onChange={(next) => setAppAllowed(key, next)}
                            label={t("richPresence.allowApp", {
                                name: app.name,
                            })}
                        />
                    </li>
                {/each}
            </ul>
        {/if}
        {#if picking}
            <div
                class="mt-2 rounded bg-discord-backgroundTertiary p-3 space-y-2"
            >
                {#if chosen}
                    <p class="text-xs text-discord-textMuted break-all">
                        {chosen.path}
                    </p>
                    <label class="block text-xs text-discord-textMuted">
                        {t("richPresence.gameName")}
                        <input
                            type="text"
                            maxlength="64"
                            bind:value={gameName}
                            class="mt-1 w-full rounded bg-discord-background px-2 py-1.5 text-sm text-discord-textPrimary"
                        />
                    </label>
                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold disabled:opacity-50"
                            disabled={!gameName.trim()}
                            onclick={confirmAdd}
                        >
                            {t("common.add")}
                        </button>
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded text-sm text-discord-textMuted hover:text-discord-textPrimary"
                            onclick={() => (chosen = null)}
                        >
                            {t("common.cancel")}
                        </button>
                    </div>
                {:else}
                    <div class="flex items-center gap-2">
                        <input
                            type="search"
                            bind:value={query}
                            placeholder={t("richPresence.searchPrograms")}
                            aria-label={t("richPresence.searchPrograms")}
                            class="flex-1 min-w-0 rounded bg-discord-background px-2 py-1.5 text-sm text-discord-textPrimary"
                        />
                        <button
                            type="button"
                            class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                            disabled={loadingPrograms}
                            onclick={loadPrograms}
                        >
                            {t("richPresence.refreshPrograms")}
                        </button>
                        <button
                            type="button"
                            class="text-xs text-discord-textMuted hover:text-discord-textPrimary"
                            onclick={() => (picking = false)}
                        >
                            {t("common.cancel")}
                        </button>
                    </div>
                    {#if shownPrograms.length === 0}
                        <p class="text-xs text-discord-textMuted">
                            {loadingPrograms
                                ? t("common.loading")
                                : t("richPresence.noPrograms")}
                        </p>
                    {:else}
                        <ul class="max-h-56 overflow-y-auto">
                            {#each shownPrograms as p (p.path)}
                                <li>
                                    <button
                                        type="button"
                                        class="w-full text-start rounded px-2 py-1 hover:bg-discord-messageHover"
                                        onclick={() => choose(p)}
                                    >
                                        <span
                                            class="block text-sm text-discord-textPrimary truncate"
                                            >{p.name}</span
                                        >
                                        <span
                                            class="block text-xs text-discord-textMuted truncate"
                                            >{p.path}</span
                                        >
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                {/if}
            </div>
        {:else if desktop}
            <button
                type="button"
                class="mt-2 px-3 py-1.5 rounded bg-discord-backgroundTertiary hover:bg-discord-messageHover text-sm font-semibold text-discord-textPrimary"
                onclick={startPicking}
            >
                {t("richPresence.addGame")}
            </button>
        {/if}
    </section>
{/if}

{#if confirmingRestart}
    <ModalDialog
        onClose={() => (confirmingRestart = false)}
        labelledBy="restart-discord-title"
        panelClass="relative w-full max-w-sm rounded-lg bg-discord-backgroundSecondary p-4 shadow-xl"
    >
        <h2
            id="restart-discord-title"
            class="mb-2 text-base font-semibold text-discord-textPrimary"
        >
            {t("richPresence.restartDiscordTitle")}
        </h2>
        <p class="mb-3 text-sm text-discord-textSecondary">
            {t("richPresence.restartDiscordBody")}
        </p>
        <div class="flex justify-end gap-2">
            <button
                type="button"
                class="px-3 py-1 text-sm text-discord-textMuted hover:text-discord-textPrimary"
                onclick={() => (confirmingRestart = false)}
            >
                {t("common.cancel")}
            </button>
            <button
                type="button"
                class="rounded bg-discord-accent px-3 py-1 text-sm text-white"
                onclick={restartDiscord}
            >
                {t("richPresence.restartDiscord")}
            </button>
        </div>
    </ModalDialog>
{/if}

{#if confirmingSteamRestart}
    <ModalDialog
        onClose={() => (confirmingSteamRestart = false)}
        labelledBy="restart-steam-title"
        panelClass="relative w-full max-w-sm rounded-lg bg-discord-backgroundSecondary p-4 shadow-xl"
    >
        <h2
            id="restart-steam-title"
            class="mb-2 text-base font-semibold text-discord-textPrimary"
        >
            {t("richPresence.restartSteamTitle")}
        </h2>
        <p class="mb-3 text-sm text-discord-textSecondary">
            {t("richPresence.restartSteamBody")}
        </p>
        <div class="flex justify-end gap-2">
            <button
                type="button"
                class="px-3 py-1 text-sm text-discord-textMuted hover:text-discord-textPrimary"
                onclick={() => (confirmingSteamRestart = false)}
            >
                {t("common.cancel")}
            </button>
            <button
                type="button"
                class="rounded bg-discord-accent px-3 py-1 text-sm text-white"
                onclick={restartSteam}
            >
                {t("richPresence.restartSteam")}
            </button>
        </div>
    </ModalDialog>
{/if}
