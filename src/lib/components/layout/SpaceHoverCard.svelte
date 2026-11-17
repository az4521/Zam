<script lang="ts">
    import { t } from "$lib/i18n";
    import { Volume2 } from "lucide-svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        countVoiceParticipants,
        VOICE_CARD_PREVIEW_COUNT,
        type SpaceVoiceSummary,
    } from "$lib/utils/spaceVoice";

    interface Props {
        /** The icon the card is pointing at. */
        anchor: HTMLElement;
        name: string;
        /** Read inside a $derived so the card follows live call changes. */
        getVoice: () => SpaceVoiceSummary;
    }

    let { anchor, name, getVoice }: Props = $props();

    const voice = $derived(getVoice());
    const count = $derived(countVoiceParticipants(voice));

    // Position beside the icon, vertically centred on it and clamped to the
    // viewport. In RTL the rail sits on the right, so the card opens leftward.
    // The notch is nudged to keep pointing at the icon when the card clamps.
    let cardEl = $state<HTMLElement>();
    // Re-placed whenever the contents change (someone joins or leaves while
    // the card is open, or it is reused for another icon), since the card's
    // height moves its centre.
    $effect(() => {
        void voice;
        void name;
        if (cardEl) place(cardEl, anchor);
    });

    function place(node: HTMLElement, anchorEl: HTMLElement) {
        const r = anchorEl.getBoundingClientRect();
        const rtl = getComputedStyle(anchorEl).direction === "rtl";
        const h = node.offsetHeight;
        const centreY = r.top + r.height / 2;
        const top = Math.max(
            8,
            Math.min(centreY - h / 2, window.innerHeight - h - 8),
        );
        node.style.top = `${top}px`;
        if (rtl) {
            node.style.left = "auto";
            node.style.right = `${window.innerWidth - r.left + 12}px`;
        } else {
            node.style.right = "auto";
            node.style.left = `${r.right + 12}px`;
        }
        const notch = node.querySelector<HTMLElement>("[data-notch]");
        if (notch) {
            notch.style.top = `${centreY - top - 6}px`;
            if (rtl) {
                notch.style.left = "auto";
                notch.style.right = "-4px";
            } else {
                notch.style.right = "auto";
                notch.style.left = "-4px";
            }
        }
    }
</script>

<div
    bind:this={cardEl}
    aria-hidden="true"
    class="fixed z-[60] pointer-events-none min-w-44 max-w-64 max-h-[calc(100vh-16px)] overflow-hidden bg-[#18191c] text-white rounded-md shadow-2xl px-3 py-2"
>
    <div data-notch class="absolute w-2.5 h-2.5 rotate-45 bg-[#18191c]"></div>

    <p class="text-sm font-semibold truncate">{name}</p>

    {#if voice.active}
        <p class="text-xs text-zam-textMuted mt-0.5">
            {t("spaceSidebar.inVoiceCount", { count })}
        </p>

        {#each voice.rooms as room (room.roomId)}
            {@const shown = room.participants.slice(
                0,
                VOICE_CARD_PREVIEW_COUNT,
            )}
            {@const extra = room.participants.length - shown.length}
            <div class="mt-2">
                <div class="flex items-center gap-1.5 min-w-0">
                    <Volume2
                        size={12}
                        class="flex-shrink-0 text-zam-textMuted"
                    />
                    <span class="text-xs font-medium truncate">{room.name}</span
                    >
                </div>
                <ul class="mt-1 flex flex-col gap-1 ps-4">
                    {#each shown as p (p.userId)}
                        <li class="flex items-center gap-1.5 min-w-0">
                            <Avatar
                                src={p.avatar}
                                name={p.name}
                                id={p.userId}
                                size={20}
                            />
                            <span
                                class="text-xs text-zam-textSecondary truncate min-w-0"
                            >
                                {p.name}
                            </span>
                            {#if p.live}
                                <span
                                    class="ms-auto flex-shrink-0 h-3.5 px-1 rounded-sm bg-zam-danger text-white text-[9px] font-bold leading-[14px] tracking-wide"
                                >
                                    {t("spaceSidebar.liveBadge")}
                                </span>
                            {/if}
                        </li>
                    {/each}
                    {#if extra > 0}
                        <li class="text-xs text-zam-textMuted ps-7">
                            {t("spaceSidebar.moreParticipants", {
                                count: extra,
                            })}
                        </li>
                    {/if}
                </ul>
            </div>
        {/each}
    {/if}
</div>
