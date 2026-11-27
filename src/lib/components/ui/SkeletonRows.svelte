<script lang="ts">
    // Placeholder rows shown while a list is still loading, shaped like the
    // rows that replace them so nothing moves when the real ones arrive. The
    // pulse follows the in-app Reduce motion setting like every animation.
    let {
        count = 6,
        variant = "room",
    }: { count?: number; variant?: "room" | "member" | "message" } = $props();

    // Name widths vary a little so the block reads as text, not a grid.
    const WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-3/5", "w-2/5", "w-4/5"];

    // Message variant: a name bar and one or two lines of word-sized pills per
    // message, soft-focused like text not yet readable. Widths are fixed (not
    // random) so the shape is the same on every load.
    const NAMES = ["w-24", "w-20", "w-28", "w-16", "w-24", "w-20"];
    const LINES: number[][][] = [
        [
            [8, 14, 6, 10, 12],
            [9, 7, 12, 6],
        ],
        [[10, 6, 12, 8, 14, 7]],
        [
            [7, 12, 10],
            [14, 8, 6, 11, 9],
            [6, 10],
        ],
        [[9, 11, 8]],
        [
            [12, 8, 14, 6, 10],
            [8, 12, 7],
        ],
        [[9, 7, 12, 10]],
    ];
</script>

<div
    aria-hidden="true"
    class="animate-pulse {variant === 'member' ? 'py-1' : ''}"
>
    {#if variant === "message"}
        {#each Array.from({ length: count }, (_, i) => i) as i (i)}
            <div class="flex gap-3 px-4 py-1.5 blur-[1.5px]">
                <div class="w-10 h-10 flex-shrink-0 rounded-full zam-sk"></div>
                <div class="flex-1 min-w-0">
                    <div
                        class="h-3 mb-2 mt-1 rounded zam-sk {NAMES[
                            i % NAMES.length
                        ]}"
                    ></div>
                    {#each LINES[i % LINES.length] as line, l (l)}
                        <div class="flex flex-wrap gap-1.5 mb-1.5">
                            {#each line as w, k (k)}
                                <div
                                    class="h-3 rounded zam-sk zam-sk-light"
                                    style="width: {w * 6}px"
                                ></div>
                            {/each}
                        </div>
                    {/each}
                    {#if (count - 1 - i) % 7 === 0}
                        <div
                            class="mt-1 h-40 w-40 rounded zam-sk zam-sk-faint"
                        ></div>
                    {/if}
                </div>
            </div>
        {/each}
    {:else}
        {#each Array.from({ length: count }, (_, i) => i) as i (i)}
            {#if variant === "member"}
                <div
                    class="flex items-center gap-2 px-2 mx-2"
                    style="height: 40px"
                >
                    <div
                        class="w-8 h-8 flex-shrink-0 rounded-full zam-sk"
                    ></div>
                    <div class="flex-1 min-w-0">
                        <div
                            class="h-3 rounded zam-sk {WIDTHS[
                                i % WIDTHS.length
                            ]}"
                        ></div>
                    </div>
                </div>
            {:else}
                <div class="flex items-center gap-2 px-2 py-1.5">
                    <div class="w-5 h-5 flex-shrink-0 rounded zam-sk"></div>
                    <div
                        class="h-3 rounded zam-sk {WIDTHS[i % WIDTHS.length]}"
                    ></div>
                </div>
            {/if}
        {/each}
    {/if}
</div>

<style>
    /* The theme colours are CSS variables, which Tailwind cannot give an alpha
       (bg-zam-textMuted/20 compiles to nothing), so the tint is opacity. */
    :global(.zam-sk) {
        background-color: var(--zam-text-muted);
        opacity: 0.2;
    }
    :global(.zam-sk-light) {
        opacity: 0.15;
    }
    :global(.zam-sk-faint) {
        opacity: 0.1;
    }
</style>
