# Bundled SoundFont

`default.sf3` is **Phoenix MT-32** by W.D. Tharinda Perera, based on
Phoenix by Jexu, licensed CC BY:
<https://musical-artifacts.com/artifacts/1481>. Instruments the MT-32
doesn't have come from two other free banks:

- **microgm** (`microgm-opt.sf2`, "gm soundfont for tiny devices") by
  michael, licensed WTFPL.
- **GeneralUser GS** v2.0.3 by S. Christian Collins:
  <https://github.com/mrbumpy409/GeneralUser-GS>. Its license allows use in
  software projects and modification.

All three are credited in the app under Settings > About > Credits.

Changes from the original, made by `scripts/build-soundfont.mjs`:

- The MT-32 presets moved to bank 127.
- General MIDI presets added in bank 0, each mapped to the closest MT-32
  instrument, so ordinary `.mid` files get the right instruments. The 44 GM
  instruments with no MT-32 equivalent (Kalimba, Distortion Guitar, Breath
  Noise, Gunshot, ...) are microgm's instead.
- All 98 GS variation tones added (banks 1-32), so every patch Windows' GS
  synth (`gm.dls`) knows has its own sound here too: 52 reuse an MT-32
  preset, as Roland's originals did, and the other 46 (Ukulele, Mandolin,
  Sine Wave, the sound effects, ...) are GeneralUser GS's.
- Samples re-encoded as Opus (64 kbps) in a custom packing, taking the file
  from 6.3 MB to about 1.8 MB. This is not a standard SF3: only this app's
  worker (`src/lib/workers/midiRender.worker.ts`) can decode it.

To rebuild (needs ffmpeg with libopus on PATH):

    node scripts/build-soundfont.mjs path/to/Phoenix_MT-32.sf2 \
        path/to/microgm-opt.sf2 path/to/GeneralUser-GS.sf2

## How it's used

`src/lib/utils/midiSoundBank.ts` renders MIDI attachments with the bank
picked under Settings > Messages & media > MIDI:

- **Included** (default): this bank. Its Opus samples are decoded with
  WebCodecs, so browsers without `AudioDecoder` can't use it.
- **System**: the OS's own bank (desktop app only): `gm.dls` on Windows,
  Apple's `gs_instruments.dls` on macOS, a distro SoundFont on Linux. Greyed
  out where there is none.
- **Custom**: an SF2/SF3/DLS the user picks, stored in IndexedDB
  (`src/lib/utils/customSoundBank.ts`).

A choice that can't be met falls back to this bank, and with no bank at all
the built-in oscillator synth in `src/lib/utils/midi.ts` plays instead.

The file is fetched only when someone plays a MIDI attachment. It isn't in
the service worker's offline precache, but it does ship inside the Electron
installer and the Android APK.
