export type Theme = "dark" | "light";

export function normalizeTheme(value: string | null): Theme {
    return value === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    document
        .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "light" ? "#f2f3f5" : "#313338");
}
