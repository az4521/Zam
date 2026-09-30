<script lang="ts">
    import { t } from "$lib/i18n";
    import FlashEmbed from "./FlashEmbed.svelte";

    interface Props {
        getSrc: () => Promise<string>;
    }

    let { getSrc }: Props = $props();

    let src = $state<string | null>(null);
    let loading = $state(false);

    async function activate() {
        if (src || loading) return;
        loading = true;
        try {
            src = await getSrc();
        } catch (e) {
            console.error("Failed to load SWF:", e);
        } finally {
            loading = false;
        }
    }
</script>

{#if src}
    <FlashEmbed {src} />
{:else}
    <button
        onclick={activate}
        class="flex items-center gap-3 mt-1 w-full max-w-sm aspect-video rounded-lg bg-black/80 hover:bg-black/60 transition-colors justify-center flex-col"
        disabled={loading}
    >
        {#if loading}
            <div
                class="w-8 h-8 border-2 border-white/60 border-t-transparent rounded-full animate-spin"
            ></div>
            <span class="text-white/60 text-xs">{t("common.loading")}</span>
        {:else}
            <svg
                class="w-12 h-12 text-white/80"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path d="M8 5v14l11-7z" />
            </svg>
            <span class="text-white/60 text-xs font-medium"
                >{t("swfEmbed.adobeFlash")}</span
            >
        {/if}
    </button>
{/if}
