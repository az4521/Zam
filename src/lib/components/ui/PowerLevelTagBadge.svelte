<script lang="ts">
    import { mxcToHttp } from "$lib/matrix/client";
    import {
        createMediaRetry,
        isAuthedMediaUrl,
        thumbnailUrl,
    } from "$lib/stores/mediaAuth.svelte";
    import {
        isMxcIcon,
        safeTagColor,
        type PowerLevelTag,
    } from "$lib/utils/powerLevelTags";

    interface Props {
        tag: PowerLevelTag;
        showName?: boolean;
        size?: "sm" | "md";
    }

    let { tag, showName = true, size = "sm" }: Props = $props();

    const iconPx = $derived(size === "md" ? 18 : 14);
    const color = $derived(safeTagColor(tag.color));
    const icon = $derived(tag.icon);
    const isImage = $derived(isMxcIcon(icon));

    // An image icon loads over authenticated media like Avatar does, so it
    // uses the same thumbnail and retry path.
    const iconSrc = $derived.by((): string | null => {
        if (!icon || !isImage) return null;
        const src = mxcToHttp(icon.key, iconPx * 2, iconPx * 2, "crop");
        if (!src) return null;
        return isAuthedMediaUrl(src)
            ? thumbnailUrl(src, iconPx * 2, iconPx * 2, "crop")
            : src;
    });
    const imgRetry = createMediaRetry(
        () => iconSrc,
        () => icon?.info?.mimetype as string | undefined,
    );
    const showImage = $derived(
        !!imgRetry.src && !imgRetry.failed && !imgRetry.pending,
    );
</script>

<span
    class="inline-flex items-center gap-1 min-w-0 align-middle"
    style:color
    title={tag.name}
    data-power-level-tag
>
    {#if icon}
        {#if isImage}
            {#if showImage}
                <img
                    src={imgRetry.src}
                    alt={tag.name}
                    class="flex-shrink-0 rounded-sm object-cover"
                    style="width: {iconPx}px; height: {iconPx}px;"
                    data-own-retry
                    onerror={imgRetry.onError}
                />
            {/if}
        {:else}
            <span
                class="flex-shrink-0 leading-none select-none"
                style="font-size: {iconPx}px;"
                aria-hidden={showName ? "true" : undefined}
                role={showName ? undefined : "img"}
                aria-label={showName ? undefined : tag.name}>{icon.key}</span
            >
        {/if}
    {/if}
    {#if showName}
        <span class="truncate font-medium">{tag.name}</span>
    {/if}
</span>
