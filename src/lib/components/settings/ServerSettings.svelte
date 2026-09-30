<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        getServerCapabilities,
        getServerVersions,
        probeCallingSupport,
    } from "$lib/matrix/client";
    import { auth } from "$lib/stores/auth.svelte";
    import {
        labelUnstableFeature,
        serverSupports,
        specAtLeast,
        type GatedFeature,
    } from "$lib/utils/serverCapabilities";

    type Support = "yes" | "no" | "unknown";
    interface FeatureRow {
        label: string;
        support: Support;
    }

    let loading = $state(true);
    let error = $state("");
    let specVersions = $state<string[]>([]);
    let features = $state<FeatureRow[]>([]);
    let roomVersion = $state("");
    let unstableLabels = $state<string[]>([]);
    let callingFeatures = $state<FeatureRow[]>([]);

    function badge(support: Support): { text: string; cls: string } {
        if (support === "yes") {
            return {
                text: t("serverSettings.supported"),
                cls: "text-discord-textPositive",
            };
        }
        if (support === "no") {
            return {
                text: t("serverSettings.notSupported"),
                cls: "text-discord-danger",
            };
        }
        return {
            text: t("serverSettings.unknown"),
            cls: "text-discord-textMuted",
        };
    }

    async function load() {
        loading = true;
        error = "";
        try {
            const [versions, capabilities, calling] = await Promise.all([
                getServerVersions(),
                getServerCapabilities(),
                probeCallingSupport(),
            ]);
            specVersions = versions.versions;
            const gate = (feature: GatedFeature): Support =>
                serverSupports(feature, capabilities) ? "yes" : "no";
            features = [
                {
                    label: t("serverSettings.changePassword"),
                    support: gate("changePassword"),
                },
                {
                    label: t("serverSettings.changeDisplayName"),
                    support: gate("setDisplayName"),
                },
                {
                    label: t("serverSettings.changeAvatar"),
                    support: gate("setAvatarUrl"),
                },
                {
                    label: t("serverSettings.manageEmailsPhoneNumbers"),
                    support: gate("change3pid"),
                },
                {
                    label: t("serverSettings.threads"),
                    support: specAtLeast(versions.versions, "v1.4")
                        ? "yes"
                        : "unknown",
                },
                {
                    label: t("serverSettings.privateReadReceipts"),
                    support:
                        specAtLeast(versions.versions, "v1.4") ||
                        versions.unstableFeatures["org.matrix.msc2285.stable"]
                            ? "yes"
                            : "unknown",
                },
            ];
            roomVersion =
                (capabilities["m.room_versions"] as { default?: string })
                    ?.default ?? "";
            unstableLabels = Object.entries(versions.unstableFeatures)
                .filter(([, enabled]) => enabled)
                .map(([name]) => labelUnstableFeature(name))
                .sort((a, b) => a.localeCompare(b));
            const asSupport = (ok: boolean): Support => (ok ? "yes" : "no");
            callingFeatures = [
                {
                    label: t("serverSettings.sfuDiscoveryRtcFoci"),
                    support: asSupport(calling.rtcFoci),
                },
                {
                    label: t("serverSettings.delayedEventsCallCleanup"),
                    support: asSupport(calling.delayedEvents),
                },
            ];
        } catch (loadError) {
            error =
                (loadError as Error)?.message ??
                t("serverSettings.failedToReadServerCapabilities");
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        load();
    });
</script>

<div class="space-y-6">
    {#if loading}
        <p class="text-sm text-discord-textMuted">
            {t("serverSettings.scanningServer")}
        </p>
    {:else if error}
        <div class="space-y-2">
            <p class="text-sm text-discord-danger">{error}</p>
            <button
                type="button"
                onclick={load}
                class="px-3 py-1.5 rounded text-sm bg-discord-backgroundTertiary text-discord-textPrimary hover:bg-discord-messageHover"
                >{t("common.retry")}</button
            >
        </div>
    {:else}
        <p class="text-xs text-discord-textMuted">
            {t("serverSettings.what")}
            <span class="text-discord-textSecondary">{auth.homeserverUrl}</span>
            {t("serverSettings.advertisesItemsMarkedUnknownArenT")}
        </p>

        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                {t("serverSettings.accountMessaging")}
            </p>
            {#each features as feature}
                {@const status = badge(feature.support)}
                <div
                    class="flex justify-between items-center py-2 border-b border-discord-divider text-sm"
                >
                    <span class="text-discord-textSecondary"
                        >{feature.label}</span
                    >
                    <span class="text-xs {status.cls}">{status.text}</span>
                </div>
            {/each}
        </section>

        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                {t("serverSettings.voiceVideoCallingMatrixrtc")}
            </p>
            {#each callingFeatures as feature}
                {@const status = badge(feature.support)}
                <div
                    class="flex justify-between items-center py-2 border-b border-discord-divider text-sm"
                >
                    <span class="text-discord-textSecondary"
                        >{feature.label}</span
                    >
                    <span class="text-xs {status.cls}">{status.text}</span>
                </div>
            {/each}
        </section>

        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                {t("serverSettings.server")}
            </p>
            <div
                class="flex justify-between items-center py-2 border-b border-discord-divider text-sm"
            >
                <span class="text-discord-textMuted"
                    >{t("serverSettings.latestSpecVersion")}</span
                >
                <span class="text-discord-textPrimary text-xs font-mono"
                    >{specVersions.at(-1) ?? "-"}</span
                >
            </div>
            {#if roomVersion}
                <div
                    class="flex justify-between items-center py-2 border-b border-discord-divider text-sm"
                >
                    <span class="text-discord-textMuted"
                        >{t("serverSettings.defaultRoomVersion")}</span
                    >
                    <span class="text-discord-textPrimary text-xs font-mono"
                        >{roomVersion}</span
                    >
                </div>
            {/if}
        </section>

        {#if unstableLabels.length > 0}
            <section>
                <p
                    class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
                >
                    {t("serverSettings.advertisedFeatures", {
                        length: unstableLabels.length,
                    })}
                </p>
                <div class="flex flex-wrap gap-1.5">
                    {#each unstableLabels as feature}
                        <span
                            class="px-2 py-0.5 rounded text-xs bg-discord-backgroundTertiary text-discord-textSecondary border border-discord-divider"
                            >{feature}</span
                        >
                    {/each}
                </div>
            </section>
        {/if}
    {/if}
</div>
