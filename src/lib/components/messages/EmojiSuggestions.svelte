<script lang="ts">
    // The `:shortcode` suggestion list, shared by the composer and the inline
    // message editor. Keyboard navigation lives with the owning input.
    import { t } from "$lib/i18n";
    import { USER_EMOJI_SOURCE } from "$lib/matrix/client";
    import { suppressNextClick } from "$lib/utils/suppressNextClick";
    import type { EmojiCandidate } from "$lib/utils/emojiAutocomplete";

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
    class="bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg {className}"
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
            class:bg-discord-messageHover={i === selectedIdx}
        >
            {#if candidate.kind === "unicode"}
                <span class="text-xl w-6 text-center flex-shrink-0"
                    >{candidate.emoji}</span
                >
                <span class="text-sm text-discord-textPrimary truncate"
                    >:{candidate.name}:</span
                >
                <span class="text-xs text-discord-textMuted"
                    >{candidate.emoji}</span
                >
            {:else}
                <img
                    src={candidate.url}
                    alt={candidate.shortcode}
                    class="w-6 h-6 object-contain flex-shrink-0"
                />
                <span class="text-sm text-discord-textPrimary truncate"
                    >:{candidate.shortcode}:</span
                >
                <span
                    class="ms-auto ps-2 text-xs text-discord-textMuted truncate max-w-[50%]"
                    >{candidate.source === USER_EMOJI_SOURCE
                        ? t("messageInput.yourEmotes")
                        : (candidate.source ?? t("messageInput.custom"))}</span
                >
            {/if}
        </button>
    {/each}
</div>
