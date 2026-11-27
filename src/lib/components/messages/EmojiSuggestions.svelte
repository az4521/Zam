<script lang="ts">
    // The `:shortcode` suggestion list, shared by the composer and the inline
    // message editor. Keyboard navigation lives with the owning input.
    import { t } from "$lib/i18n";
    import { USER_EMOJI_SOURCE, mxcToHttp } from "$lib/matrix/client";
    import { spriteFor } from "$lib/matrix/packSheets";
    import { packSheetsState } from "$lib/stores/packSheets.svelte";
    import { suppressNextClick } from "$lib/utils/suppressNextClick";
    import type { EmojiCandidate } from "$lib/utils/emojiAutocomplete";

    /** The pack sprite for a suggested emote. Reading the tick makes the row
     *  re-draw when its sheet loads. */
    function suggestionSprite(mxc: string) {
        void packSheetsState.tick;
        return spriteFor("emoji", mxc);
    }

    let {
        candidates,
        selectedIdx = $bindable(0),
        onPick,
        class: className = "",
    }: {
        candidates: EmojiCandidate[];
        selectedIdx?: number;
        onPick: (candidate: EmojiCandidate) => void;
        class?: string;
    } = $props();
</script>

<div
    class="bg-zam-backgroundSecondary border border-zam-divider rounded-lg overflow-hidden shadow-lg {className}"
>
    {#each candidates as candidate, i}
        <button
            onpointerdown={(e) => {
                e.preventDefault();
                // Swallow the trailing click so it can't open a link behind
                // the unmounted list.
                suppressNextClick();
                onPick(candidate);
            }}
            onpointerenter={() => (selectedIdx = i)}
            class="w-full flex items-center gap-2.5 px-3 py-1.5 text-start transition-colors"
            class:bg-zam-messageHover={i === selectedIdx}
        >
            {#if candidate.kind === "unicode"}
                <span class="text-xl w-6 text-center flex-shrink-0"
                    >{candidate.emoji}</span
                >
                <span class="text-sm text-zam-textPrimary truncate"
                    >:{candidate.name}:</span
                >
                <span class="text-xs text-zam-textMuted">{candidate.emoji}</span
                >
            {:else}
                {@const sprite = candidate.mxcUrl
                    ? suggestionSprite(candidate.mxcUrl)
                    : null}
                {#if sprite && !sprite.animated}
                    <span
                        class="w-6 h-6 block flex-shrink-0"
                        style={sprite.style}
                        role="img"
                        aria-label={candidate.shortcode}
                    ></span>
                {:else}
                    <img
                        src={candidate.mxcUrl
                            ? (mxcToHttp(candidate.mxcUrl, 96, 96, "scale") ??
                              candidate.url)
                            : candidate.url}
                        alt={candidate.shortcode}
                        class="w-6 h-6 object-contain flex-shrink-0"
                    />
                {/if}
                <span class="text-sm text-zam-textPrimary truncate"
                    >:{candidate.shortcode}:</span
                >
                <span
                    class="ms-auto ps-2 text-xs text-zam-textMuted truncate max-w-[50%]"
                    >{candidate.source === USER_EMOJI_SOURCE
                        ? t("messageInput.yourEmotes")
                        : (candidate.source ?? t("messageInput.custom"))}</span
                >
            {/if}
        </button>
    {/each}
</div>
