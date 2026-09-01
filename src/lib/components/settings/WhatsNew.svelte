<script lang="ts">
    import { onMount } from "svelte";
    import {
        APP_VERSION,
        fetchReleaseList,
        openReleasePage,
    } from "$lib/update";
    import {
        pickReleaseForVersion,
        type ChangelogRelease,
    } from "$lib/utils/changelog";
    import { GITHUB_OWNER, GITHUB_REPO } from "$lib/utils/androidUpdate";
    import ReleaseNotesBody from "./ReleaseNotesBody.svelte";

    let releases = $state<ChangelogRelease[]>([]);
    let loading = $state(true);
    let failed = $state(false);

    const current = $derived(pickReleaseForVersion(releases, APP_VERSION));
    const older = $derived(
        current ? releases.filter((r) => r !== current) : releases,
    );

    onMount(async () => {
        try {
            releases = await fetchReleaseList(10);
        } catch {
            failed = true;
        } finally {
            loading = false;
        }
    });

    function formatDate(iso: string): string {
        if (!iso) return "";
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
    }
</script>

<section>
    <p
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
    >
        What's New
    </p>

    {#if loading}
        <p class="text-sm text-discord-textMuted">Loading release notes…</p>
    {:else if failed || releases.length === 0}
        <p class="text-sm text-discord-textMuted">
            Release notes unavailable.
            <button
                type="button"
                class="underline text-discord-accent hover:text-discord-textPrimary"
                onclick={() =>
                    openReleasePage(
                        `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`,
                    )}
            >
                View on GitHub
            </button>
        </p>
    {:else}
        {#if current}
            <div class="py-2 border-b border-discord-divider">
                <p class="text-sm font-semibold text-discord-textPrimary mb-1">
                    {current.name}
                    {#if formatDate(current.published_at)}
                        <span
                            class="text-xs text-discord-textMuted font-normal"
                        >
                            · {formatDate(current.published_at)}
                        </span>
                    {/if}
                </p>
                <ReleaseNotesBody body={current.body} />
            </div>
        {/if}
        {#each older as r (r.tag_name)}
            <details class="py-2 border-b border-discord-divider">
                <summary
                    class="text-sm text-discord-textPrimary cursor-pointer select-none"
                >
                    {r.name}
                    {#if formatDate(r.published_at)}
                        <span class="text-xs text-discord-textMuted">
                            · {formatDate(r.published_at)}
                        </span>
                    {/if}
                </summary>
                <div class="mt-1">
                    <ReleaseNotesBody body={r.body} />
                </div>
            </details>
        {/each}
    {/if}
</section>
