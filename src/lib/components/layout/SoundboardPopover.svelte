<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import { scale } from "svelte/transition";
    import { motionOK } from "$lib/utils/motionPreference";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { dismissOnOutsidePointer } from "$lib/actions/dismissOnOutsidePointer";
    import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";
    import { getAvailableSoundPacks } from "$lib/matrix/soundboard";
    import { playSoundboardSound } from "$lib/matrix/client";
    import { auth } from "$lib/stores/auth.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        participantAudioFor,
        setUserSoundVolume,
    } from "$lib/stores/voiceCall.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import { MAX_SOUND_VOLUME, type Sound } from "$lib/utils/soundboard";

    interface Props {
        room: Room;
        x: number;
        y: number;
        touch?: boolean;
        onClose: () => void;
    }
    let { room, x, y, touch = false, onClose }: Props = $props();

    const packs = $derived.by(() => {
        void roomsState.roomsTick;
        return getAvailableSoundPacks(room);
    });
    const myId = $derived(auth.userId ?? "");
    const myLevel = $derived.by(() => {
        void settingsState.participantAudio;
        return participantAudioFor(myId).soundVolume;
    });
    let failed = $state(false);

    onMount(() => {
        const token = openModal("soundboard", onClose);
        return () => {
            clearModalIfOwner(token);
        };
    });

    async function play(sound: Sound) {
        failed = !(await playSoundboardSound(sound));
    }

    // Same placement as ScreenShareQualityPopover: clamp into the viewport and
    // flip up when the anchor sits near the bottom edge.
    function positionMenu(node: HTMLElement, pos: { x: number; y: number }) {
        let raf = 0;
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
</script>

{#snippet body()}
    <div class="space-y-3">
        <div>
            <div class="flex items-center justify-between gap-2">
                <label
                    for="soundboard-own-volume"
                    class="text-xs text-discord-textMuted uppercase font-semibold tracking-wide"
                >
                    {t("soundboard.yourVolume")}
                </label>
                <span class="text-xs text-discord-textMuted tabular-nums">
                    {Math.round(myLevel * 100)}%
                </span>
            </div>
            <input
                id="soundboard-own-volume"
                type="range"
                min="0"
                max={MAX_SOUND_VOLUME * 100}
                step="1"
                value={Math.round(myLevel * 100)}
                oninput={(e) =>
                    setUserSoundVolume(
                        myId,
                        e.currentTarget.valueAsNumber / 100,
                    )}
                class="w-full mt-1.5 accent-discord-accent"
            />
        </div>
        {#if failed}
            <p class="text-xs text-discord-danger">
                {t("soundboard.sendFailed")}
            </p>
        {/if}
        {#each packs as pack (pack.id)}
            <section class="space-y-1.5">
                <h3
                    class="text-xs text-discord-textMuted uppercase font-semibold tracking-wide truncate"
                >
                    {pack.name}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                    {#each pack.sounds as sound (sound.name)}
                        <button
                            type="button"
                            onclick={() => play(sound)}
                            title={sound.name}
                            class="max-w-full truncate px-3 py-1.5 rounded bg-discord-backgroundSecondary hover:bg-discord-accent hover:text-white text-sm text-discord-textPrimary transition-colors"
                        >
                            {sound.name}
                        </button>
                    {/each}
                </div>
            </section>
        {/each}
        {#if packs.length === 0}
            <p class="text-sm text-discord-textMuted">
                {t("soundboard.empty")}
            </p>
        {/if}
    </div>
{/snippet}

<Portal>
    {#if touch}
        <button
            type="button"
            aria-label={t("common.close")}
            class="fixed inset-0 z-50 bg-black/40"
            onclick={onClose}
        ></button>
        <BottomSheet {onClose}>
            <div class="p-4">{@render body()}</div>
        </BottomSheet>
    {:else}
        <div
            use:positionMenu={{ x, y }}
            use:focusTrap={{ onEscape: onClose }}
            use:dismissOnOutsidePointer={{ onDismiss: onClose }}
            in:scale|global={{
                start: 0.92,
                opacity: 0,
                duration: motionOK() ? 120 : 0,
            }}
            class="fixed z-50 w-80 rounded-lg bg-discord-backgroundTertiary border border-discord-divider shadow-xl p-3 overflow-y-auto"
            role="dialog"
            aria-label={t("soundboard.title")}
        >
            {@render body()}
        </div>
    {/if}
</Portal>
