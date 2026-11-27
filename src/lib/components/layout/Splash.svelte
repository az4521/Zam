<script lang="ts">
    import { t } from "$lib/i18n";
    import SkeletonRows from "$lib/components/ui/SkeletonRows.svelte";
    // Shown while a stored session is being silently restored. With a session
    // on this device (`quiet`) it is app-shaped blocks, so the restore looks
    // like the app already being there. Without one (a fresh install checking
    // for a backup) or with a message to show, it is a spinner on the login
    // card's tertiary background, so no login-card flash follows.
    //
    // The spinner keeps turning under reduced motion (app.css carves out
    // .animate-spin on purpose: a still spinner looks like a hung app).
    // Whole icons and rows only, so nothing is cut off at the bottom: the rail
    // fills about half the height (48px icons, 8px gaps, one extra gap after
    // the first), the room list about 80% (32px rows under a 56px header gap).
    const height = typeof window === "undefined" ? 800 : window.innerHeight;
    const railCount = Math.max(1, Math.floor((height * 0.5 - 12 - 8 + 8) / 56));
    const roomRows = Math.max(1, Math.floor((height * 0.8 - 56) / 32));

    let {
        message = null,
        quiet = false,
    }: { message?: string | null; quiet?: boolean } = $props();
</script>

{#if message || !quiet}
    <div
        class="flex flex-col items-center justify-center gap-4 bg-zam-backgroundTertiary p-4"
        style="min-height: 100vh; min-height: 100dvh;"
    >
        <div class="flex items-center gap-3 text-zam-textMuted">
            <div
                class="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
            ></div>
            <span role="status" aria-live="polite"
                >{message ?? t("splash.restoringSession")}</span
            >
        </div>
    </div>
{:else}
    <!-- Otherwise the restore is silent: blocks in the app's own colours and
         column widths, so the app seems to be already there and the real
         sidebar replaces them in place. The label is for screen readers. -->
    <div
        class="flex"
        style="height: 100vh; height: 100dvh; overflow: hidden;"
        aria-busy="true"
    >
        <span class="sr-only" role="status">{t("splash.restoringSession")}</span
        >
        <div
            class="hidden md:block w-[72px] flex-shrink-0 bg-zam-backgroundTertiary pt-3"
            aria-hidden="true"
        >
            <div
                class="flex flex-col items-center gap-2 overflow-hidden animate-pulse"
            >
                {#each Array.from({ length: railCount }, (_, k) => k) as n (n)}
                    <div
                        class="w-12 h-12 flex-shrink-0 rounded-full zam-sk {n ===
                        1
                            ? 'mb-2'
                            : ''}"
                    ></div>
                {/each}
            </div>
        </div>
        <div
            class="hidden md:block w-60 flex-shrink-0 bg-zam-backgroundSecondary pt-14"
            aria-hidden="true"
        >
            <div>
                <SkeletonRows count={roomRows} />
            </div>
        </div>
        <div
            class="flex-1 min-w-0 flex flex-col bg-zam-backgroundPrimary pb-6"
            aria-hidden="true"
        >
            <div
                class="flex-1 min-h-0 overflow-hidden flex flex-col justify-end"
            >
                <SkeletonRows variant="message" count={24} />
            </div>
            <div
                class="mx-4 mt-3 h-11 flex-shrink-0 rounded-lg bg-zam-backgroundSecondary"
            ></div>
        </div>
    </div>
{/if}
