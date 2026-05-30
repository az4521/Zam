<script lang="ts">
    import "../app.css";
    import { onMount } from "svelte";
    import { Capacitor } from "@capacitor/core";

    let { children } = $props();

    function anchorUrl(target: EventTarget | null): URL | null {
        const anchor = (target as Element | null)?.closest?.("a");
        const href = anchor?.getAttribute("href");
        if (!href) return null;
        try {
            return new URL(href, location.href);
        } catch {
            return null;
        }
    }

    async function copyText(text: string): Promise<boolean> {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch {
            /* fall through */
        }
        try {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            ta.remove();
            return ok;
        } catch {
            return false;
        }
    }

    function showToast(msg: string) {
        const el = document.createElement("div");
        el.textContent = msg;
        el.style.cssText =
            "position:fixed;left:50%;bottom:5rem;transform:translateX(-50%);" +
            "background:rgba(0,0,0,0.85);color:#fff;padding:0.5rem 0.9rem;" +
            "border-radius:0.5rem;font-size:0.85rem;z-index:99999;" +
            "pointer-events:none;transition:opacity 0.3s";
        document.body.appendChild(el);
        setTimeout(() => (el.style.opacity = "0"), 1200);
        setTimeout(() => el.remove(), 1600);
    }

    onMount(() => {
        const native = Capacitor.isNativePlatform();
        let longPressCopied = false;
        let lpTimer: ReturnType<typeof setTimeout> | null = null;
        let lpStartX = 0;
        let lpStartY = 0;

        // Open external links outside the app instead of navigating the window:
        //   web → new browser tab, Electron / Android → system browser.
        function onClick(e: MouseEvent) {
            if (longPressCopied) {
                // Swallow the click that follows a long-press copy.
                longPressCopied = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const url = anchorUrl(e.target);
            if (!url) return;
            if (url.protocol !== "http:" && url.protocol !== "https:") return;
            if (url.origin === location.origin) return; // in-app navigation
            e.preventDefault();
            window.open(url.href, "_blank", "noopener,noreferrer");
        }
        document.addEventListener("click", onClick);

        // Android: long-press a link to copy its URL to the clipboard.
        function onTouchStart(e: TouchEvent) {
            longPressCopied = false;
            const url = anchorUrl(e.target);
            if (!url || (url.protocol !== "http:" && url.protocol !== "https:"))
                return;
            const t = e.touches[0];
            lpStartX = t.clientX;
            lpStartY = t.clientY;
            lpTimer = setTimeout(async () => {
                lpTimer = null;
                if (await copyText(url.href)) {
                    longPressCopied = true;
                    navigator.vibrate?.(30);
                    showToast("Link copied");
                }
            }, 500);
        }
        function onTouchMove(e: TouchEvent) {
            if (!lpTimer) return;
            const t = e.touches[0];
            if (Math.hypot(t.clientX - lpStartX, t.clientY - lpStartY) > 10) {
                clearTimeout(lpTimer);
                lpTimer = null;
            }
        }
        function onTouchEnd() {
            if (lpTimer) {
                clearTimeout(lpTimer);
                lpTimer = null;
            }
        }
        // Suppress the WebView's native long-press menu on links.
        function onContextMenu(e: MouseEvent) {
            if (anchorUrl(e.target)) e.preventDefault();
        }

        if (native) {
            document.documentElement.classList.add("cap-native");
            document.addEventListener("touchstart", onTouchStart, {
                passive: true,
            });
            document.addEventListener("touchmove", onTouchMove, {
                passive: true,
            });
            document.addEventListener("touchend", onTouchEnd);
            document.addEventListener("touchcancel", onTouchEnd);
            document.addEventListener("contextmenu", onContextMenu);
        }

        return () => {
            document.removeEventListener("click", onClick);
            if (native) {
                document.documentElement.classList.remove("cap-native");
                document.removeEventListener("touchstart", onTouchStart);
                document.removeEventListener("touchmove", onTouchMove);
                document.removeEventListener("touchend", onTouchEnd);
                document.removeEventListener("touchcancel", onTouchEnd);
                document.removeEventListener("contextmenu", onContextMenu);
            }
        };
    });
</script>

{@render children()}
