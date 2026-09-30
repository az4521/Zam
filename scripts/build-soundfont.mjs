/**
 * Build static/soundfonts/default.sf3 from "Phoenix MT-32" (W.D. Tharinda
 * Perera, based on Jexu's Phoenix; CC BY; https://musical-artifacts.com/artifacts/1481).
 *
 *   node scripts/build-soundfont.mjs <Phoenix_MT-32.sf2> [out.sf3]
 *
 * The source bank lays its bank-0 presets out like a Roland MT-32, so General
 * MIDI files (nearly every .mid people share) would get the wrong instruments:
 * GM program 24 "Nylon Guitar" is its "Synth Brass 1", and so on. This:
 *
 * 1. Moves the original MT-32 presets to bank 127, unchanged.
 * 2. Adds 128 General MIDI presets in bank 0, each reusing the zones of the
 *    closest-sounding MT-32 preset (GM_TO_MT32 below). No samples are copied.
 *    The GS drum kits are already in GM layout and are left alone.
 * 3. Re-encodes every sample as Opus (ffmpeg with libopus must be on PATH),
 *    packed as src/lib/utils/opusSample.ts describes. Plain SF3 would use
 *    Vorbis, but its per-sample headers alone came to ~1.4 MB here; Opus is
 *    0.8 MB for the whole bank. Opus only runs at 48 kHz, so each sample is
 *    first resampled by the ratio that makes its loop a whole number of
 *    48 kHz samples, and the header gets the matching (non-48000) rate:
 *    plain rounding of loop lengths detuned short loops by up to 46 cents.
 *
 * Needs a one-off run whenever the source or the mapping changes; the output
 * is committed. CC BY requires indicating changes: the list above is written
 * into the bank's comment too.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { BasicPreset, BasicSoundBank, SoundBankLoader } from "spessasynth_core";
import { packOpusSample } from "../src/lib/utils/opusSample.ts";

/** GM program -> MT-32 program (the source bank's bank-0 numbering). */
// prettier-ignore
const GM_TO_MT32 = [
    // 0-7 piano
    0, 1, 2, 7, 3, 4, 16, 19,
    // 8-15 chromatic percussion
    22, 101, 23, 97, 104, 103, 102, 105,
    // 16-23 organ
    8, 9, 10, 12, 14, 15, 87, 15,
    // 24-31 guitar
    59, 60, 61, 62, 61, 62, 62, 60,
    // 32-39 bass
    64, 66, 67, 70, 68, 69, 28, 29,
    // 40-47 strings
    52, 53, 54, 56, 49, 51, 57, 112,
    // 48-55 ensemble
    48, 50, 49, 50, 34, 34, 34, 122,
    // 56-63 brass
    88, 90, 94, 89, 92, 95, 24, 25,
    // 64-71 reed
    78, 79, 80, 81, 84, 85, 86, 82,
    // 72-79 pipe
    74, 72, 76, 77, 110, 107, 108, 73,
    // 80-87 synth lead
    47, 44, 111, 111, 62, 39, 27, 31,
    // 88-95 synth pad
    32, 36, 26, 34, 49, 35, 46, 37,
    // 96-103 synth effects
    41, 36, 40, 37, 32, 43, 43, 45,
    // 104-111 ethnic
    63, 60, 105, 105, 99, 106, 53, 84,
    // 112-119 percussive
    100, 115, 99, 120, 117, 113, 116, 119,
    // 120-127 sound effects
    118, 111, 37, 124, 123, 119, 119, 114,
];

// prettier-ignore
const GM_NAMES = [
    "Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano", "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavinet",
    "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer",
    "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion",
    "Nylon Guitar", "Steel Guitar", "Jazz Guitar", "Clean Guitar", "Muted Guitar", "Overdriven Guitar", "Distortion Guitar", "Guitar Harmonics",
    "Acoustic Bass", "Finger Bass", "Pick Bass", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2",
    "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani",
    "String Ensemble 1", "String Ensemble 2", "Synth Strings 1", "Synth Strings 2", "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit",
    "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "Synth Brass 1", "Synth Brass 2",
    "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet",
    "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina",
    "Square Lead", "Saw Lead", "Calliope Lead", "Chiff Lead", "Charang Lead", "Voice Lead", "Fifths Lead", "Bass + Lead",
    "New Age Pad", "Warm Pad", "Polysynth Pad", "Choir Pad", "Bowed Pad", "Metallic Pad", "Halo Pad", "Sweep Pad",
    "Rain", "Soundtrack", "Crystal", "Atmosphere", "Brightness", "Goblins", "Echoes", "Sci-fi",
    "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bagpipe", "Fiddle", "Shanai",
    "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal",
    "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot",
];

const MT32_BANK = 127;
const OPUS_BITRATE = "64k";
const OPUS_RATE = 48000;
/** Resampler kernel half-width, in output-rate zero crossings. */
const SINC_TAPS = 32;

if (GM_TO_MT32.length !== 128 || GM_NAMES.length !== 128) {
    throw new Error("GM mapping tables must have 128 entries");
}

const [input, output = "static/soundfonts/default.sf3"] = process.argv.slice(2);
if (!input) {
    console.error("usage: node scripts/build-soundfont.mjs <in.sf2> [out.sf3]");
    process.exit(1);
}

const file = readFileSync(input);
const bank = SoundBankLoader.fromArrayBuffer(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
);
await BasicSoundBank.isSF3DecoderReady;

const mt32 = new Map();
for (const p of bank.presets) {
    if (p.isDrum || p.bankMSB !== 0) continue;
    mt32.set(p.program, p);
}
if (mt32.size !== 128) {
    throw new Error(`expected 128 MT-32 presets in bank 0, found ${mt32.size}`);
}

// 1. Originals out of the way.
for (const p of mt32.values()) p.bankMSB = MT32_BANK;

// 2. GM presets sharing the MT-32 instruments.
const gmPresets = GM_TO_MT32.map((mtProgram, gmProgram) => {
    const src = mt32.get(mtProgram);
    const p = new BasicPreset(bank);
    p.name = GM_NAMES[gmProgram].slice(0, 19); // SF2 preset names: 20 bytes
    p.program = gmProgram;
    p.bankMSB = 0;
    p.bankLSB = 0;
    p.globalZone.copyFrom(src.globalZone);
    for (const zone of src.zones) p.createZone(zone.instrument).copyFrom(zone);
    return p;
});
bank.addPresets(...gmPresets);
bank.flush();

bank.soundBankInfo.name = "Phoenix MT-32 GM";
bank.soundBankInfo.comment =
    'Zam build of "Phoenix MT-32" by W.D. Tharinda Perera (based on Phoenix ' +
    "by Jexu), CC BY, https://musical-artifacts.com/artifacts/1481. Changes: " +
    "MT-32 presets moved to bank 127; General MIDI presets added in bank 0 " +
    "mapped to the closest MT-32 instruments; samples re-encoded as Ogg " +
    "Opus. Built by scripts/build-soundfont.mjs.";

// 3. Opus-compress every sample.

/** Kaiser window (beta 8, ~-80 dB sidelobes), tabulated over |x| in [0, 1]. */
const KAISER = (() => {
    const bessel = (v) => {
        let sum = 1;
        let term = 1;
        for (let k = 1; k < 30; k++) {
            term *= (v / (2 * k)) ** 2;
            sum += term;
        }
        return sum;
    };
    const beta = 8;
    const table = new Float64Array(4097);
    for (let i = 0; i < table.length; i++) {
        const x = i / (table.length - 1);
        table[i] = bessel(beta * Math.sqrt(1 - x * x)) / bessel(beta);
    }
    return table;
})();
const kaiser = (x) =>
    KAISER[Math.round(Math.abs(x) * (KAISER.length - 1))] ?? 0;

/** Band-limited resample by `ratio` (output samples per input sample). */
function resample(input, ratio) {
    const out = new Float32Array(Math.round(input.length * ratio));
    const cutoff = Math.min(1, ratio);
    const half = Math.ceil(SINC_TAPS / cutoff);
    for (let i = 0; i < out.length; i++) {
        const center = i / ratio;
        const first = Math.ceil(center - half);
        const last = Math.floor(center + half);
        let acc = 0;
        for (
            let j = Math.max(0, first);
            j <= Math.min(input.length - 1, last);
            j++
        ) {
            const x = (j - center) * cutoff;
            const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
            acc += input[j] * sinc * kaiser((j - center) / half);
        }
        out[i] = acc * cutoff;
    }
    return out;
}

function opus(pcm48) {
    const pcm = Buffer.from(pcm48.buffer, pcm48.byteOffset, pcm48.byteLength);
    const ogg = execFileSync(
        "ffmpeg",
        [
            ...["-hide_banner", "-loglevel", "error"],
            ...["-f", "f32le", "-ar", String(OPUS_RATE), "-ac", "1"],
            ...["-i", "pipe:0"],
            ...["-c:a", "libopus", "-b:a", OPUS_BITRATE, "-f", "ogg"],
            "pipe:1",
        ],
        { input: pcm, maxBuffer: 64 * 1024 * 1024 },
    );
    return packOpusSample(new Uint8Array(ogg));
}

// An .sf2 output skips compression: an uncompressed reference build of the
// same GM mapping, for comparing against the Opus one.
const compress = !output.toLowerCase().endsWith(".sf2");
for (const sample of compress ? bank.samples : []) {
    const pcm = sample.getAudioData();
    const loopLength = sample.loopEnd - sample.loopStart;
    const ratio =
        loopLength > 0
            ? Math.round((loopLength * OPUS_RATE) / sample.sampleRate) /
              loopLength
            : OPUS_RATE / sample.sampleRate;
    const resampled = resample(pcm, ratio);
    // Rate the resampled data must play at to keep the original pitch.
    const rate = Math.round(sample.sampleRate * ratio);
    const loopStart = Math.round(sample.loopStart * ratio);
    const loopEnd = loopStart + Math.round(loopLength * ratio);
    sample.setCompressedData(opus(resampled));
    sample.sampleRate = rate;
    sample.loopStart = loopStart;
    sample.loopEnd = Math.min(loopEnd, resampled.length - 1);
}
if (compress) bank.soundBankInfo.version = { major: 3, minor: 0 };

const out = bank.writeSF2({ software: "Zam build-soundfont.mjs" });
writeFileSync(output, new Uint8Array(out));
console.log(
    `${output}: ${(out.byteLength / 1e6).toFixed(2)} MB ` +
        `(from ${(file.byteLength / 1e6).toFixed(2)} MB), ` +
        `${bank.presets.length} presets`,
);
