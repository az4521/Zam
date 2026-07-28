/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{html,js,svelte,ts}"],
    theme: {
        extend: {
            colors: {
                discord: {
                    // Backgrounds
                    background: "rgb(var(--discord-bg-rgb) / <alpha-value>)",
                    backgroundSecondary:
                        "rgb(var(--discord-bg-secondary-rgb) / <alpha-value>)",
                    backgroundTertiary: "var(--discord-bg-tertiary)",
                    backgroundDark: "var(--discord-bg-dark)",
                    messageHover: "var(--discord-bg-hover)",
                    // Text
                    textPrimary: "var(--discord-text-primary)",
                    textSecondary: "var(--discord-text-secondary)",
                    textMuted: "var(--discord-text-muted)",
                    // Accent
                    accent: "rgb(var(--discord-accent-rgb) / <alpha-value>)",
                    accentHover:
                        "rgb(var(--discord-accent-hover-rgb) / <alpha-value>)",
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
