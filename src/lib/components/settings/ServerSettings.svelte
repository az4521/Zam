<script lang="ts">
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
            return { text: "Supported", cls: "text-green-400" };
        }
        if (support === "no") {
            return { text: "Not supported", cls: "text-discord-danger" };
        }
        return { text: "Unknown", cls: "text-discord-textMuted" };
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
                { label: "Change password", support: gate("changePassword") },
                {
                    label: "Change display name",
                    support: gate("setDisplayName"),
                },
                { label: "Change avatar", support: gate("setAvatarUrl") },
                {
                    label: "Manage emails / phone numbers",
                    support: gate("change3pid"),
                },
                {
                    label: "Threads",
                    support: specAtLeast(versions.versions, "v1.4")
                        ? "yes"
                        : "unknown",
                },
                {
                    label: "Private read receipts",
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
                    label: "SFU discovery (rtc_foci)",
                    support: asSupport(calling.rtcFoci),
                },
                {
                    label: "Delayed events (call cleanup)",
                    support: asSupport(calling.delayedEvents),
                },
            ];
        } catch (loadError) {
            error =
                (loadError as Error)?.message ??
                "Failed to read server capabilities";
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
        <p class="text-sm text-discord-textMuted">Scanning server…</p>
    {:else if error}
        <div class="space-y-2">
            <p class="text-sm text-discord-danger">{error}</p>
            <button
                type="button"
                onclick={load}
                class="px-3 py-1.5 rounded text-sm bg-discord-backgroundTertiary text-discord-textPrimary hover:bg-discord-messageHover"
                >Retry</button
            >
        </div>
    {:else}
        <p class="text-xs text-discord-textMuted">
            What <span class="text-discord-textSecondary"
                >{auth.homeserverUrl}</span
            > advertises. Items marked “Unknown” aren’t advertised by the server and
            are detected only when used.
        </p>

        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
            >
                Account &amp; messaging
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
                Voice / video calling (MatrixRTC)
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
                Server
            </p>
            <div
                class="flex justify-between items-center py-2 border-b border-discord-divider text-sm"
            >
                <span class="text-discord-textMuted">Latest spec version</span>
                <span class="text-discord-textPrimary text-xs font-mono"
                    >{specVersions.at(-1) ?? "—"}</span
                >
            </div>
            {#if roomVersion}
                <div
                    class="flex justify-between items-center py-2 border-b border-discord-divider text-sm"
                >
                    <span class="text-discord-textMuted"
                        >Default room version</span
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
                    Advertised features ({unstableLabels.length})
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
