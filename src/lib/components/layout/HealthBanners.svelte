<script lang="ts">
    // The device-health banners, stacked at the top of the window: out of
    // (or low on) storage first, then encryption being off. Mounted at the
    // root page so it covers the login and splash views too: storage can
    // run out before the app shell ever shows.
    import StorageBanner from "$lib/components/layout/StorageBanner.svelte";
    import CryptoUnavailableBanner from "$lib/components/layout/CryptoUnavailableBanner.svelte";
</script>

<div
    class="pointer-events-none fixed top-4 left-1/2 z-50 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 [&>*]:pointer-events-auto"
>
    <StorageBanner />
    <CryptoUnavailableBanner />
</div>
