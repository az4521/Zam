import groups from "unicode-emoji-json/data-by-group.json";

export interface EmojiEntry {
    emoji: string;
    name: string;
}

export interface EmojiCategory {
    id: string;
    label: string;
    name: string;
    emojis: EmojiEntry[];
}

const GROUP_LABELS: Record<string, string> = {
    "Smileys & Emotion": "😀",
    "People & Body": "👋",
    "Animals & Nature": "🐶",
    "Food & Drink": "🍎",
    "Travel & Places": "✈️",
    Activities: "⚽",
    Objects: "💡",
    Symbols: "❤️",
    Flags: "🏁",
};

type RawGroup = {
    name: string;
    slug: string;
    emojis: { emoji: string; name: string; skin_tone_support: boolean }[];
};

export const EMOJI_CATEGORIES: EmojiCategory[] = (groups as RawGroup[]).map(
    (g) => ({
        id: g.slug,
        label: GROUP_LABELS[g.name] ?? g.emojis[0]?.emoji ?? "?",
        name: g.name,
        // One entry per base emoji; `skin_tone_support` merely flags whether
        // tone variants exist, so it must NOT be used to drop entries (doing so
        // removed ~320 common emoji like 👋 👍 🙏).
        emojis: g.emojis.map((e) => ({ emoji: e.emoji, name: e.name })),
    }),
);

export const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap(
    (c) => c.emojis,
);
