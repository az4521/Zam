# Bundled SoundFont

`default.sf3` is **Phoenix MT-32** by W.D. Tharinda Perera, based on
Phoenix by Jexu, licensed CC BY:
<https://musical-artifacts.com/artifacts/1481>. It's credited in the app
under Settings > About > Credits.

Changes from the original, made by `scripts/build-soundfont.mjs`:

- The MT-32 presets moved to bank 127.
- General MIDI presets added in bank 0, each mapped to the closest MT-32
  instrument, so ordinary `.mid` files get the right instruments.
- Samples re-encoded as Opus (64 kbps) in a custom packing, taking the file
  from 6.3 MB to about 0.9 MB. This is not a standard SF3: only this app's
  worker (`src/lib/workers/midiRender.worker.ts`) can decode it.

To rebuild (needs ffmpeg with libopus on PATH):

    node scripts/build-soundfont.mjs path/to/Phoenix_MT-32.sf2

## How it's used

`src/lib/utils/midiSoundBank.ts` renders MIDI attachments with, in order:

1. The OS's own bank (desktop app only): `gm.dls` on Windows, Apple's
   `gs_instruments.dls` on macOS, a distro SoundFont on Linux.
2. This bank. Its Opus samples are decoded with WebCodecs, so browsers
   without `AudioDecoder` skip it.
3. The built-in oscillator synth in `src/lib/utils/midi.ts`.

The file is fetched only when someone plays a MIDI attachment. It isn't in
the service worker's offline precache, but it does ship inside the Electron
installer and the Android APK.
