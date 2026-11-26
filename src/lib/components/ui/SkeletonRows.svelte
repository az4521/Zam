<script lang="ts">
    // Placeholder rows shown while a list is still loading, shaped like the
    // rows that replace them so nothing moves when the real ones arrive. The
    // pulse follows the in-app Reduce motion setting like every animation.
    let {
        count = 6,
        variant = "room",
    }: { count?: number; variant?: "room" | "member" } = $props();

    // Name widths vary a little so the block reads as text, not a grid.
    const WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-3/5", "w-2/5", "w-4/5"];
</script>

<div
    aria-hidden="true"
    class="animate-pulse {variant === 'member' ? 'py-1' : ''}"
>
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
        {#if variant === "member"}
            <div class="flex items-center gap-2 px-2 mx-2" style="height: 40px">
                <div
                    class="w-8 h-8 flex-shrink-0 rounded-full bg-zam-textMuted/20"
                ></div>
                <div class="flex-1 min-w-0">
                    <div
                        class="h-3 rounded bg-zam-textMuted/20 {WIDTHS[
                            i % WIDTHS.length
                        ]}"
                    ></div>
                </div>
            </div>
        {:else}
            <div class="flex items-center gap-2 px-2 py-1.5">
                <div
                    class="w-5 h-5 flex-shrink-0 rounded bg-zam-textMuted/20"
                ></div>
                <div
                    class="h-3 rounded bg-zam-textMuted/20 {WIDTHS[
                        i % WIDTHS.length
                    ]}"
                ></div>
            </div>
        {/if}
    {/each}
</div>
