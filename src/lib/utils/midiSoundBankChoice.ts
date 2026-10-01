/** Which sound bank plays MIDI attachments (Settings > Messages & media). */
export type MidiSoundBankChoice = "system" | "bundled" | "custom";

export function normalizeMidiSoundBank(
    value: string | null | undefined,
): MidiSoundBankChoice {
    return value === "bundled" || value === "custom" ? value : "system";
}
