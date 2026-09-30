<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        fetchOwnExtendedProfile,
        getPresence,
        getServerCapabilities,
    } from "$lib/matrix/client";
    import { auth } from "$lib/stores/auth.svelte";

    // The raw profile as the server returns it, fetched fresh on demand, so a
    // missing or misnamed field can be told apart from a display problem.
    let loading = $state(false);
    let error = $state("");
    let profile = $state<Record<string, unknown> | null | undefined>(undefined);
    let profileFields = $state<unknown>(undefined);
    let presence = $state<unknown>(undefined);

    const profileJson = $derived(
        profile === undefined ? "" : JSON.stringify(profile, null, 2),
    );

    async function load() {
        loading = true;
        error = "";
        try {
            const [fetched, capabilities, presenceNow] = await Promise.all([
                fetchOwnExtendedProfile(),
                getServerCapabilities().catch(() => ({})),
                auth.userId ? getPresence(auth.userId) : null,
            ]);
            profile = fetched;
            presence = presenceNow;
            profileFields = (capabilities as Record<string, unknown>)[
                "m.profile_fields"
            ];
        } catch (e) {
            profile = undefined;
            error =
                (e as Error)?.message ??
                t("extendedProfileDebug.failedToFetchTheProfile");
        } finally {
            loading = false;
        }
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(profileJson);
        } catch {
            error = t("extendedProfileDebug.couldNotCopyToClipboard");
        }
    }
</script>

<section>
    <p
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
    >
        {t("extendedProfileDebug.extendedProfile")}
    </p>
    <div class="flex gap-2 mb-2">
        <button
            type="button"
            onclick={load}
            disabled={loading}
            class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
            >{loading
                ? t("common.loading")
                : t("extendedProfileDebug.fetchFromServer")}</button
        >
        {#if profile}
            <button
                type="button"
                onclick={copy}
                class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                >{t("common.copy")}</button
            >
        {/if}
    </div>
    {#if error}<p class="text-xs text-discord-danger">{error}</p>{/if}
    {#if profile === null}
        <p class="text-xs text-discord-textMuted">
            {t("extendedProfileDebug.thisServerDoesNotSupportExtended")}
        </p>
    {:else if profile}
        <pre
            class="text-xs font-mono text-discord-textSecondary bg-discord-backgroundTertiary rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">{profileJson}</pre>
        <p class="mt-2 text-xs text-discord-textMuted">
            {t("extendedProfileDebug.presenceGetPresenceStraightFromThe", {
                value: presence
                    ? JSON.stringify(presence)
                    : t("extendedProfileDebug.noneOrTheServerRefused"),
            })}
        </p>
        <p class="mt-1 text-xs text-discord-textMuted">
            {t("extendedProfileDebug.serverRulesForFieldsMProfile", {
                value:
                    profileFields === undefined
                        ? t("extendedProfileDebug.notAdvertisedNoRestrictions")
                        : JSON.stringify(profileFields),
            })}
        </p>
    {/if}
</section>
