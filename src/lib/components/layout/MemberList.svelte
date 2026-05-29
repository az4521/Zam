<script lang="ts">
    import type { Room, RoomMember } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { getRoomMembers, mxcToHttp } from "$lib/matrix/client";
    import { interfaceState } from "$lib/stores/interface.svelte";

    interface Props {
        room: Room;
    }

    let { room }: Props = $props();

    const members = $derived(getRoomMembers(room));

    const admins = $derived(
        members
            .filter((m) => m.powerLevel >= 100)
            .sort((a, b) => a.name.localeCompare(b.name)),
    );
    const moderators = $derived(
        members
            .filter((m) => m.powerLevel >= 50 && m.powerLevel < 100)
            .sort((a, b) => a.name.localeCompare(b.name)),
    );
    const regularMembers = $derived(
        members
            .filter((m) => m.powerLevel < 50)
            .sort((a, b) => a.name.localeCompare(b.name)),
    );

    function getAvatarSrc(member: RoomMember): string | null {
        const mxc = member.getMxcAvatarUrl();
        return mxcToHttp(mxc);
    }
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
            Members — {members.length}
        </h3>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
        {#if admins.length > 0}
            <div class="mb-2">
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    Admins — {admins.length}
                </p>
                {#each admins as member (member.userId)}
                    <div
                        class="flex items-center gap-2 px-2 py-1 mx-2 rounded hover:bg-discord-messageHover transition-colors cursor-pointer group"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={getAvatarSrc(member)}
                                name={member.name}
                                size={32}
                            />
                            <div
                                class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-discord-online rounded-full border-2 border-discord-backgroundSecondary"
                            ></div>
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-medium text-discord-textPrimary truncate group-hover:text-white transition-colors"
                            >
                                {member.name}
                            </p>
                            <p class="text-xs text-discord-textMuted truncate">
                                Admin
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        {#if moderators.length > 0}
            <div class="mb-2">
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    Moderators — {moderators.length}
                </p>
                {#each moderators as member (member.userId)}
                    <div
                        class="flex items-center gap-2 px-2 py-1 mx-2 rounded hover:bg-discord-messageHover transition-colors cursor-pointer group"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={getAvatarSrc(member)}
                                name={member.name}
                                size={32}
                            />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-medium text-discord-textPrimary truncate group-hover:text-white transition-colors"
                            >
                                {member.name}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        {#if regularMembers.length > 0}
            <div>
                <p
                    class="px-4 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    Members — {regularMembers.length}
                </p>
                {#each regularMembers as member (member.userId)}
                    <div
                        class="flex items-center gap-2 px-2 py-1 mx-2 rounded hover:bg-discord-messageHover transition-colors cursor-pointer group"
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={getAvatarSrc(member)}
                                name={member.name}
                                size={32}
                            />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-sm font-medium text-discord-textMuted truncate group-hover:text-discord-textPrimary transition-colors"
                            >
                                {member.name}
                            </p>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
