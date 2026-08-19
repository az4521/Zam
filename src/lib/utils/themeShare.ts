import { sanitizeThemeColors, type ThemeColors } from "./themePalette";

export interface SharedPreset {
    name?: string;
    colors: ThemeColors;
}

function toBase64(s: string): string {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}

function fromBase64(b64: string): string {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeThemePreset(preset: SharedPreset): string {
    const payload = {
        v: 1,
        ...(preset.name ? { name: preset.name } : {}),
        colors: preset.colors,
    };
    return "zam-theme:" + toBase64(JSON.stringify(payload));
}

export function decodeThemePreset(input: string): SharedPreset | null {
    const s = input.trim();

    if (!s.startsWith("zam-theme:")) {
        return null;
    }

    try {
        const b64 = s.slice("zam-theme:".length);
        const json = fromBase64(b64);
        const parsed = JSON.parse(json);

        const colors = sanitizeThemeColors(parsed?.colors);

        if (Object.keys(colors).length === 0) {
            return null;
        }

        const name = typeof parsed?.name === "string" ? parsed.name : undefined;

        return name ? { name, colors } : { colors };
    } catch {
        return null;
    }
}
