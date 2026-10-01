<script lang="ts" generics="T extends string">
    interface SelectorOption {
        value: T;
        label: string;
        title?: string;
        disabled?: boolean;
    }

    interface Props {
        value: T;
        options: readonly SelectorOption[];
        onChange: (value: T) => void;
        ariaLabel: string;
    }

    let { value, options, onChange, ariaLabel }: Props = $props();
</script>

<div class="flex gap-1 flex-shrink-0" role="group" aria-label={ariaLabel}>
    {#each options as option (option.value)}
        <button
            type="button"
            onclick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            title={option.title}
            disabled={option.disabled}
            class="px-2.5 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            class:bg-discord-accent={value === option.value}
            class:text-white={value === option.value}
            class:bg-discord-backgroundTertiary={value !== option.value}
            class:text-discord-textMuted={value !== option.value}
            class:hover:bg-discord-messageHover={value !== option.value &&
                !option.disabled}
        >
            {option.label}
        </button>
    {/each}
</div>
