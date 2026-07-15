<script lang="ts">
    import UserPicker from "$lib/components/ui/UserPicker.svelte";
    import { inviteUser, getRoomMemberIds, getRoom } from "$lib/matrix/client";
    import { matrixErrorMessage } from "$lib/utils/knock";

    let { roomId, onClose }: { roomId: string; onClose?: () => void } =
        $props();

    const room = $derived(getRoom(roomId));
    const isSpace = $derived(room?.isSpaceRoom() ?? false);
    // Effectively a snapshot: roomId is the only reactive dependency and it is
    // stable for the dialog's life, so membership changes over sync don't reshuffle it.
    const excludeUserIds = $derived(getRoomMemberIds(roomId));

    let selected = $state<string[]>([]);
    let inviting = $state(false);
    let outcomes = $state<{ userId: string; ok: boolean; error?: string }[]>(
        [],
    );

    async function doInvite() {
        if (!selected.length || inviting) return;
        inviting = true;
        const done: { userId: string; ok: boolean; error?: string }[] = [];
        for (const userId of selected) {
            try {
                await inviteUser(roomId, userId);
                done.push({ userId, ok: true });
            } catch (e) {
                done.push({
                    userId,
                    ok: false,
                    error: matrixErrorMessage(e, "Could not send the invite"),
                });
            }
        }
        outcomes = done;
        // Keep only the ones that failed, so the user can retry them.
        selected = done.filter((d) => !d.ok).map((d) => d.userId);
        inviting = false;
    }
</script>

<div class="space-y-3">
    <p class="text-sm text-discord-textSecondary">
        Invite people to <span class="text-discord-textPrimary font-medium"
            >{room?.name ?? "this " + (isSpace ? "space" : "room")}</span
        >.
    </p>

    <UserPicker mode="multi" bind:selected {excludeUserIds} autofocus />

    {#if outcomes.length}
        <ul class="space-y-1 text-sm">
            {#each outcomes as o (o.userId)}
                <li class="flex items-center gap-2">
                    <span
                        class={o.ok
                            ? "text-discord-textPositive"
                            : "text-discord-danger"}>{o.ok ? "✓" : "✕"}</span
                    >
                    <span class="text-discord-textSecondary truncate"
                        >{o.userId}</span
                    >
                    {#if !o.ok && o.error}
                        <span class="text-discord-textMuted truncate"
                            >— {o.error}</span
                        >
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}

    <div class="flex justify-end gap-2">
        {#if onClose}
            <button
                onclick={onClose}
                class="px-4 py-2 text-sm text-discord-textSecondary hover:text-discord-textPrimary transition-colors"
                >Close</button
            >
        {/if}
        <button
            onclick={doInvite}
            disabled={!selected.length || inviting}
            class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
            >{inviting
                ? "Inviting…"
                : selected.length > 1
                  ? `Invite ${selected.length}`
                  : "Invite"}</button
        >
    </div>
</div>
