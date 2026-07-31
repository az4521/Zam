/**
 * The BRAND palette. This is what `colors.discord` is, and therefore what
 * `border-`, `ring-`, `divide-`, `outline-`, `placeholder-`, `accent-` and the
 * gradient utilities resolve through — all of them non-text surfaces, where
 * WCAG's bar is 3:1 and today's values are correct.
 *
 * `backgroundColor` and `textColor` below spread this map and override only
 * the four keys that carry text contrast (A11Y-10). Spreading rather than
 * re-typing the list is deliberate: extending `backgroundColor`/`textColor`
 * with a `discord` key must restate EVERY key it is expected to serve, and a
 * hand-copied list would silently drop whatever is added here later. Real
 * usages that prove the two blocks cannot be trimmed to the accent/danger
 * keys: `bg-discord-textPrimary` (14 sites) and `text-discord-backgroundTertiary`.
 */
const discordBrand = {
    // Backgrounds
    background: "rgb(var(--discord-bg-rgb) / <alpha-value>)",
    backgroundSecondary: "rgb(var(--discord-bg-secondary-rgb) / <alpha-value>)",
    backgroundTertiary: "var(--discord-bg-tertiary)",
    backgroundDark: "var(--discord-bg-dark)",
    messageHover: "var(--discord-bg-hover)",
    // Text
    textPrimary: "var(--discord-text-primary)",
    textSecondary: "var(--discord-text-secondary)",
    textMuted: "var(--discord-text-muted)",
    // Accent
    accent: "rgb(var(--discord-accent-rgb) / <alpha-value>)",
    accentHover: "rgb(var(--discord-accent-hover-rgb) / <alpha-value>)",
    // Semantic
    divider: "var(--discord-divider)",
    danger: "rgb(var(--discord-danger-rgb) / <alpha-value>)",
    dangerHover: "var(--discord-danger-hover)",
    warning: "rgb(var(--discord-warning-rgb) / <alpha-value>)",
    textPositive: "var(--discord-positive)",
    // Status
    online: "var(--discord-online)",
    idle: "var(--discord-idle)",
    dnd: "var(--discord-dnd)",
    offline: "var(--discord-offline)",
};

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{html,js,svelte,ts}"],
    theme: {
        extend: {
            colors: {
                discord: discordBrand,
            },
            // Filled surfaces that carry white text. `--discord-accent` at
            // 3.33:1 and `--discord-danger` at 3.84:1 under #fff were below AA
            // in the dark theme; the `*-fill` tokens are the same hues moved
            // far enough to clear 4.5:1 in BOTH themes. Every existing
            // `bg-discord-accent` / `bg-discord-danger` site is fixed by this
            // one mapping, with no component edit. See A11Y-10.
            backgroundColor: {
                discord: {
                    ...discordBrand,
                    accent: "rgb(var(--discord-accent-fill-rgb) / <alpha-value>)",
                    accentHover:
                        "rgb(var(--discord-accent-fill-hover-rgb) / <alpha-value>)",
                    danger: "rgb(var(--discord-danger-fill-rgb) / <alpha-value>)",
                    dangerHover: "var(--discord-danger-fill-hover)",
                },
            },
            // The same hues used AS text. This is the opposite direction from
            // the fills — the dark theme needs these LIGHTER, not darker — so
            // they get their own tokens. `accentHover`/`dangerHover` map to the
            // base text token on purpose: a hover step light enough to matter
            // would fall back under AA, so the two `hover:text-discord-*Hover`
            // sites keep their colour instead of dropping below the floor.
            textColor: {
                discord: {
                    ...discordBrand,
                    accent: "rgb(var(--discord-accent-text-rgb) / <alpha-value>)",
                    accentHover:
                        "rgb(var(--discord-accent-text-rgb) / <alpha-value>)",
                    danger: "rgb(var(--discord-danger-text-rgb) / <alpha-value>)",
                    dangerHover: "var(--discord-danger-text)",
                },
            },
            fontFamily: {
                sans: [
                    "Whitney",
                    "Helvetica Neue",
                    "Helvetica",
                    "Arial",
                    "sans-serif",
                ],
                mono: [
                    "Roboto Mono",
                    "Consolas",
                    "Liberation Mono",
                    "Courier New",
                    "monospace",
                ],
            },
        },
    },
    plugins: [],
};
