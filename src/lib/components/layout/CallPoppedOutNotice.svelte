<script lang="ts">
    import { t } from "$lib/i18n";
    import { ExternalLink } from "lucide-svelte";
    import {
        closeCallPopout,
        focusCallPopout,
    } from "$lib/stores/callPopout.svelte";
</script>

<div
    data-zam-region="call"
    class="flex-1 flex flex-col items-center justify-center gap-4 p-6 min-w-0 bg-zam-backgroundTertiary text-center"
>
    <ExternalLink size={32} class="text-zam-textMuted" />
    <p class="text-zam-textSecondary">{t("callPopout.inOtherWindow")}</p>
    <div class="flex flex-wrap items-center justify-center gap-2">
        <button
            onclick={closeCallPopout}
            class="px-4 py-2 rounded bg-zam-accent text-white hover:opacity-90 transition-opacity"
        >
            {t("callPopout.bringBack")}
        </button>
        <button
            onclick={focusCallPopout}
            class="px-4 py-2 rounded bg-zam-backgroundSecondary text-zam-textPrimary hover:bg-zam-messageHover transition-colors"
        >
            {t("callPopout.focusWindow")}
        </button>
    </div>
</div>
