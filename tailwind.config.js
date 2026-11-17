import plugin from "tailwindcss/plugin";

/**
 * The BRAND palette. This is what `colors.zam` is, and therefore what
 * `border-`, `ring-`, `divide-`, `outline-`, `placeholder-`, `accent-` and the
 * gradient utilities resolve through — all of them non-text surfaces, where
 * WCAG's bar is 3:1 and today's values are correct.
 *
 * `backgroundColor` and `textColor` below spread this map and override only
 * the four keys that carry text contrast (A11Y-10). Spreading rather than
 * re-typing the list is deliberate: extending `backgroundColor`/`textColor`
 * with a `zam` key must restate EVERY key it is expected to serve, and a
 * hand-copied list would silently drop whatever is added here later. Real
 * usages that prove the two blocks cannot be trimmed to the accent/danger
 * keys: `bg-zam-textPrimary` (14 sites) and `text-zam-backgroundTertiary`.
 */
const zamBrand = {
    // Backgrounds
    background: "rgb(var(--zam-bg-rgb) / <alpha-value>)",
    backgroundSecondary: "rgb(var(--zam-bg-secondary-rgb) / <alpha-value>)",
    backgroundTertiary: "var(--zam-bg-tertiary)",
    backgroundDark: "var(--zam-bg-dark)",
    messageHover: "var(--zam-bg-hover)",
    // Text
    textPrimary: "var(--zam-text-primary)",
    textSecondary: "var(--zam-text-secondary)",
    textMuted: "var(--zam-text-muted)",
    // Accent
    accent: "rgb(var(--zam-accent-rgb) / <alpha-value>)",
    accentHover: "rgb(var(--zam-accent-hover-rgb) / <alpha-value>)",
    // Semantic
    divider: "var(--zam-divider)",
    danger: "rgb(var(--zam-danger-rgb) / <alpha-value>)",
    dangerHover: "var(--zam-danger-hover)",
    warning: "rgb(var(--zam-warning-rgb) / <alpha-value>)",
    textPositive: "var(--zam-positive)",
    // Status
    online: "var(--zam-online)",
    idle: "var(--zam-idle)",
    dnd: "var(--zam-dnd)",
    offline: "var(--zam-offline)",
};

/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{html,js,svelte,ts}"],
    theme: {
        extend: {
            colors: {
                zam: zamBrand,
            },
            // Filled surfaces that carry white text. `--zam-accent` at
            // 3.33:1 and `--zam-danger` at 3.84:1 under #fff were below AA
            // in the dark theme; the `*-fill` tokens are the same hues moved
            // far enough to clear 4.5:1 in BOTH themes. Every existing
            // `bg-zam-accent` / `bg-zam-danger` site is fixed by this
            // one mapping, with no component edit. See A11Y-10.
            backgroundColor: {
                zam: {
                    ...zamBrand,
                    accent: "rgb(var(--zam-accent-fill-rgb) / <alpha-value>)",
                    accentHover:
                        "rgb(var(--zam-accent-fill-hover-rgb) / <alpha-value>)",
                    danger: "rgb(var(--zam-danger-fill-rgb) / <alpha-value>)",
                    dangerHover: "var(--zam-danger-fill-hover)",
                },
            },
            // The same hues used AS text. This is the opposite direction from
            // the fills — the dark theme needs these LIGHTER, not darker — so
            // they get their own tokens. `accentHover`/`dangerHover` map to the
            // base text token on purpose: a hover step light enough to matter
            // would fall back under AA, so the two `hover:text-zam-*Hover`
            // sites keep their colour instead of dropping below the floor.
            textColor: {
                zam: {
                    ...zamBrand,
                    accent: "rgb(var(--zam-accent-text-rgb) / <alpha-value>)",
                    accentHover:
                        "rgb(var(--zam-accent-text-rgb) / <alpha-value>)",
                    danger: "rgb(var(--zam-danger-text-rgb) / <alpha-value>)",
                    dangerHover: "var(--zam-danger-text)",
                },
            },
            fontFamily: {
                sans: [
                    "Whitney",
                    "Helvetica Neue",
                    "Helvetica",
                    "Arial",
                    // Syriac script (Suret UI and messages). The Latin fonts
                    // above have no Syriac glyphs, so these only ever draw
                    // Syriac characters. Eastern (Madnhaya) first: it is the
                    // script Assyrian Neo-Aramaic is normally written in.
                    "Noto Sans Syriac Eastern",
                    "Noto Sans Syriac",
                    "Estrangelo Edessa",
                    "Segoe UI Historic",
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
    plugins: [
        // `mirror:` applies when the element itself is right-to-left
        // (`:dir(rtl)`). Tailwind's built-in `rtl:` matches any element with
        // an RTL ancestor, which is wrong here: the app shell pins its panel
        // arrangement with nested `dir="ltr"` while panel contents stay RTL,
        // so something inside a pinned region must not mirror.
        plugin(({ addVariant }) => {
            addVariant("mirror", "&:dir(rtl)");
        }),
    ],
};
