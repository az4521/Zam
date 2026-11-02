<script lang="ts">
    import {
        resolveEventFavouriteUrl,
        type EventFavouriteSource,
    } from "$lib/matrix/favouriteFile";

    interface Props {
        source: EventFavouriteSource;
        class?: string;
        style?: string;
    }

    let { source, class: className = "", style }: Props = $props();

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

<img src={src ?? undefined} alt="" class={className} {style} decoding="async" />
