<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    // The app is now a single auth-gated route at "/". This stub forwards any
    // stale bookmark, cached PWA start_url, or old deep-link that still targets
    // the old /app path to the merged route. replaceState so Back doesn't bounce
    // here.
    onMount(() => {
        goto("/", { replaceState: true });
    });
</script>

<div
    class="flex items-center justify-center bg-discord-backgroundTertiary"
    style="min-height: 100dvh;"
>
    <div class="flex items-center gap-3 text-discord-textMuted">
        <div
            class="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
        ></div>
        <span>Redirecting…</span>
    </div>
</div>
