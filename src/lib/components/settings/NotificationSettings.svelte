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
        getKeywordRules,
        addKeywordRule,
        setKeywordRuleBehavior,
        setKeywordRuleEnabled,
        deleteKeywordRule,
        type PushRuleLevel,
        type RoomNotificationSetting,
        type KeywordBehavior,
        type KeywordRuleView,
    } from "$lib/matrix/client";
    import { validateKeyword } from "$lib/utils/keywordRules";
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

    const keywordRules = $derived(getKeywordRules());
    let newKeyword = $state("");
    let keywordError = $state("");
    let addPending = $state(false);
    let rowPending = $state<string | null>(null);

    const behaviorOptions: ReadonlyArray<{
        value: KeywordBehavior;
        label: string;
        title: string;
    }> = [
        {
            value: "highlight_sound",
            label: "Highlight + Sound",
            title: "Notify with a highlight and sound",
        },
        {
            value: "highlight",
            label: "Highlight",
            title: "Notify with a highlight",
        },
        {
            value: "notify",
            label: "Notify",
            title: "Notify without a highlight",
        },
    ];

    async function addKeyword() {
        const result = validateKeyword(
            newKeyword,
            keywordRules.map((r) => r.pattern),
        );
        if (!result.ok) {
            keywordError = result.error;
            return;
        }
        addPending = true;
        keywordError = "";
        try {
            await addKeywordRule(result.pattern, "highlight_sound");
            newKeyword = "";
        } catch (e) {
            keywordError = (e as Error)?.message ?? "Failed to add keyword";
        } finally {
            addPending = false;
        }
    }

    async function changeBehavior(ruleId: string, behavior: KeywordBehavior) {
        rowPending = ruleId;
        try {
            await setKeywordRuleBehavior(ruleId, behavior);
        } finally {
            rowPending = null;
        }
    }

    async function toggleEnabled(ruleId: string, enabled: boolean) {
        rowPending = ruleId;
        try {
            await setKeywordRuleEnabled(ruleId, enabled);
        } finally {
            rowPending = null;
        }
    }

    async function removeKeyword(ruleId: string) {
        rowPending = ruleId;
        try {
            await deleteKeywordRule(ruleId);
        } finally {
            rowPending = null;
        }
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

    <section>
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1"
        >
            Keyword Highlights
        </p>
        <p class="text-xs text-discord-textMuted mb-3">
            Get notified when a message contains a word or phrase. Matching is
            case-insensitive; <span class="font-mono">*</span> and
            <span class="font-mono">?</span> are wildcards.
        </p>
        <form
            class="flex items-center gap-2 mb-2"
            onsubmit={(e) => {
                e.preventDefault();
                addKeyword();
            }}
        >
            <input
                bind:value={newKeyword}
                type="text"
                placeholder="Add a keyword…"
                aria-label="New keyword"
                class="flex-1 min-w-0 px-3 py-1.5 rounded text-sm bg-discord-backgroundTertiary text-discord-textPrimary placeholder:text-discord-textMuted focus:outline-none focus:ring-1 focus:ring-discord-accent"
            />
            <button
                type="submit"
                disabled={addPending}
                class="px-3 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
                >Add</button
            >
        </form>
        {#if keywordError}
            <p class="text-sm text-discord-danger mb-2">{keywordError}</p>
        {/if}
        {#if keywordRules.length === 0}
            <p class="text-sm text-discord-textMuted italic">
                No keyword rules yet.
            </p>
        {:else}
            <div class="space-y-1">
                {#each keywordRules as rule (rule.ruleId)}
                    <div
                        class="flex items-center gap-3 py-2 border-b border-discord-divider"
                    >
                        <span
                            class="flex-1 min-w-0 text-sm text-discord-textPrimary font-mono truncate"
                            >{rule.pattern}</span
                        >
                        <OptionSelector
                            value={rule.behavior}
                            options={behaviorOptions}
                            onChange={(b) => changeBehavior(rule.ruleId, b)}
                            ariaLabel={`Behavior for ${rule.pattern}`}
                        />
                        <ToggleSwitch
                            checked={rule.enabled}
                            onChange={(v) => toggleEnabled(rule.ruleId, v)}
                            label={`Enable ${rule.pattern}`}
                        />
                        <button
                            onclick={() => removeKeyword(rule.ruleId)}
                            disabled={rowPending === rule.ruleId}
                            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary transition-colors disabled:opacity-50"
                            >Delete</button
                        >
                    </div>
                {/each}
            </div>
        {/if}
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
