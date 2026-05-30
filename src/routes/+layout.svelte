<script lang="ts">
    import "../app.css";
    import { onMount } from "svelte";

    let { children } = $props();

    // Open external links outside the app instead of navigating the window:
    //   web      → new browser tab
    //   Electron → system browser (via the main process' window-open handler)
    //   Android  → system browser (Capacitor routes window.open _blank there)
    onMount(() => {
        function onClick(e: MouseEvent) {
            if (e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const anchor = (e.target as Element | null)?.closest?.("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href) return;
            let url: URL;
            try {
                url = new URL(href, location.href);
            } catch {
                return;
            }
            // Only http(s); leave mailto:, matrix:, etc. to the OS default.
            if (url.protocol !== "http:" && url.protocol !== "https:") return;
            // Same-origin links are in-app navigation — let the router handle them.
            if (url.origin === location.origin) return;
            e.preventDefault();
            window.open(url.href, "_blank", "noopener,noreferrer");
        }
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    });
</script>

{@render children()}
