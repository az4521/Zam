/**
 * Build static/soundfonts/default.sf3 from "Phoenix MT-32" (W.D. Tharinda
 * Perera, based on Jexu's Phoenix; CC BY; https://musical-artifacts.com/artifacts/1481),
 * with its gaps filled from two small free banks:
 *
 *   node scripts/build-soundfont.mjs <Phoenix_MT-32.sf2> <microgm-opt.sf2> \
 *       <GeneralUser-GS.sf2> [out.sf3]
 *
 * - microgm-opt.sf2: "gm soundfont for tiny devices" by michael, WTFPL.
 * - GeneralUser-GS.sf2: GeneralUser GS v2.0.3 by S. Christian Collins,
 *   https://github.com/mrbumpy409/GeneralUser-GS (its license allows use in
 *   software and modification).
 *
 * The source bank lays its bank-0 presets out like a Roland MT-32, so General
 * MIDI files (nearly every .mid people share) would get the wrong instruments:
 * GM program 24 "Nylon Guitar" is its "Synth Brass 1", and so on. This:
 *
 * 1. Moves the original MT-32 presets to bank 127, unchanged.
 * 2. Adds 128 General MIDI presets in bank 0. Most reuse the zones of the
 *    closest-sounding MT-32 preset (GM_TO_MT32 below; no samples copied).
 *    The 44 the MT-32 has nothing like (Kalimba, Distortion Guitar, Breath
 *    Noise, ...) are copied from microgm instead.
 * 3. Adds the 98 GS variation tones (banks 1-32), so every patch Windows'
 *    GS synth knows has its own sound: 52 reuse an MT-32 preset (GS_TO_MT32;
 *    Roland built many from MT-32 tones), and the 46 the MT-32 can't play
 *    (Ukulele, Mandolin, Sine Wave, the sound effects, ...) are copied from
 *    GeneralUser GS. The GS drum kits are already in GM layout and are left
 *    alone.
 * 4. Re-encodes every sample as Opus (ffmpeg with libopus must be on PATH),
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

/**
 * GM program -> MT-32 program (the source bank's bank-0 numbering), or null
 * where the MT-32 has no such instrument and microgm's is used instead.
 */
// prettier-ignore
const GM_TO_MT32 = [
    // 0-7 piano
    0, 1, null, 7, 3, 4, 16, 19,
    // 8-15 chromatic percussion
    22, 101, null, 97, 104, 103, 102, null,
    // 16-23 organ
    8, 9, 10, 12, 14, 15, 87, null,
    // 24-31 guitar
    59, 60, 61, 62, null, null, null, null,
    // 32-39 bass
    64, 66, 67, 70, 68, 69, 28, 29,
    // 40-47 strings
    52, null, 54, 56, null, 51, 57, 112,
    // 48-55 ensemble
    48, 50, null, null, 34, null, null, 122,
    // 56-63 brass
    88, 90, 94, null, 92, 95, 24, 25,
    // 64-71 reed
    78, 79, 80, 81, 84, 85, 86, 82,
    // 72-79 pipe
    74, 72, 76, 77, 110, 107, 108, null,
    // 80-87 synth lead
    47, 44, null, null, null, 39, null, null,
    // 88-95 synth pad
    32, null, null, null, null, 35, 46, null,
    // 96-103 synth effects
    41, 36, 40, 37, null, null, 43, null,
    // 104-111 ethnic
    63, null, null, 105, null, null, null, null,
    // 112-119 percussive
    100, null, null, null, 117, 113, 116, 119,
    // 120-127 sound effects
    null, null, null, 124, 123, null, null, null,
];

/**
 * GS variation tones (the Sound Canvas set, as in Windows' gm.dls) played by
 * an MT-32 preset, as [bank, program, MT-32 program, name]. Many GS
 * variations began as MT-32 tones, and these cost nothing: no samples.
 */
// prettier-ignore
const GS_TO_MT32 = [
    [8, 0, 0, "Piano 1w"], [16, 0, 0, "Piano 1d"], [8, 1, 1, "Piano 2w"],
    [8, 2, 2, "Piano 3w"], [8, 3, 7, "Honky-tonk w"],
    [8, 4, 5, "Detuned EP 1"], [16, 4, 3, "E.Piano 1v"], [24, 4, 6, "60's E.Piano"],
    [8, 5, 6, "Detuned EP 2"], [16, 5, 4, "E.Piano 2v"],
    [8, 6, 17, "Coupled Hps."], [16, 6, 16, "Harpsi.w"], [24, 6, 18, "Harpsi.o"],
    [8, 11, 98, "Vibraphone w"], [8, 12, 104, "Marimba w"],
    [8, 14, 102, "Church Bell"], [9, 14, 38, "Carillon"],
    [8, 16, 11, "Detuned Or.1"], [16, 16, 9, "60's Organ 1"], [32, 16, 11, "Organ 4"],
    [8, 17, 10, "Detuned Or.2"], [32, 17, 11, "Organ 5"],
    [8, 19, 13, "Church Org.2"], [16, 19, 14, "Church Org.3"],
    [8, 21, 15, "Accordion It"],
    [16, 24, 59, "Nylon Gt.o"], [32, 24, 59, "Nylon Gt.2"],
    [8, 27, 61, "Chorus Gt."], [8, 28, 61, "Funk Gt."], [16, 28, 62, "Funk Gt.2"],
    [1, 38, 28, "SynthBass101"], [8, 38, 30, "Synth Bass 3"],
    [8, 39, 31, "Synth Bass 4"], [16, 39, 29, "Rubber Bass"],
    [8, 40, 53, "Slow Violin"], [8, 48, 50, "Orchestra"], [8, 50, 49, "Syn.Strings3"],
    [32, 52, 34, "Choir Aahs 2"], [1, 57, 91, "Trombone 2"], [1, 60, 93, "Fr.Horn 2"],
    [8, 61, 96, "Brass 2"], [8, 62, 26, "Synth Brass3"], [16, 62, 24, "AnalogBrass1"],
    [8, 63, 27, "Synth Brass4"], [16, 63, 25, "AnalogBrass2"],
    [8, 81, 44, "Doctor Solo"], [1, 98, 99, "Syn Mallet"], [1, 102, 40, "Echo Bell"],
    [2, 102, 43, "Echo Pan"], [1, 104, 63, "Sitar 2"], [8, 115, 120, "Castanets"],
    [9, 118, 115, "Elec Perc."],
];

/**
 * The rest of the GS variations, taken from GeneralUser GS as [bank,
 * program]: instruments the MT-32 has nothing like, and the sound effects.
 */
// prettier-ignore
const GS_FROM_GENERALUSER = [
    [8, 24], [8, 25], [16, 25], [8, 26], [8, 30], [8, 31], [1, 80], [8, 80],
    [1, 81], [8, 107], [8, 116], [8, 117], [8, 118], [1, 120], [2, 120],
    [1, 121], [1, 122], [2, 122], [3, 122], [4, 122], [5, 122], [1, 123],
    [2, 123], [3, 123], [1, 124], [2, 124], [3, 124], [4, 124], [5, 124],
    [1, 125], [2, 125], [3, 125], [4, 125], [5, 125], [6, 125], [7, 125],
    [8, 125], [9, 125], [1, 126], [2, 126], [3, 126], [4, 126], [5, 126],
    [1, 127], [2, 127], [3, 127],
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

const [
    input,
    microgmPath,
    generalUserPath,
    output = "static/soundfonts/default.sf3",
] = process.argv.slice(2);
if (!input || !microgmPath || !generalUserPath) {
    console.error(
        "usage: node scripts/build-soundfont.mjs <Phoenix_MT-32.sf2> " +
            "<microgm-opt.sf2> <GeneralUser-GS.sf2> [out.sf3]",
    );
    process.exit(1);
}

function load(path) {
    const data = readFileSync(path);
    return SoundBankLoader.fromArrayBuffer(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    );
}
const file = readFileSync(input);
const bank = load(input);
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

/** The melodic preset at bank:program in `source`, or throw. */
function findPreset(source, bankMSB, program, label) {
    const p = source.presets.find(
        (x) => !x.isDrum && x.bankMSB === bankMSB && x.program === program,
    );
    if (!p) throw new Error(`${label} has no preset ${bankMSB}:${program}`);
    return p;
}

/**
 * Prefix every instrument and sample name in `source` with a tag unique to
 * it: cloneInstrument/cloneSample reuse whatever already has the same name,
 * which would silently swap in a Phoenix instrument called "Flute".
 */
function tagNames(source, tag) {
    const rename = (item, i) => {
        item.name = `${tag}${i.toString(36)} ${item.name}`.slice(0, 20);
    };
    source.instruments.forEach(rename);
    source.samples.forEach(rename);
}

let imported = 0;
/** Copy `src`, with its instruments and samples, in as bank:program. */
function importPreset(src, bankMSB, program, name) {
    // clonePreset also reuses presets by name; give it one nothing has.
    src.name = `~import ${imported++}`;
    const p = bank.clonePreset(src);
    p.name = name.slice(0, 19); // SF2 preset names: 20 bytes
    p.bankMSB = bankMSB;
    p.bankLSB = 0;
    p.program = program;
}

/** A new preset at bank:program sharing an MT-32 preset's zones. */
function mt32Alias(mtProgram, bankMSB, program, name) {
    const src = mt32.get(mtProgram);
    const p = new BasicPreset(bank);
    p.name = name.slice(0, 19);
    p.program = program;
    p.bankMSB = bankMSB;
    p.bankLSB = 0;
    p.globalZone.copyFrom(src.globalZone);
    for (const zone of src.zones) p.createZone(zone.instrument).copyFrom(zone);
    return p;
}

// 2. GM presets: the MT-32 instruments where one fits, microgm's elsewhere.
const microgm = load(microgmPath);
tagNames(microgm, "m");
const aliases = [];
GM_TO_MT32.forEach((mtProgram, gmProgram) => {
    if (mtProgram === null) {
        const src = findPreset(microgm, 0, gmProgram, "microgm");
        importPreset(src, 0, gmProgram, GM_NAMES[gmProgram]);
    } else {
        aliases.push(mt32Alias(mtProgram, 0, gmProgram, GM_NAMES[gmProgram]));
    }
});

// 3. GS variation tones: MT-32 presets where Roland's came from one,
// GeneralUser GS for the rest.
for (const [bankMSB, program, mtProgram, name] of GS_TO_MT32) {
    aliases.push(mt32Alias(mtProgram, bankMSB, program, name));
}
bank.addPresets(...aliases);
const generalUser = load(generalUserPath);
tagNames(generalUser, "g");
for (const [bankMSB, program] of GS_FROM_GENERALUSER) {
    const src = findPreset(generalUser, bankMSB, program, "GeneralUser GS");
    importPreset(src, bankMSB, program, src.name.trim());
}
bank.flush();

bank.soundBankInfo.name = "Phoenix MT-32 GM";
bank.soundBankInfo.comment =
    'Zam build of "Phoenix MT-32" by W.D. Tharinda Perera (based on Phoenix ' +
    "by Jexu), CC BY, https://musical-artifacts.com/artifacts/1481. Changes: " +
    "MT-32 presets moved to bank 127; General MIDI presets added in bank 0 " +
    "mapped to the closest MT-32 instruments; samples re-encoded as Ogg " +
    "Opus. GM instruments the MT-32 lacks are from microgm (by michael, " +
    "WTFPL); GS variation tones are from GeneralUser GS v2.0.3 by S. " +
    "Christian Collins. Built by scripts/build-soundfont.mjs.";

// 4. Opus-compress every sample.

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
