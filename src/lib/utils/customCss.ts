// User and plugin stylesheets. Each owner gets one <style> element, appended to
// <head> after the app's own CSS, so equal-specificity rules win and an owner's
// changes never touch another's. (The theme colours are set inline on <html>,
// so overriding one of those variables needs `!important`.)

const ATTR = "data-zam-css";

const find = (id: string): HTMLStyleElement | null =>
    typeof document === "undefined"
        ? null
        : (Array.from(
              document.head.querySelectorAll<HTMLStyleElement>(
                  `style[${ATTR}]`,
              ),
          ).find((el) => el.getAttribute(ATTR) === id) ?? null);

/** Set (or, when `css` is empty, remove) the stylesheet owned by `id`. */
export function setStyleSheet(id: string, css: string): void {
    if (typeof document === "undefined") return;
    const existing = find(id);
    if (!css.trim()) {
        existing?.remove();
        return;
    }
    if (existing) {
        if (existing.textContent !== css) existing.textContent = css;
        return;
    }
    const el = document.createElement("style");
    el.setAttribute(ATTR, id);
    el.textContent = css;
    document.head.appendChild(el);
}

export function removeStyleSheet(id: string): void {
    setStyleSheet(id, "");
}

/** Escape hatch: a CSS rule that hides the settings page can't be undone from
 *  inside the app, so `?nocustomcss` loads the app with the custom CSS box off. */
export function customCssBlockedByUrl(): boolean {
    try {
        return new URLSearchParams(location.search).has("nocustomcss");
    } catch {
        return false;
    }
}
