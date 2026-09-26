<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState, setActiveRoom } from "$lib/stores/rooms.svelte";
    import { showChatView } from "$lib/stores/interface.svelte";
    import { hostBridge } from "$lib/plugins/hostBridge";
    import {
        getMyPowerLevel,
        getUserPowerLevel,
        getRoomPowerLevels,
        getMemberName,
        kickUser,
        banUser,
        createDirectMessage,
        retryRoomFollowUp,
        getRoom,
        setVoiceInputDevice,
        setVoiceOutputDevice,
    } from "$lib/matrix/client";
    import type { RoomFollowUp } from "$lib/utils/roomCreationOutcome";
    import { menuGates } from "$lib/utils/callMenu";
    import {
        shouldEncryptNewDm,
        shouldWarnPlaintextDmReuse,
        PLAINTEXT_DM_REUSE_WARNING,
    } from "$lib/utils/roomEncryption";
    import {
        settingsState,
        setAudioInputDeviceId,
        setAudioOutputDeviceId,
    } from "$lib/stores/settings.svelte";
    import { isCryptoAvailable, isRoomEncrypted } from "$lib/matrix/crypto";
    import {
        setUserVolume,
        setUserLocalMute,
        participantAudioFor,
        setUserVideoHidden,
    } from "$lib/stores/voiceCall.svelte";
    import { openProfileCard } from "$lib/stores/profileCard.svelte";
    import {
        isUserBlocked,
        blockUser,
        unblockUser,
    } from "$lib/stores/ignoredUsers.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { dismissOnOutsidePointer } from "$lib/actions/dismissOnOutsidePointer";
    import { Circle, ChevronRight } from "lucide-svelte";
    import { listMediaDevices } from "$lib/audio/devices";
    import { toDeviceOptions } from "$lib/utils/audioDevices";
    import {
        toggleSubmenu,
        activeDeviceLabel,
        type SubmenuSection,
    } from "$lib/utils/callMenuSubmenu";
    import { tick } from "svelte";

    interface Props {
        room: Room;
        userId: string;
        x: number;
        y: number;
        touch?: boolean;
        onClose: () => void;
    }
    let { room, userId, x, y, touch = false, onClose }: Props = $props();

    const isSelf = $derived(userId === auth.userId);

    // Live SDK objects mutate in place — depend on the tick so power-level and
    // membership changes re-derive while the menu is open.
    const name = $derived(
        (void roomsState.roomsTick, getMemberName(room, userId)),
    );
    const gates = $derived.by(() => {
        void roomsState.roomsTick;
        const member = room.getMember(userId);
        // A stale RTC membership can outlive the room membership. A *missing*
        // member means "cannot act", not "level 0" — otherwise we'd offer an
        // admin Kick/Ban entries that only fail server-side. Mirrors
        // UserProfileCard's `!!member` guard; `menuGates` has no such concept,
        // so the check belongs here at the call site.
        if (!member) return { canKick: false, canBan: false };
        const pl = getRoomPowerLevels(room);
        return menuGates({
            isSelf,
            myLevel: getMyPowerLevel(room),
            targetLevel: getUserPowerLevel(room, userId),
            kickLevel: pl.kick,
            banLevel: pl.ban,
        });
    });
    const audio = $derived(participantAudioFor(userId));
    const blocked = $derived(isUserBlocked(userId));

    // Device enumeration for self audio device switching.
    let mics = $state<{ id: string; label: string }[]>([]);
    let speakers = $state<{ id: string; label: string }[]>([]);
    let openSection = $state<SubmenuSection | null>(null);

    async function loadDevices(): Promise<void> {
        const all = await listMediaDevices();
        mics = toDeviceOptions(all, "audioinput");
        speakers = toDeviceOptions(all, "audiooutput");
    }
    $effect(() => {
        if (isSelf) void loadDevices();
    });

    function pickMic(id: string | null): void {
        setAudioInputDeviceId(id);
        void setVoiceInputDevice(id);
    }
    function pickSpeaker(id: string | null): void {
        setAudioOutputDeviceId(id);
        setVoiceOutputDevice(id);
    }

    // Keyboard navigation helpers for the accordion.
    function getMenuRoot(target: HTMLElement): HTMLElement | null {
        return (
            target.closest("[data-call-menu-root]") || target.closest(".fixed")
        );
    }

    async function handleParentKeydown(
        e: KeyboardEvent,
        section: SubmenuSection,
    ): Promise<void> {
        const key = e.key;
        if (key === "ArrowRight" || key === "ArrowDown") {
            e.preventDefault();
            // Capture the row element BEFORE awaiting: e.currentTarget is null
            // once dispatch finishes, so reading it after `tick()` would throw
            // and the focus-into-submenu would silently never happen.
            const rowEl = e.currentTarget as HTMLElement;
            openSection = section;
            await tick();
            const root = getMenuRoot(rowEl);
            if (root) {
                const first = root.querySelector<HTMLElement>(
                    `[data-submenu-device="${section}"]`,
                );
                first?.focus();
            }
        } else if (key === "ArrowLeft") {
            e.preventDefault();
            openSection = null;
        }
    }

    async function handleDeviceKeydown(
        e: KeyboardEvent,
        section: SubmenuSection,
    ): Promise<void> {
        const key = e.key;
        const root = getMenuRoot(e.currentTarget as HTMLElement);
        if (!root) return;

        if (key === "ArrowDown" || key === "ArrowUp") {
            e.preventDefault();
            const devices = Array.from(
                root.querySelectorAll<HTMLElement>(
                    `[data-submenu-device="${section}"]`,
                ),
            );
            const current = devices.indexOf(e.currentTarget as HTMLElement);
            if (current === -1) return;
            const next =
                key === "ArrowDown"
                    ? Math.min(current + 1, devices.length - 1)
                    : Math.max(current - 1, 0);
            devices[next]?.focus();
        } else if (key === "ArrowLeft") {
            e.preventDefault();
            openSection = null;
            await tick();
            const parent = root.querySelector<HTMLElement>(
                `[data-submenu-parent="${section}"]`,
            );
            parent?.focus();
        }
    }

    // Same viewport-clamping action the room/space context menus use.
    function positionMenu(node: HTMLElement, pos: { x: number; y: number }) {
        let raf = 0;
        // Re-run on `update` too: a context menu reopened on a NEW target while
        // one is already open can reuse this same node (Svelte keeps the block),
        // so mount-only positioning would strand the menu at the old target's
        // coordinates. Reset maxHeight each time so a prior clamp doesn't leak.
        function place(p: { x: number; y: number }) {
            node.style.visibility = "hidden";
            node.style.left = "0px";
            node.style.top = "0px";
            node.style.maxHeight = "";
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const w = node.offsetWidth;
                const h = node.offsetHeight;
                let left = Math.min(p.x, vw - w - 4);
                if (left < 4) left = 4;
                let top = p.y;
                if (top + h > vh - 4) top = p.y - h;
                if (top < 4) top = 4;
                const maxH = vh - top - 4;
                if (h > maxH) node.style.maxHeight = maxH + "px";
                node.style.left = left + "px";
                node.style.top = top + "px";
                node.style.visibility = "";
            });
        }
        place(pos);
        return {
            update(next: { x: number; y: number }) {
                place(next);
            },
            destroy() {
                cancelAnimationFrame(raf);
            },
        };
    }

    // Which act() is in flight, so the menu can disable itself and say so —
    // same idiom as UserProfileCard's `pending`. The menu only closes once the
    // action settles, and creating a DM now waits for the new room to reach the
    // SDK store (up to 15s), so an unguarded second click would run the action
    // twice: two concurrent createDirectMessage calls can both miss the
    // existing-DM check and leave the user with two DM rooms for one contact.
    type MenuAction = "message" | "block" | "kick" | "ban";
    let pending = $state<MenuAction | null>(null);
    // Which moderation action is armed for confirmation — mirrors
    // UserProfileCard's `confirming` flow (UX-07).
    let confirming = $state<"kick" | "ban" | null>(null);

    // Reset confirming state when the open menu is retargeted to a different
    // participant (the host can swap userId without remounting), so an armed
    // Kick/Ban never carries over to someone else.
    $effect(() => {
        void userId;
        confirming = null;
    });

    // `fallback` may be a thunk so it can read live derived state (e.g. `name`)
    // at failure time rather than capturing it when the handler is built.
    function act(
        id: MenuAction,
        fn: () => Promise<unknown>,
        fallback: string | (() => string),
    ) {
        return async () => {
            // Belt-and-braces with the disabled attribute: this closes the
            // window before Svelte has flushed `pending` to the DOM.
            if (pending !== null) return;
            pending = id;
            try {
                await fn();
            } catch (err) {
                const msg =
                    typeof fallback === "function" ? fallback() : fallback;
                showErrorToast(matrixErrorMessage(err, msg));
            } finally {
                pending = null;
                onClose();
            }
        };
    }

    // A created room whose follow-up write failed (or timed out unconfirmed):
    // the room is real, so we open it and offer a retry of ONLY the failed
    // step. Reporting a failure here would send the user back to the form to
    // create a duplicate (TX-01).
    function surfaceFollowUp(followUp: RoomFollowUp) {
        // Deliberately silent on success — this store is an ERROR surface (red,
        // role="alert"), and a landed follow-up is already visible without it:
        // the DM moves into the DM list.
        if (followUp.status === "none" || followUp.status === "ok") return;
        const task = followUp.task;
        showErrorToast(followUp.message, {
            label: "Retry",
            // retryRoomFollowUp is bounded, so a retry into a wedged sync comes
            // back as its own "unconfirmed" toast instead of hanging forever
            // with the affordance already expired.
            run: () => void retryRoomFollowUp(task).then(surfaceFollowUp),
        });
    }

    // Open the card BEFORE closing the menu: openProfileCard() measures the
    // anchor's rect, and onClose() unmounts this menu (and its Portal), which
    // would detach the anchor and zero the rect. Ordering is safe because our
    // onClose releases the slot with clearModalIfOwner (a stale-token no-op once
    // the card owns the modal), so it can't shut the freshly-opened card.
    const onProfile = (e: MouseEvent) => {
        const anchor = e.currentTarget as HTMLElement;
        openProfileCard(userId, anchor);
        onClose();
    };
    const onMessage = act(
        "message",
        async () => {
            const wantEncrypted = shouldEncryptNewDm({
                cryptoReady: isCryptoAvailable(),
                setting: settingsState.encryptNewDms,
            });
            const { roomId, followUp } = await createDirectMessage(
                userId,
                wantEncrypted,
            );
            surfaceFollowUp(followUp);
            if (
                shouldWarnPlaintextDmReuse({
                    followUpStatus: followUp.status,
                    wantEncrypted,
                    roomEncrypted: isRoomEncrypted(getRoom(roomId)),
                })
            ) {
                showErrorToast(PLAINTEXT_DM_REUSE_WARNING);
            }
            setActiveRoom(roomId);
        },
        "Could not open a direct message",
    );
    const onToggleBlock = act(
        "block",
        async () => (blocked ? unblockUser(userId) : blockUser(userId)),
        "Could not update the block list",
    );
    // Kick and ban use two-step confirmation: first click arms `confirming`,
    // second click runs the action. Arming one clears the other.
    async function onKick() {
        if (confirming !== "kick") {
            confirming = "kick";
            return;
        }
        await act(
            "kick",
            () => kickUser(room.roomId, userId),
            () => `Could not kick ${name}`,
        )();
    }
    async function onBan() {
        if (confirming !== "ban") {
            confirming = "ban";
            return;
        }
        await act(
            "ban",
            () => banUser(room.roomId, userId),
            () => `Could not ban ${name}`,
        )();
    }
    const onMention = () => {
        const ctx = { roomId: room.roomId, userId };
        hostBridge.pendingMention = ctx;
        setActiveRoom(room.roomId);
        showChatView();
        // If a composer for this room is already mounted (menu opened from the room
        // list while its chat is showing), insert immediately; the handler clears
        // the queue on success and self-guards on roomId, so this never double-inserts.
        hostBridge.insertMention?.(ctx);
        onClose();
    };
</script>

{#snippet menuItems()}
    <button
        onclick={onProfile}
        class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors"
        >Profile</button
    >
    {#if isSelf}
        <div class="w-full h-px bg-discord-divider my-1"></div>

        <!-- Input (Microphone) accordion -->
        <button
            onclick={() => (openSection = toggleSubmenu(openSection, "input"))}
            onmouseenter={touch ? undefined : () => (openSection = "input")}
            onkeydown={(e) => handleParentKeydown(e, "input")}
            aria-expanded={openSection === "input"}
            data-submenu-parent="input"
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2"
        >
            <ChevronRight
                size={14}
                class="transition-transform flex-shrink-0 {openSection ===
                'input'
                    ? 'rotate-90'
                    : ''}"
            />
            <span class="flex-shrink-0">Input</span>
            <span class="text-xs text-discord-textMuted truncate ml-auto">
                {activeDeviceLabel(mics, settingsState.audioInputDeviceId)}
            </span>
        </button>
        {#if openSection === "input"}
            <button
                onclick={() => pickMic(null)}
                onkeydown={(e) => handleDeviceKeydown(e, "input")}
                aria-pressed={!settingsState.audioInputDeviceId}
                data-submenu-device="input"
                class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2 pl-6"
            >
                <span class="w-3 flex items-center justify-center">
                    {#if !settingsState.audioInputDeviceId}<Circle
                            size={8}
                            fill="currentColor"
                        />{/if}
                </span>
                Default
            </button>
            {#each mics as m (m.id)}
                <button
                    onclick={() => pickMic(m.id)}
                    onkeydown={(e) => handleDeviceKeydown(e, "input")}
                    aria-pressed={settingsState.audioInputDeviceId === m.id}
                    data-submenu-device="input"
                    class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2 pl-6"
                >
                    <span class="w-3 flex items-center justify-center">
                        {#if settingsState.audioInputDeviceId === m.id}<Circle
                                size={8}
                                fill="currentColor"
                            />{/if}
                    </span>
                    <span class="truncate">{m.label}</span>
                </button>
            {/each}
        {/if}

        <div class="w-full h-px bg-discord-divider my-1"></div>

        <!-- Output (Speaker) accordion -->
        <button
            onclick={() => (openSection = toggleSubmenu(openSection, "output"))}
            onmouseenter={touch ? undefined : () => (openSection = "output")}
            onkeydown={(e) => handleParentKeydown(e, "output")}
            aria-expanded={openSection === "output"}
            data-submenu-parent="output"
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2"
        >
            <ChevronRight
                size={14}
                class="transition-transform flex-shrink-0 {openSection ===
                'output'
                    ? 'rotate-90'
                    : ''}"
            />
            <span class="flex-shrink-0">Output</span>
            <span class="text-xs text-discord-textMuted truncate ml-auto">
                {activeDeviceLabel(speakers, settingsState.audioOutputDeviceId)}
            </span>
        </button>
        {#if openSection === "output"}
            <button
                onclick={() => pickSpeaker(null)}
                onkeydown={(e) => handleDeviceKeydown(e, "output")}
                aria-pressed={!settingsState.audioOutputDeviceId}
                data-submenu-device="output"
                class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2 pl-6"
            >
                <span class="w-3 flex items-center justify-center">
                    {#if !settingsState.audioOutputDeviceId}<Circle
                            size={8}
                            fill="currentColor"
                        />{/if}
                </span>
                Default
            </button>
            {#each speakers as s (s.id)}
                <button
                    onclick={() => pickSpeaker(s.id)}
                    onkeydown={(e) => handleDeviceKeydown(e, "output")}
                    aria-pressed={settingsState.audioOutputDeviceId === s.id}
                    data-submenu-device="output"
                    class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2 pl-6"
                >
                    <span class="w-3 flex items-center justify-center">
                        {#if settingsState.audioOutputDeviceId === s.id}<Circle
                                size={8}
                                fill="currentColor"
                            />{/if}
                    </span>
                    <span class="truncate">{s.label}</span>
                </button>
            {/each}
        {/if}
    {/if}
    {#if !isSelf}
        <button
            onclick={onMessage}
            disabled={pending !== null}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors disabled:opacity-50"
            >{pending === "message" ? "Opening…" : "Message"}</button
        >
        <button
            onclick={onMention}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors"
            >Mention</button
        >

        <div class="w-full h-px bg-discord-divider my-1"></div>

        <div class="px-3 py-1.5">
            <div class="flex items-center justify-between gap-2">
                <label
                    for="user-volume-{userId}"
                    class="text-xs text-discord-textMuted uppercase font-semibold tracking-wide"
                >
                    User Volume
                </label>
                <span
                    class="text-xs text-discord-textMuted tabular-nums flex-shrink-0"
                >
                    {Math.round(audio.volume * 100)}%
                </span>
            </div>
            <input
                id="user-volume-{userId}"
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(audio.volume * 100)}
                oninput={(e) =>
                    setUserVolume(userId, e.currentTarget.valueAsNumber / 100)}
                class="w-full mt-1.5 accent-discord-accent"
            />
        </div>
        <button
            onclick={() => setUserLocalMute(userId, !audio.muted)}
            aria-pressed={audio.muted}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2"
        >
            <span class="w-3 flex items-center justify-center">
                {#if audio.muted}<Circle size={8} fill="currentColor" />{/if}
            </span>
            Mute
        </button>
        <button
            onclick={() => setUserVideoHidden(userId, !audio.videoHidden)}
            aria-pressed={audio.videoHidden}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2"
        >
            <span class="w-3 flex items-center justify-center">
                {#if audio.videoHidden}<Circle
                        size={8}
                        fill="currentColor"
                    />{/if}
            </span>
            Hide video
        </button>

        <div class="w-full h-px bg-discord-divider my-1"></div>

        <button
            onclick={onToggleBlock}
            disabled={pending !== null}
            class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors disabled:opacity-50"
            >{pending === "block"
                ? "Saving…"
                : blocked
                  ? "Unblock"
                  : "Block"}</button
        >

        {#if gates.canKick || gates.canBan}
            <div class="w-full h-px bg-discord-divider my-1"></div>
        {/if}
        {#if gates.canKick}
            <button
                onclick={onKick}
                disabled={pending !== null}
                class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors truncate disabled:opacity-50"
                >{pending === "kick"
                    ? "Kicking…"
                    : confirming === "kick"
                      ? `Confirm kick ${name}?`
                      : `Kick ${name} from room`}</button
            >
        {/if}
        {#if gates.canBan}
            <button
                onclick={onBan}
                disabled={pending !== null}
                class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors truncate disabled:opacity-50"
                >{pending === "ban"
                    ? "Banning…"
                    : confirming === "ban"
                      ? `Confirm ban ${name}?`
                      : `Ban ${name}`}</button
            >
        {/if}
    {/if}
{/snippet}

<Portal>
    {#if touch}
        <button
            type="button"
            aria-label="Close menu"
            class="fixed inset-0 z-50 bg-black/40"
            onclick={onClose}
        ></button>
    {/if}

    {#if touch}
        <BottomSheet {onClose}>
            {@render menuItems()}
        </BottomSheet>
    {:else}
        <div
            use:positionMenu={{ x, y }}
            use:focusTrap={{ onEscape: onClose }}
            use:dismissOnOutsidePointer={{ onDismiss: onClose }}
            data-call-menu-root
            class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-44 max-w-56 overflow-y-auto"
        >
            {@render menuItems()}
        </div>
    {/if}
</Portal>
