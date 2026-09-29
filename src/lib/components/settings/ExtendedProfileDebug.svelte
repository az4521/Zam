<script lang="ts">
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
            error = (e as Error)?.message ?? "Failed to fetch the profile";
        } finally {
            loading = false;
        }
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(profileJson);
        } catch {
            error = "Could not copy to clipboard";
        }
    }
</script>

<section>
    <p
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
    >
        Extended profile
    </p>
    <div class="flex gap-2 mb-2">
        <button
            type="button"
            onclick={load}
            disabled={loading}
            class="px-3 py-1.5 bg-discord-accent text-white rounded text-sm disabled:opacity-50"
            >{loading ? "Loading…" : "Fetch from server"}</button
        >
        {#if profile}
            <button
                type="button"
                onclick={copy}
                class="px-3 py-1.5 bg-discord-backgroundTertiary text-discord-textPrimary rounded text-sm"
                >Copy</button
            >
        {/if}
    </div>
    {#if error}<p class="text-xs text-discord-danger">{error}</p>{/if}
    {#if profile === null}
        <p class="text-xs text-discord-textMuted">
            This server does not support extended profiles.
        </p>
    {:else if profile}
        <pre
            class="text-xs font-mono text-discord-textSecondary bg-discord-backgroundTertiary rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap break-all">{profileJson}</pre>
        <p class="mt-2 text-xs text-discord-textMuted">
            Presence (GET /presence, straight from the server): {presence
                ? JSON.stringify(presence)
                : "none, or the server refused"}
        </p>
        <p class="mt-1 text-xs text-discord-textMuted">
            Server rules for fields (m.profile_fields): {profileFields ===
            undefined
                ? "not advertised (no restrictions)"
                : JSON.stringify(profileFields)}
        </p>
    {/if}
</section>
