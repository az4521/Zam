<script lang="ts">
    import { parseMarkdown } from "$lib/utils/markdown";
    import { sanitizeMatrixHtml } from "$lib/utils/sanitizeHtml";

    let { body }: { body: string } = $props();

    // First-party notes, but routed through the SAME parseMarkdown →
    // sanitizeMatrixHtml pipeline as user messages so the {@html} invariant
    // holds. Never {@html} the raw string.
    const html = $derived(
        body ? sanitizeMatrixHtml(parseMarkdown(body).formattedBody) : "",
    );
</script>

<div class="whats-new-prose text-sm leading-relaxed text-discord-textPrimary">
    {@html html}
</div>

<style>
    .whats-new-prose :global(h1),
    .whats-new-prose :global(h2),
    .whats-new-prose :global(h3) {
        font-weight: 600;
        margin: 0.75em 0 0.35em;
    }
    .whats-new-prose :global(ul),
    .whats-new-prose :global(ol) {
        margin: 0.35em 0;
        padding-left: 1.25em;
        list-style: revert;
    }
    .whats-new-prose :global(a) {
        color: var(--discord-accent-text, #8fa1e2);
        text-decoration: underline;
    }
    .whats-new-prose :global(code) {
        background: rgba(0, 0, 0, 0.25);
        padding: 0.1em 0.3em;
        border-radius: 3px;
    }
    .whats-new-prose :global(pre) {
        background: rgba(0, 0, 0, 0.25);
        padding: 0.6em;
        border-radius: 6px;
        overflow-x: auto;
    }
</style>
