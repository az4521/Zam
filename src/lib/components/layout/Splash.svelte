<script lang="ts">
    import { t } from "$lib/i18n";
    // Shown while a stored session is being silently restored, on the same
    // tertiary background as the login card so the restore reads as one
    // continuous surface — no login-card flash before the shell appears.
    //
    // The spinner keeps turning under reduced motion (app.css carves out
    // .animate-spin on purpose: a still spinner looks like a hung app). The
    // progress bar is the one that stops: with reduced motion it sits as a
    // static segment instead of sweeping.
    let { message = null }: { message?: string | null } = $props();
</script>

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
    <div
        class="splash-track relative h-0.5 w-48 max-w-[70vw] overflow-hidden rounded-full bg-zam-accent/20"
        aria-hidden="true"
    >
        <div
            class="splash-bar absolute inset-y-0 left-0 w-2/5 rounded-full bg-zam-accent"
        ></div>
    </div>
</div>

<style>
    /* The bar's base position is its visible resting spot, so when the
       animation is collapsed (the in-app Reduce motion toggle shortens every
       animation to 0.01ms) the bar is still on screen, just not moving. */
    .splash-bar {
        animation: splash-sweep 1.6s ease-in-out infinite;
    }

    @keyframes splash-sweep {
        from {
            transform: translateX(-100%);
        }
        to {
            transform: translateX(250%);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .splash-bar {
            animation: none;
        }
    }
</style>
