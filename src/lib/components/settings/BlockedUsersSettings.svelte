<script lang="ts">
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        ignoredUsersState,
        unblockUser,
    } from "$lib/stores/ignoredUsers.svelte";

    let pending = $state<string | null>(null);
    let error = $state("");
    const userIds = $derived(
        [...ignoredUsersState.userIds].sort((a, b) => a.localeCompare(b)),
    );

    async function unblock(userId: string) {
        pending = userId;
        error = "";
        try {
            await unblockUser(userId);
        } catch (unblockError) {
            error = (unblockError as Error)?.message ?? "Failed";
        } finally {
            pending = null;
        }
    }
</script>

<div class="space-y-4">
    <p class="text-xs text-discord-textMuted">
        Messages from blocked users are hidden in every room. The list is stored
        on your account and applies to all your sessions.
    </p>
    {#if error}<p class="text-sm text-discord-danger">{error}</p>{/if}
    {#if userIds.length === 0}
        <p class="text-sm text-discord-textMuted text-center py-8">
            You haven't blocked anyone.
        </p>
    {:else}
        <div class="space-y-1">
            {#each userIds as userId (userId)}
                <div
                    class="flex items-center gap-3 p-2 rounded bg-discord-backgroundTertiary"
                >
                    <Avatar
                        src={null}
                        name={userId.replace(/^@/, "")}
                        id={userId}
                        size={28}
                    />
                    <p
                        class="flex-1 min-w-0 text-sm text-discord-textPrimary font-mono truncate"
                    >
                        {userId}
                    </p>
                    <button
                        onclick={() => unblock(userId)}
                        disabled={pending === userId}
                        class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                        >Unblock</button
                    >
                </div>
            {/each}
        </div>
    {/if}
</div>
