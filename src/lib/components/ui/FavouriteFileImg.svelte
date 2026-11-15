<script lang="ts">
    import {
        resolveEventFavouriteUrl,
        type EventFavouriteSource,
    } from "$lib/matrix/favouriteFile";

    interface Props {
        source: EventFavouriteSource;
        class?: string;
        style?: string;
        /** The favourite is a video: shown as a muted looping clip. */
        video?: boolean;
    }

    let {
        source,
        class: className = "",
        style,
        video = false,
    }: Props = $props();

    let src = $state<string | null>(null);

    $effect(() => {
        const s = source;
        let live = true;
        src = null;
        void resolveEventFavouriteUrl(s).then((u) => {
            if (live) src = u;
        });
        return () => {
            live = false;
        };
    });
</script>

{#if video}
    <video
        src={src ?? undefined}
        class={className}
        {style}
        autoplay
        muted
        loop
        playsinline
        disablepictureinpicture
        aria-hidden="true"
    ></video>
{:else}
    <img
        src={src ?? undefined}
        alt=""
        class={className}
        {style}
        decoding="async"
    />
{/if}
