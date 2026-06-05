<script lang="ts">
    import { getAvatarColor, getAvatarInitials } from "$lib/utils/colors";

    interface Props {
        src?: string | null;
        name?: string;
        id?: string | null;
        size?: number;
        rounded?: "full" | "lg" | "md" | "xl" | "2xl" | "none";
        class?: string;
    }

    let {
        src = null,
        name = "?",
        id = null,
        size = 40,
        rounded = "full",
        class: extraClass = "",
    }: Props = $props();

    const resolvedSrc = $derived(src ?? null);
    const initials = $derived(getAvatarInitials(name));
    const bgColor = $derived(getAvatarColor(id ?? name));

    const roundedClass = $derived(() => {
        if (rounded === "none") return "";
        if (rounded === "full") return "rounded-full";
        if (rounded === "2xl") return "rounded-2xl";
        if (rounded === "xl") return "rounded-xl";
        if (rounded === "lg") return "rounded-lg";
        return "rounded-md";
    });
</script>

<div
    class="flex-shrink-0 flex items-center justify-center overflow-hidden {roundedClass()} {extraClass}"
    style="width: {size}px; height: {size}px; background-color: {resolvedSrc
        ? 'transparent'
        : bgColor};"
>
    {#if resolvedSrc}
        <img
            src={resolvedSrc}
            alt={name}
            class="w-full h-full object-cover {roundedClass()}"
        />
    {:else}
        <span
            class="text-white font-semibold select-none"
            style="font-size: {size * 0.4}px;"
        >
            {initials}
        </span>
    {/if}
</div>
