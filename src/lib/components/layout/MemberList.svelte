<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import type { Room, RoomMember } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getRoomMembers,
        getUserPowerLevel,
        hasImmutableCreatorPower,
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
    import { pluginRegistry } from "$lib/stores/plugins.svelte";
    import { collectMemberDecorations } from "$lib/plugins/pluginMembers";

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
        const creators: RoomMember[] = [];
        const admins: RoomMember[] = [];
        const moderators: RoomMember[] = [];
        const regular: RoomMember[] = [];
        for (const m of members) {
            // Immutable creators sit above admins even though their written
            // level is lifted to 100 for gate purposes.
            if (hasImmutableCreatorPower(room, m.userId)) {
                creators.push(m);
                continue;
            }
            const l = getUserPowerLevel(room, m.userId);
            (l >= 100 ? admins : l >= 50 ? moderators : regular).push(m);
        }
        const byName = (a: RoomMember, b: RoomMember) =>
            collator.compare(a.name, b.name);
        creators.sort(byName);
        admins.sort(byName);
        moderators.sort(byName);
        regular.sort(byName);
        return { creators, admins, moderators, regular };
    });
    const creators = $derived(groups.creators);
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

    // Plugin badges / second lines (zam.members.decorate). Re-run on every
    // registry tick (members.refresh() bumps it) and member change.
    const memberDecorations = $derived.by(() => {
        void pluginRegistry.tick;
        const decorators = pluginRegistry.memberDecorators.map((e) => e.value);
        const map = new Map<
            string,
            ReturnType<typeof collectMemberDecorations>
        >();
        if (decorators.length === 0) return map;
        for (const member of members) {
            map.set(
                member.userId,
                collectMemberDecorations(decorators, {
                    roomId: room.roomId,
                    userId: member.userId,
                }),
            );
        }
        return map;
    });
</script>

{#snippet memberRow(
    member: RoomMember,
    roleLabel: string | null,
    muted: boolean,
)}
    {@const presence = memberPresence.get(member.userId)}
    {@const deco = memberDecorations.get(member.userId)}
    <button
        onclick={(e) => openProfileCard(member.userId, e.currentTarget)}
        data-user-id={member.userId}
        title={deco?.tooltip ?? undefined}
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
            <p class="flex items-center gap-1 min-w-0">
                <span
                    class="text-sm font-medium truncate group-hover:text-discord-textPrimary transition-colors {muted
                        ? 'text-discord-textMuted'
                        : 'text-discord-textPrimary'}"
                >
                    {memberDisplayName(member)}
                </span>
                {#each deco?.badges ?? [] as badge, i (i)}
                    <span
                        class="flex-shrink-0 px-1 rounded bg-discord-backgroundTertiary text-[10px] font-semibold uppercase text-discord-textMuted"
                        >{badge}</span
                    >
                {/each}
            </p>
            {#if roleLabel}
                <p class="text-xs text-discord-textMuted truncate">
                    {roleLabel}
                </p>
            {/if}
            {#if deco?.subtitle}
                <p class="text-xs text-discord-textMuted truncate">
                    {deco.subtitle}
                </p>
            {/if}
        </div>
    </button>
{/snippet}

<div
    data-zam-region="member-list"
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
        {#if creators.length > 0}
            <div class="mb-2">
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    {t("memberList.creators", { length: creators.length })}
                </p>
                {#each creators as member (member.userId)}
                    {@render memberRow(
                        member,
                        t("roomSettings.creatorLabel"),
                        false,
                    )}
                {/each}
            </div>
        {/if}

        {#if admins.length > 0}
            <div class="mb-2">
                <!-- px-4 matches the member rows' mx-2 + px-2 = 16px inset. -->
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    {t("memberList.admins", { length: admins.length })}
                </p>
                {#each admins as member (member.userId)}
                    {@render memberRow(member, t("memberList.admin"), false)}
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
                    {@render memberRow(member, null, false)}
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
                    {@render memberRow(member, null, true)}
                {/each}
            </div>
        {/if}
    </div>
</div>
