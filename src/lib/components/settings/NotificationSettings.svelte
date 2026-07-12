<script lang="ts">
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        DEFAULT_PUSH_RULES,
        getClient,
        getDefaultPushRuleLevel,
        getDirectRooms,
        getOrphanRooms,
        getRoomDisplayName,
        getRoomNotificationSetting,
        getRoomsInSpace,
        getSpaces,
        setDefaultPushRuleLevel,
        setRoomNotificationSetting,
        type PushRuleLevel,
        type RoomNotificationSetting,
    } from "$lib/matrix/client";
    import {
        setPrivateReadReceipts,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { initWebPush, requestWebPushPermission } from "$lib/webPush";

    function currentPermission(): NotificationPermission | "unsupported" {
        return typeof Notification === "undefined"
            ? "unsupported"
            : Notification.permission;
    }

    let permission = $state(currentPermission());
    let permissionLoading = $state(false);
    let soundEnabled = $state(
        localStorage.getItem("notifSoundEnabled") !== "false",
    );
    let defaultRulesTick = $state(0);

    async function requestPermission() {
        permissionLoading = true;
        permission = await requestWebPushPermission().catch(currentPermission);
        if (permission === "granted") {
            const client = getClient();
            if (client) await initWebPush(client).catch(() => {});
        }
        permission = currentPermission();
        permissionLoading = false;
    }

    function setSoundEnabled(enabled: boolean) {
        soundEnabled = enabled;
        localStorage.setItem("notifSoundEnabled", String(enabled));
    }

    type NotifRoom = { roomId: string; name: string };
    type NotifGroup = { label: string; rooms: NotifRoom[] };
    const groups = $derived.by((): NotifGroup[] => {
        const result: NotifGroup[] = [];
        for (const space of getSpaces()) {
            const rooms = getRoomsInSpace(space.roomId).map((room) => ({
                roomId: room.roomId,
                name: getRoomDisplayName(room),
            }));
            if (rooms.length > 0) {
                result.push({ label: getRoomDisplayName(space), rooms });
            }
        }
        const addGroup = (
            label: string,
            rooms: ReturnType<typeof getSpaces>,
        ) => {
            if (rooms.length === 0) return;
            result.push({
                label,
                rooms: rooms.map((room) => ({
                    roomId: room.roomId,
                    name: getRoomDisplayName(room),
                })),
            });
        };
        addGroup("Other Rooms", getOrphanRooms());
        addGroup("Direct Messages", getDirectRooms());
        return result;
    });

    const roomOptions: Array<{
        value: RoomNotificationSetting;
        label: string;
        title: string;
    }> = [
        {
            value: "default",
            label: "Default",
            title: "Use global notification settings",
        },
        {
            value: "all",
            label: "All Messages",
            title: "Notify for every message",
        },
        {
            value: "mentions",
            label: "Mentions Only",
            title: "Notify for mentions only",
        },
        { value: "mute", label: "Mute", title: "No notifications" },
    ];

    const ruleLevels = $derived.by(() => {
        void defaultRulesTick;
        return Object.fromEntries(
            DEFAULT_PUSH_RULES.map((rule) => [
                rule.ruleId,
                getDefaultPushRuleLevel(rule.ruleId),
            ]),
        ) as Record<string, PushRuleLevel>;
    });

    async function setRuleLevel(
        rule: (typeof DEFAULT_PUSH_RULES)[number],
        level: PushRuleLevel,
    ) {
        await setDefaultPushRuleLevel(rule.ruleId, rule.kind, level);
        defaultRulesTick++;
    }
</script>

<div class="space-y-6">
    {#if permission !== "granted"}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                System Permission
            </p>
            <div
                class="flex items-center gap-3 py-2 border-b border-discord-divider"
            >
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-discord-textPrimary">
                        Push notifications
                    </p>
                    <p class="text-xs text-discord-textMuted">
                        {#if permission === "denied"}
                            Permission is blocked in system settings
                        {:else if permission === "unsupported"}
                            Notifications are not supported here
                        {:else}
                            Allow this app to send notifications
                        {/if}
                    </p>
                </div>
                <button
                    onclick={requestPermission}
                    disabled={permissionLoading ||
                        permission === "denied" ||
                        permission === "unsupported"}
                    class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-discord-accent flex items-center gap-2 flex-shrink-0"
                >
                    {permissionLoading
                        ? "Requesting…"
                        : permission === "denied"
                          ? "Blocked"
                          : permission === "unsupported"
                            ? "Unavailable"
                            : "Enable"}
                </button>
            </div>
        </section>
    {/if}

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Sound
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Notification sound
                </p>
                <p class="text-xs text-discord-textMuted">
                    Play a sound for loud notifications
                </p>
            </div>
            <ToggleSwitch
                checked={soundEnabled}
                onChange={setSoundEnabled}
                label="Notification sound"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Privacy
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Private read receipts
                </p>
                <p class="text-xs text-discord-textMuted">
                    Hide your read receipts from other users. Your unread counts
                    still work; others just can't see how far you've read.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.privateReadReceipts}
                onChange={setPrivateReadReceipts}
                label="Private read receipts"
            />
        </div>
    </section>

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
        >
            Notification Rules
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            Loud = notify with sound · Silent = notify without sound · Off = no
            notification
        </p>
        <div class="space-y-1">
            {#each DEFAULT_PUSH_RULES as rule}
                <div
                    class="flex items-center gap-3 py-2 border-b border-discord-divider"
                >
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-discord-textPrimary">
                            {rule.label}
                        </p>
                        <p class="text-xs text-discord-textMuted">
                            {rule.description}
                        </p>
                    </div>
                    <OptionSelector
                        value={ruleLevels[rule.ruleId]}
                        options={[
                            { value: "loud", label: "Loud" },
                            { value: "silent", label: "Silent" },
                            { value: "off", label: "Off" },
                        ]}
                        onChange={(level) => setRuleLevel(rule, level)}
                        ariaLabel={rule.label}
                    />
                </div>
            {/each}
        </div>
    </section>

    {#if groups.length > 0}
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide -mb-2"
        >
            Per-room Overrides
        </p>
    {/if}
    {#each groups as group}
        <section>
            <p
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
            >
                {group.label}
            </p>
            <div class="space-y-1">
                {#each group.rooms as room}
                    <div
                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                    >
                        <span
                            class="flex-1 text-sm text-discord-textPrimary truncate"
                            >{room.name}</span
                        >
                        <OptionSelector
                            value={getRoomNotificationSetting(room.roomId)}
                            options={roomOptions}
                            onChange={(setting) =>
                                setRoomNotificationSetting(
                                    room.roomId,
                                    setting,
                                )}
                            ariaLabel={`Notifications for ${room.name}`}
                        />
                    </div>
                {/each}
            </div>
        </section>
    {/each}
    {#if groups.length === 0}
        <p class="text-sm text-discord-textMuted italic">No rooms found.</p>
    {/if}
</div>
