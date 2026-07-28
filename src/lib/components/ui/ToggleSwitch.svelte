<script lang="ts">
    interface Props {
        checked: boolean;
        onChange: (checked: boolean) => void;
        label: string;
        title?: string;
    }

    let { checked, onChange, label, title }: Props = $props();
</script>

<button
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={checked}
    onclick={() => onChange(!checked)}
    class="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors {checked
        ? 'bg-discord-accent'
        : 'bg-discord-backgroundTertiary'}"
    {title}
>
    <span
        class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform {checked
            ? 'bg-white translate-x-5'
            : 'bg-discord-textPrimary'}"
    ></span>
</button>
