<script lang="ts">
    import UserPicker from "$lib/components/ui/UserPicker.svelte";
    import { Check, X } from "lucide-svelte";
    import {
        inviteUser,
        getRoomMemberIds,
        getRoom,
        inviteEmailToRoom,
        getIdentityServer,
    } from "$lib/matrix/client";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import {
        isValidEmail,
        getThreePidInviteState,
    } from "$lib/utils/threePidInvite";

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

    const emailState = $derived(
        getThreePidInviteState({
            hasIdentityServer: !!getIdentityServer(),
            canInvite: true,
        }),
    );

    let emailAddress = $state("");
    let emailInviting = $state(false);
    let emailError = $state("");
    let emailOutcome = $state<{
        ok: boolean;
        address: string;
        error?: string;
    } | null>(null);

    async function doEmailInvite() {
        if (emailInviting) return;
        const addr = emailAddress.trim();
        if (!isValidEmail(addr)) {
            emailError = "Enter a valid email address.";
            return;
        }
        emailError = "";
        emailInviting = true;
        try {
            await inviteEmailToRoom(roomId, addr);
            emailOutcome = { ok: true, address: addr };
            emailAddress = "";
        } catch (e) {
            emailOutcome = {
                ok: false,
                address: addr,
                error: matrixErrorMessage(e, "Could not send the email invite"),
            };
        }
        emailInviting = false;
    }

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
                        role="img"
                        aria-label={o.ok ? "Invited" : "Failed"}
                        class="flex items-center {o.ok
                            ? 'text-discord-textPositive'
                            : 'text-discord-danger'}"
                    >
                        {#if o.ok}<Check size={14} />{:else}<X size={14} />{/if}
                    </span>
                    <span class="text-discord-textSecondary truncate"
                        >{o.userId}</span
                    >
                    {#if !o.ok && o.error}
                        <span class="text-discord-textMuted truncate"
                            >- {o.error}</span
                        >
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}

    <div class="border-t border-discord-backgroundTertiary pt-3 space-y-2">
        <p class="text-xs font-semibold uppercase text-discord-textMuted">
            Invite by email
        </p>
        {#if emailState.available}
            <div class="flex gap-2">
                <input
                    type="email"
                    bind:value={emailAddress}
                    placeholder="name@example.com"
                    onkeydown={(e) => {
                        if (e.key === "Enter") doEmailInvite();
                    }}
                    class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary placeholder-discord-textMuted text-sm rounded px-3 py-2 outline-none border border-transparent focus:border-discord-accent/50"
                />
                <button
                    onclick={doEmailInvite}
                    disabled={!emailAddress.trim() || emailInviting}
                    class="px-4 py-2 bg-discord-accent hover:bg-discord-accentHover text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
                    >{emailInviting ? "Inviting…" : "Invite"}</button
                >
            </div>
            {#if emailError}
                <p class="text-xs text-discord-danger">{emailError}</p>
            {/if}
            {#if emailOutcome}
                <p class="flex items-center gap-2 text-sm">
                    <span
                        role="img"
                        aria-label={emailOutcome.ok ? "Invited" : "Failed"}
                        class="flex items-center {emailOutcome.ok
                            ? 'text-discord-textPositive'
                            : 'text-discord-danger'}"
                    >
                        {#if emailOutcome.ok}<Check size={14} />{:else}<X
                                size={14}
                            />{/if}
                    </span>
                    <span class="text-discord-textSecondary truncate"
                        >{emailOutcome.address}</span
                    >
                    {#if !emailOutcome.ok && emailOutcome.error}
                        <span class="text-discord-textMuted truncate"
                            >- {emailOutcome.error}</span
                        >
                    {/if}
                </p>
            {/if}
        {:else}
            <p class="text-sm text-discord-textMuted">{emailState.reason}</p>
        {/if}
    </div>

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
