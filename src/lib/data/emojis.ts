// The standard emoji dataset (unicode-emoji-json, ~420 KB of JSON) is loaded on
// demand so it stays out of the startup chunk. Callers await loadEmojiData()
// once, then read the result; loadedEmojiData() is the synchronous view after
// that. The send path does not use this module (see emojiSequence.ts).

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

export interface EmojiData {
    categories: EmojiCategory[];
    /** Every entry of every category, in category order. */
    all: EmojiEntry[];
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

function buildEmojiData(groups: RawGroup[]): EmojiData {
    const categories: EmojiCategory[] = groups.map((g) => ({
        id: g.slug,
        label: GROUP_LABELS[g.name] ?? g.emojis[0]?.emoji ?? "?",
        name: g.name,
        // One entry per base emoji; `skin_tone_support` merely flags whether
        // tone variants exist, so it must NOT be used to drop entries (doing so
        // removed ~320 common emoji like 👋 👍 🙏).
        emojis: g.emojis.map((e) => ({ emoji: e.emoji, name: e.name })),
    }));
    return { categories, all: categories.flatMap((c) => c.emojis) };
}

let loaded: EmojiData | null = null;
let loading: Promise<EmojiData> | null = null;

/** The dataset once `loadEmojiData()` has resolved, otherwise null. */
export function loadedEmojiData(): EmojiData | null {
    return loaded;
}

/** Loads the dataset on first call; later calls share the same promise. */
export function loadEmojiData(): Promise<EmojiData> {
    loading ??= import("unicode-emoji-json/data-by-group.json").then((m) => {
        loaded = buildEmojiData(m.default as RawGroup[]);
        return loaded;
    });
    return loading;
}
