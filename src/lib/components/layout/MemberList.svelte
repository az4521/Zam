<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import type { Room, RoomMember } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getRoomMembers,
        getUserPowerLevel,
        loadRoomMembersIfNeeded,
        mxcToHttp,
        memberDisplayName,
    } from "$lib/matrix/client";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";
    import { presenceState, presenceFor } from "$lib/stores/presence.svelte";
    import {
        presenceDot,
        presenceDotClass,
        presenceLabel,
    } from "$lib/utils/presence";

    interface Props {
        room: Room;
    }

    let { room }: Props = $props();
    let memberTick = $state(0);

    onMount(() => {
        loadRoomMembersIfNeeded(room)
            .then(() => memberTick++)
            .catch(() => {});
    });

    const members = $derived.by(() => {
        void memberTick;
        // Re-derive on sync updates too, or kicks/bans/joins from other
        // sessions never leave the list (same fix the room-settings members
        // tab got; live SDK Room objects mutate in place).
        void roomsState.roomsTick;
        return getRoomMembers(room);
    });

    // One pass and a shared collator: this re-runs on every sync response,
    // and in a big room three filters (each looking up every member's power
    // level) plus three localeCompare sorts were tens of ms per run.
    const collator = new Intl.Collator();
    const groups = $derived.by(() => {
        const admins: RoomMember[] = [];
        const moderators: RoomMember[] = [];
        const regular: RoomMember[] = [];
        for (const m of members) {
            const l = getUserPowerLevel(room, m.userId);
            (l >= 100 ? admins : l >= 50 ? moderators : regular).push(m);
        }
        const byName = (a: RoomMember, b: RoomMember) =>
            collator.compare(a.name, b.name);
        admins.sort(byName);
        moderators.sort(byName);
        regular.sort(byName);
        return { admins, moderators, regular };
    });
    const admins = $derived(groups.admins);
    const moderators = $derived(groups.moderators);
    const regularMembers = $derived(groups.regular);

    function getAvatarSrc(member: RoomMember): string | null {
        const mxc = member.getMxcAvatarUrl();
        return mxcToHttp(mxc);
    }

    // Presence dot class + tooltip per member. Depends on the presence tick
    // so dots recolor when m.presence events arrive over sync; unknown
    // presence (e.g. the server has it disabled) renders as offline.
    const memberPresence = $derived.by(() => {
        void presenceState.presenceTick;
        const map = new Map<string, { dotClass: string; label: string }>();
        for (const member of members) {
            const p = presenceFor(member.userId);
            const state = p?.state ?? "offline";
            map.set(member.userId, {
                dotClass: presenceDotClass(presenceDot(state)),
                label: p?.statusMsg
                    ? `${presenceLabel(state)} - ${p.statusMsg}`
                    : presenceLabel(state),
            });
        }
        return map;
    });
</script>

<div
    class="{interfaceState.isMobile
        ? ''
        : 'w-72'} h-full bg-discord-backgroundSecondary flex flex-col flex-shrink-0 overflow-hidden border-l border-discord-divider"
>
    <div
        class="h-12 px-4 flex items-center border-b border-discord-divider flex-shrink-0"
    >
        <h3
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("memberList.members", { length: members.length })}
        </h3>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
        {#if admins.length > 0}
            <div class="mb-2">
                <!-- px-4 matches the member rows' mx-2 + px-2 = 16px inset. -->
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    {t("memberList.admins", { length: admins.length })}
                </p>
                {#each admins as member (member.userId)}
                    {@const presence = memberPresence.get(member.userId)}
                    <button
                        onclick={(e) =>
                            openProfileCard(member.userId, e.currentTarget)}
                        class="w-[calc(100%-1rem)] text-start flex items-center gap-2 px-2 py-1 mx-2 rounded hover:bg-discord-messageHover transition-colors cursor-pointer group"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={getAvatarSrc(member)}
                                name={member.name}
                                id={member.userId}
                                size={32}
                            />
                            <div
                                title={presence?.label}
                                class="absolute bottom-0 end-0 w-2.5 h-2.5 {presence?.dotClass ??
                                    'bg-discord-offline'} rounded-full border-2 border-discord-backgroundSecondary"
                            ></div>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-medium text-discord-textPrimary truncate group-hover:text-discord-textPrimary transition-colors"
                            >
                                {memberDisplayName(member)}
                            </p>
                            <p class="text-xs text-discord-textMuted truncate">
                                {t("memberList.admin")}
                            </p>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}

        {#if moderators.length > 0}
            <div class="mb-2">
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    {t("memberList.moderators", { length: moderators.length })}
                </p>
                {#each moderators as member (member.userId)}
                    {@const presence = memberPresence.get(member.userId)}
                    <button
                        onclick={(e) =>
                            openProfileCard(member.userId, e.currentTarget)}
                        class="w-[calc(100%-1rem)] text-start flex items-center gap-2 px-2 py-1 mx-2 rounded hover:bg-discord-messageHover transition-colors cursor-pointer group"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={getAvatarSrc(member)}
                                name={member.name}
                                id={member.userId}
                                size={32}
                            />
                            <div
                                title={presence?.label}
                                class="absolute bottom-0 end-0 w-2.5 h-2.5 {presence?.dotClass ??
                                    'bg-discord-offline'} rounded-full border-2 border-discord-backgroundSecondary"
                            ></div>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-medium text-discord-textPrimary truncate group-hover:text-discord-textPrimary transition-colors"
                            >
                                {memberDisplayName(member)}
                            </p>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}

        {#if regularMembers.length > 0}
            <div>
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    {t("memberList.members", { length: regularMembers.length })}
                </p>
                {#each regularMembers as member (member.userId)}
                    {@const presence = memberPresence.get(member.userId)}
                    <button
                        onclick={(e) =>
                            openProfileCard(member.userId, e.currentTarget)}
                        class="w-[calc(100%-1rem)] text-start flex items-center gap-2 px-2 py-1 mx-2 rounded hover:bg-discord-messageHover transition-colors cursor-pointer group"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={getAvatarSrc(member)}
                                name={member.name}
                                id={member.userId}
                                size={32}
                            />
                            <div
                                title={presence?.label}
                                class="absolute bottom-0 end-0 w-2.5 h-2.5 {presence?.dotClass ??
                                    'bg-discord-offline'} rounded-full border-2 border-discord-backgroundSecondary"
                            ></div>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-medium text-discord-textMuted truncate group-hover:text-discord-textPrimary transition-colors"
                            >
                                {memberDisplayName(member)}
                            </p>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>
