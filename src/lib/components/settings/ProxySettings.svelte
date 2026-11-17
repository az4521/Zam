<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { proxyBridge } from "$lib/proxyBridge";

    // Zam's own proxy and how calls treat it: electron/proxy.cjs on desktop,
    // ZamProxy.java on Android (no PAC, no "proxy" call mode there). Applied
    // on Save, no restart needed.
    const bridge = proxyBridge();

    let info = $state<DesktopProxyInfo | null>(null);
    let draft = $state<DesktopProxyPrefs>({
        mode: "system",
        rules: "",
        bypass: "",
        pacUrl: "",
        calls: "default",
    });
    let saving = $state(false);
    let saved = $state(false);
    let loadError = $state("");

    function adopt(next: DesktopProxyInfo): void {
        info = next;
        draft = {
            mode: next.mode,
            rules: next.rules,
            bypass: next.bypass,
            pacUrl: next.pacUrl,
            calls: next.calls,
        };
    }

    onMount(() => {
        bridge
            ?.info()
            .then(adopt)
            .catch((e) => (loadError = String(e)));
    });

    const dirty = $derived(
        !!info &&
            (draft.mode !== info.mode ||
                draft.rules !== info.rules ||
                draft.bypass !== info.bypass ||
                draft.pacUrl !== info.pacUrl ||
                draft.calls !== info.calls),
    );

    async function save(): Promise<void> {
        if (!bridge) return;
        saving = true;
        saved = false;
        try {
            const next = await bridge.set($state.snapshot(draft));
            // Android keeps the old setting when the new one is rejected;
            // keep the draft so the typo can be fixed.
            if (next.error) info = next;
            else adopt(next);
            saved = !next.error;
        } catch (e) {
            loadError = String(e);
        } finally {
            saving = false;
        }
    }

    const selectClass =
        "w-full bg-zam-backgroundTertiary text-zam-textPrimary text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-zam-accent/50";
    const inputClass =
        "w-full px-3 py-2 rounded text-sm bg-zam-backgroundTertiary text-zam-textPrimary placeholder:text-zam-textMuted focus:outline-none focus:ring-1 focus:ring-zam-accent";
    const labelClass = "block text-sm text-zam-textPrimary mb-1";
    const hintClass = "text-xs text-zam-textMuted mt-1";

    // Calls can only bypass Zam's own proxy or the launch flags' (not the
    // OS settings), judged on the draft so the note shows before saving.
    const offers = (mode: DesktopProxyPrefs["mode"]) =>
        !info?.modes || info.modes.includes(mode);
    const offersCalls = (calls: DesktopProxyPrefs["calls"]) =>
        !info?.callModes || info.callModes.includes(calls);
    // Only Android limits modes, and only Android proxies native requests
    // from Java, which can't use every proxy scheme.
    const android = $derived(!!info?.modes);

    const bypassUnavailable = $derived(
        draft.calls === "direct" &&
            draft.mode === "system" &&
            (info?.launchFlags.length ?? 0) === 0,
    );
</script>

{#if bridge && info?.supported === false}
    <section data-setting-anchor="cust-network" class="space-y-2">
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
        >
            {t("proxySettings.network")}
        </p>
        <p class="text-sm text-zam-textMuted">
            {t("proxySettings.unsupported")}
        </p>
    </section>
{:else if bridge}
    <section data-setting-anchor="cust-network" class="space-y-4">
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
        >
            {t("proxySettings.network")}
        </p>

        <div>
            <label class={labelClass} for="proxy-mode"
                >{t("proxySettings.proxy")}</label
            >
            <select id="proxy-mode" class={selectClass} bind:value={draft.mode}>
                <option value="system">{t("proxySettings.modeSystem")}</option>
                <option value="direct">{t("proxySettings.modeDirect")}</option>
                <option value="manual">{t("proxySettings.modeManual")}</option>
                {#if offers("pac")}
                    <option value="pac">{t("proxySettings.modePac")}</option>
                {/if}
            </select>
            {#if draft.mode === "system" && info?.launchFlags.length}
                <p class={hintClass}>
                    {t("proxySettings.launchFlagsInUse")}
                    <code class="font-mono">{info.launchFlags.join(" ")}</code>
                </p>
            {/if}
        </div>

        {#if draft.mode === "manual"}
            <div>
                <label class={labelClass} for="proxy-rules"
                    >{t("proxySettings.server")}</label
                >
                <input
                    id="proxy-rules"
                    type="text"
                    class={inputClass}
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="socks5://127.0.0.1:9050"
                    bind:value={draft.rules}
                />
                <p class={hintClass}>{t("proxySettings.serverHint")}</p>
                {#if android}
                    <p class={hintClass}>
                        {t("proxySettings.androidBackgroundHint")}
                    </p>
                {/if}
            </div>
            <div>
                <label class={labelClass} for="proxy-bypass"
                    >{t("proxySettings.bypass")}</label
                >
                <input
                    id="proxy-bypass"
                    type="text"
                    class={inputClass}
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="example.org, 192.168.0.0/16"
                    bind:value={draft.bypass}
                />
            </div>
        {:else if draft.mode === "pac"}
            <div>
                <label class={labelClass} for="proxy-pac"
                    >{t("proxySettings.pacUrl")}</label
                >
                <input
                    id="proxy-pac"
                    type="text"
                    class={inputClass}
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="file:///home/me/proxy.pac"
                    bind:value={draft.pacUrl}
                />
            </div>
        {/if}

        <div>
            <label class={labelClass} for="proxy-calls"
                >{t("proxySettings.calls")}</label
            >
            <select
                id="proxy-calls"
                class={selectClass}
                bind:value={draft.calls}
            >
                <option value="default"
                    >{t("proxySettings.callsDefault")}</option
                >
                <option value="direct">{t("proxySettings.callsDirect")}</option>
                {#if offersCalls("proxy")}
                    <option value="proxy"
                        >{t("proxySettings.callsProxy")}</option
                    >
                {/if}
            </select>
            <p class={hintClass}>
                {draft.calls === "direct"
                    ? t("proxySettings.callsDirectHint")
                    : draft.calls === "proxy"
                      ? t("proxySettings.callsProxyHint")
                      : t("proxySettings.callsDefaultHint")}
            </p>
            {#if bypassUnavailable}
                <p class="text-xs text-zam-warning mt-1">
                    {android
                        ? t("proxySettings.callsDirectUnavailableManual")
                        : t("proxySettings.callsDirectUnavailable")}
                </p>
            {/if}
            {#if info?.calls === "direct" && info.callBypassAddresses.length}
                <p class={hintClass}>
                    {t("proxySettings.callsDirectAddresses")}
                    <span class="font-mono"
                        >{info.callBypassAddresses.join(", ")}</span
                    >
                </p>
            {/if}
        </div>

        <div class="flex items-center gap-3">
            <button
                class="px-3 py-1.5 rounded text-sm font-medium bg-zam-accent hover:bg-zam-accentHover text-white disabled:opacity-50"
                disabled={!dirty || saving}
                onclick={() => void save()}
            >
                {t("proxySettings.save")}
            </button>
            {#if info?.error}
                <p class="text-xs text-zam-danger">
                    {t("proxySettings.applyFailed", { error: info.error })}
                </p>
            {:else if saved && !dirty}
                <p class="text-xs text-zam-textMuted">
                    {t("proxySettings.saved")}
                </p>
            {/if}
            {#if loadError}
                <p class="text-xs text-zam-danger">{loadError}</p>
            {/if}
        </div>
    </section>
{/if}
