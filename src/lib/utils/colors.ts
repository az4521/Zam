/**
 * Avatar background palette — deterministic, index derived from name hash.
 * Values reference CSS variables defined in app.css (:root --avatar-color-*).
 */
export const AVATAR_PALETTE = [
    "var(--avatar-color-0)",
    "var(--avatar-color-1)",
    "var(--avatar-color-2)",
    "var(--avatar-color-3)",
    "var(--avatar-color-4)",
    "var(--avatar-color-5)",
    "var(--avatar-color-6)",
    "var(--avatar-color-7)",
];

export function getAvatarInitials(name: string | null | undefined): string {
    let label = name?.trim();
    if (!label) return "?";
    if (label.startsWith("@")) {
        label = label.slice(1).split(":")[0];
        if (!label) return "?";
    }
    const words = label.split(/\s+/);
    if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function getAvatarColor(seed: string | null | undefined): string {
    const value = seed || "?";
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
