# Changelog

Human-readable release notes. The `## v<version>` section for the released version is pulled into
the GitHub release body automatically (see `.github/workflows/release.yml`); the auto-generated
commit list is appended below it.

## v1.30.5

✨ **New**

- **Slash commands can be replies:** /shrug, /tableflip, /unflip, /lenny, /spoiler and /plain used to drop the message you were replying to. Now they're sent as a reply to it, in threads too. /me still sends on its own.

## v1.30.4

🐛 **Fixed**

- **The shrug keeps its arm:** sending ¯\\\_(ツ)\_/¯ used to drop the backslash, so it showed up as ¯\_(ツ)\_/¯. It now arrives exactly as you typed it.

## v1.30.3

🐛 **Fixed**

- **Your status goes idle when you step away:** leaving Zam open on a computer used to keep you shown as online forever. After 5 minutes without any input you now show as away, and you're back online as soon as you return. In the desktop app, using other apps still counts as being at the computer, and locking the screen shows you as away right away. If you set yourself to away or invisible, that's left as it is.

## v1.30.2

✨ **New**

- **Several attachments send faster:** when you send more than one file at once, they now upload side by side instead of one after another. They still arrive in the chat in the order you added them, and the progress shown covers the whole batch.

🐛 **Fixed**

- **One failed file no longer holds back the rest:** if one attachment in a batch failed to send, the files after it were held back too. Now everything else still goes through, and only the file that failed stays in the composer for you to retry.

## v1.30.1

🐛 **Fixed**

- **Desktop finds updates while it's open:** the desktop app only checked for a new version when it started, so if you left it running you didn't hear about updates until you restarted it. It now also checks every few hours and when your computer wakes from sleep.

## v1.30.0

✨ **New**

- **Photos appear sooner:** JPEG photos you send are now rearranged so the people who receive them see the whole picture straight away, blurry at first and sharpening as it downloads, instead of filling in from the top. Nothing is re-encoded and the picture is exactly the same; files usually come out a little smaller too. You can turn this off in Settings > Messages & Media > Send photos that appear sooner.

🐛 **Fixed**

- **Big images in encrypted rooms load visibly:** large photos used to show a sliver at the top and then nothing until the whole file had arrived. They now paint in as they download, in the chat and when you open them.
- **GIFs play while they load:** in encrypted rooms, an animated GIF sat on its first frame until it had fully downloaded. It now starts playing as soon as its first frame is in.
- **Rooms open at the newest message:** going back into a room could leave it scrolled far up, at an old message, especially in rooms with images. It now opens at the bottom and stays there while images load.
- **Works on Android 12's built-in WebView:** Zam now runs on the WebView that ships with Android 12 (Chrome 95 and 96). Encryption needs WebView 97 or newer, so update Android System WebView from the Play Store if you can.

## v1.29.2

🐛 **Fixed**

- **New sessions on older Android phones can be verified:** on phones with an older Android System WebView, the app crashed in the background on every sync, so a new session never sent its encryption keys to the server. Your other sessions couldn't verify it, and nobody could send it encrypted messages. If one of your sessions is affected, sign it out and back in after updating.
- **Works on older iPhones:** Zam now runs on iOS 15 and 16 Safari (iPhone 8 and similar). Before, it got stuck before the login screen, or (like the Android bug above) new sessions never sent their encryption keys.

## v1.29.1

🐛 **Fixed**

- **Verifying sessions works after a bumpy recovery setup:** if the password step failed the first time you set up recovery, trying again said "Recovery is set up" but never sent your cross-signing keys to the server, so none of your sessions could verify each other. Setting up recovery now makes sure the keys reach the server. If your account is already affected, the session where you set up recovery shows "Your cross-signing keys never reached the server" in Settings > Security & Encryption, with a button to upload them.

## v1.29.0

✨ **New**

- **Emoji and emotes when editing:** editing a message now works like the composer: `:shortcode` suggestions, custom emotes shown as images, Ctrl+Z/Ctrl+Y undo and Shift+Enter for a new line. The suggestion list floats over the chat, so opening it doesn't push messages around.
- **Image previews while loading:** images you send now include a small preview, so the people who receive them see a blurry version straight away instead of an empty box while the full image loads. In encrypted rooms you can open an image before it has finished decrypting.

🐛 **Fixed**

- **Clearer message when a session can't be verified:** asking your other sessions to verify a new one failed with "no existing cross-signing key" if your account had never set up cross-signing. It now explains what's wrong and points you to Set up recovery in Settings > Security & Encryption. It also checks the server for your latest keys before asking.

## v1.28.5

🐛 **Fixed**

- **No jump after sending an image or link:** right after you sent an image, or a message with a link preview, the chat jumped up and back down. It now stays still.

## v1.28.4

🐛 **Fixed**

- **Chat no longer jumps when messages arrive:** on matrix.org and other Synapse servers, a new message in the open chat could make it jump up or go blank for a few seconds while it reloaded, and closed any image you had open. It now stays put.
- **Mentions stay highlighted:** in encrypted rooms, a message that mentioned you lost its highlight after you left the room and came back, or after the chat reloaded.
- **Send messages back to back:** after sending a message, the send button showed a spinner until the server confirmed it, which could take several seconds. You can now send the next message straight away.

## v1.28.3

✨ **New**

- **GIFs send as KLIPY links:** picking a GIF now sends its klipy.com page link (like klipy.com/gifs/nukes-true) instead of a long file address. GIFs you star from search are saved the same way, and older favourites switch over when they show up in your search results.

🐛 **Fixed**

- **GIF search plays straight away:** GIFs in the picker's search results only started moving once they had fully downloaded. They now play while they load, and so do GIFs you star from search.

## v1.28.2

✨ **New**

- **Reply with attachments:** images, videos, files and voice messages can now be sent as replies. Pick Reply, then attach or record as usual. Text typed alongside attachments becomes the caption on the first one, which carries the reply. This works in threads too.

🐛 **Fixed**

- **Voice messages stay in their thread:** a voice message recorded in a thread was posted to the main room. It now lands in the thread.

## v1.28.1

🐛 **Fixed**

- **Running out of storage is no longer silent:** when your device is full, Zam couldn't save messages or encryption keys and carried on without saying so, sometimes with encryption quietly switched off. A banner now tells you the device is out of storage and stays until there is space again. Zam also warns you early when space is running low.
- **Encryption problems say why:** when encryption can't start on a device, the banner now says it is off on this device and why (for example, no storage left). Once space is back, Try again starts it again.

## v1.28.0

✨ **New**

- **Export client logs:** Settings > Debug Info now has Copy logs and Save logs, on every platform including the Android app. The export holds everything the app has logged since it started, with tokens, passwords and keys removed, plus a header with your app version, device and encryption status. Send it along when reporting a bug.
- **WebView debugging on Android:** a switch under Settings > Debug Info lets a computer connected over USB inspect the app at chrome://inspect. It stays on across restarts until you turn it off.

🐛 **Fixed**

- **Encryption setup failures are reported clearly:** when end-to-end encryption fails to start, the reason is now logged as an error on every attempt and shown in the exported logs.

## v1.27.4

🐛 **Fixed**

- **Read receipts no longer cover message text:** when a message's last line reached the edge of the screen, the read-receipt avatars in the corner sat on top of it. The text now wraps clear of them.
- **Edited messages always say (edited):** in encrypted rooms, an edit showed the new text but often without the (edited) label. It now appears as soon as the edit decrypts.

## v1.27.3

🐛 **Fixed**

- **Download the original MIDI or tracker file:** MIDI and tracker modules (.mid, .xm, .mod, .s3m, .it, ...) play as audio rendered on your device, so the player's download only saved that rendered WAV, and a MIDI sent as audio couldn't be downloaded as the original file at all. The player now has a download button that saves the file as it was sent. The player's own download still saves the rendered WAV.

## v1.27.2

🐛 **Fixed**

- **MIDI attachments play the right instruments:** the included sound bank had no real equivalent for 44 General MIDI instruments and used the nearest MT-32 sound instead, so Kalimba played a square wave, Distortion Guitar sounded clean, Breath Noise was a pan flute and Gunshot a snare. Those now have their own sounds.

✨ **New**

- **GS sounds in the included bank:** all 98 GS variation sounds that Windows' MIDI synth has, including Ukulele, Mandolin, 12-string guitar, Sine Wave and the sound effects (Rain, Thunder, Dog, Siren, Explosion, ...). MIDI files made for Windows or Roland Sound Canvas modules now sound as intended. The bank grows from 0.9 to 1.8 MB, and is only downloaded the first time you play a MIDI.
- **MIDI sounds the same everywhere:** MIDI attachments now play with the included sound bank by default, rather than your device's own. You can still pick System or a custom bank under Settings > Messages & media > MIDI.

## v1.27.1

🐛 **Fixed**

- **No more signing out because someone else's session re-keyed:** when one of someone's sessions comes back with new encryption keys under the same session ID, Zam now drops its old copy and takes on the new keys automatically, the same as for a session that just signed in. Before, your messages stayed unreadable to that session until you signed out and back in. The replaced session starts unverified, unless its owner has cross-signed its new keys.

## v1.27.0

🐛 **Fixed**

- **One person can't read anything you send, even after resetting the room key:** this happens when their session lost its encryption data (cleared browser data, a reinstall) but stayed signed in, and came back with new keys under the same session ID. Sessions that already knew it keep the old keys, so nothing they send it can be read. Zam now notices when its own encryption data is gone and signs that session out instead, with a message asking you to sign in again.

✨ **New**

- **"Keys changed" in someone's Sessions list:** a session whose keys changed on the server is marked, with a note that it needs to sign out and back in. If you already have one stuck like this, signing out and back in on either side fixes it.

## v1.26.0

🐛 **Fixed**

- **Messages you can't decrypt, from one of someone's sessions:** a session missing a message's key now asks the sending session for it, and Zam sends it back. This works for keys that never arrived, which used to leave every later message from that sender session unreadable until it switched keys. The sending session only re-sends to someone joined to the room, in rooms where members can see past messages, and only keys it created itself. Both sides need this version.
- **Encryption failing to start no longer loses keys:** if encryption couldn't start, a session used to keep syncing and the server deleted the keys other people sent it, so their messages stayed unreadable even after a reload. Encryption now retries a few times before giving up. If it still can't start, sliding sync leaves those keys on the server, and classic sync pauses until a reload instead.

✨ **New**

- **Reset a room's key:** `/discardsession`, or Room settings > Security > Reset room key, makes your next message in that room use a new key, shared with every session in the room again. Use it when people can't read what you send.

## v1.25.0

✨ **New**

- **See someone's sessions:** a user's profile card now has a Sessions list showing each of their sessions that yours knows about, marked Verified, Unverified or Not signed by owner. Your encrypted messages only reach the sessions on this list. If someone can't read your messages, check whether their session is listed; the refresh button asks the server for their current sessions.

## v1.24.3

🐛 **Fixed**

- **Verifying a new session from an older one:** the older session now fetches just your own sessions before starting, instead of everyone you share an encrypted room with. That could take long enough to fail with "This session doesn't know about that one yet". If it still can't find the session, the error now says why: the session never published its encryption keys, or its keys were rejected. Either way, signing that session out and back in fixes it.

## v1.24.2

🐛 **Fixed**

- **Verification crash:** verifying could crash when the same emoji appeared twice in the comparison.
- **"Not a known device":** verifying a session you just signed in on from an older session no longer fails with this error. The older session now fetches your latest session list first.

## v1.24.1

🐛 **Fixed**

- **New sessions now show as unverified:** a session you just signed in on said "Encryption setup incomplete" instead of "This session isn't verified yet", which hid the new "Verify with another device" button. It now shows as unverified and offers both ways to verify.

## v1.24.0

✨ **New**

- **Verify a new session from the new session:** a session that isn't verified yet can now ask your other sessions to verify it, with "Verify with another device" (in Settings > Security, on this session in Settings > Sessions, and in the sidebar prompt). Accept the request on any of your verified sessions and compare the emoji. Entering your recovery key still works too.

## v1.23.5

🐛 **Fixed**

- **NVIDIA video on Wayland (Linux Flatpak):** hardware video decoding is now off by default on Wayland with an NVIDIA GPU, so video decodes in software instead of misbehaving. To try hardware decoding there (experimental), pick "Vulkan" in Settings > Debug > NVIDIA video decoding; on Wayland it uses OpenGL, not Vulkan.

## v1.23.4

🐛 **Fixed**

- **No video on Wayland (Linux Flatpak):** video no longer shows nothing, or a stale copy of the screen, on Wayland with an NVIDIA GPU. The hardware video path added in 1.23.2 doesn't work there, so Wayland goes back to the standard one.

## v1.23.3

🎨 **Improved**

- **@room looks like a ping:** @room in a message is now highlighted blue, like a mention of a person.

## v1.23.2

🐛 **Fixed**

- **NVIDIA hardware video decode (Linux Flatpak):** Zam now picks up its saved GPU detection and the NVIDIA video choice in Settings > Debug, so hardware H.264, HEVC and VP9 turn on by themselves, including on laptops with an Intel and an NVIDIA GPU. Before, it ignored them and decoded in software unless launched with manual flags.

## v1.23.1

🐛 **Fixed**

- **@room pings:** messages containing @room now actually notify everyone in the room; before, the mention was never sent.
- **Double sound on Windows:** loud notifications no longer play the Windows notification sound on top of Zam's own sound. The notifications themselves are unchanged.

## v1.23.0

🎙️ **Improved**

- **Normalize your own mic:** Settings > Voice & Audio > Auto gain control has a new "Normalize" option, the same volume evening-out incoming voices get, applied to your microphone after noise removal. It is now the default; "AGC2" (the previous choice) is still there.
- **Noise removal tuning in Settings > Debug:** a new "Voice processing" section has a slider for how much DeepFilterNet3 or DPDFNet may take off the signal (default 25 dB), and a toggle for the pause gate.

🐛 **Fixed**

- **Choppy voice with noise removal on:** the pause gate that cut the gaps between words is now off by default, since it could clip soft word starts. You can turn it back on in Settings > Debug.

## v1.22.1

🐛 **Fixed**

- **Stuck on "Restoring session" after changing keybinds (Linux X11):** the input hook for "Work when Zam isn't focused" now runs in a separate process, so if it fails the app stays up and Settings > Keybinds shows an error instead of the app crashing on every launch.

## v1.22.0

✨ **New**

- **Keyboard shortcuts:** Zam now has Discord's keyboard shortcuts, on Discord's default keys. Every one can be changed in the new Settings > Keybinds tab. Shortcuts cover moving between channels, unread channels, mentions and spaces, going back and forward, marking things read, the emoji/GIF/sticker pickers, search, pins, the inbox and member list, muting and deafening, answering, declining and starting calls, and more. Press Ctrl+/ to see them all.
- **Quick switcher:** Ctrl+K opens a quick switcher to jump to any room or DM by typing part of its name.
- **Push to talk and push to mute:** bind a key, a single modifier key or a mouse side button in Settings > Keybinds. Once push to talk has a key, calls start with your mic closed and it only sends while you hold the key.
- **Voice shortcuts in other apps:** in the desktop app, turn on "Work when Zam isn't focused" in Settings > Keybinds. Push to talk, push to mute, toggle mute and toggle deafen then work while you're in another app or a game, like Discord's. Zam only listens for the keys you bound.
    - **Windows and Linux X11:** works out of the box.
    - **macOS:** asks for the Accessibility permission first, with a button to open the right page in System Settings.
    - **Wayland:** the shortcuts go through your desktop's global shortcuts (KDE Plasma, GNOME 48 and newer, and others with the GlobalShortcuts portal). Your desktop may ask you to confirm them or pick other keys. Settings shows the keys it assigned.
- **Double-click + to upload:** double-clicking the + button next to the message box opens the file picker straight away.

🎙️ **Improved**

- **Smoother mic levels:** Zam's microphone leveller is replaced with WebRTC's AGC2, the automatic gain control Chrome uses. Voices no longer pump: the volume dip after a loud word is a fraction of what it was.
- **NVIDIA hardware video decoding on Wayland (Flatpak):** videos on NVIDIA graphics cards are now decoded by the card in Wayland sessions too, not only X11. NVIDIA systems that Zam didn't recognise before are now detected. Settings > Debug has an Automatic / Vulkan / Off choice for this. If it crashes twice in automatic mode, Zam goes back to the old path on the next launch.

🔧 **Changed**

- **The debug panel moved to Ctrl+Alt+Shift+D.** Ctrl+Shift+D now deafens, as in Discord.

🐛 **Fixed**

- **Room list title in other languages:** the room list header showed "Home" in English whatever language Zam was set to.

## v1.21.0

✨ **New**

- **Spanish:** Zam is now available in Spanish (Español). Pick it under Appearance > Language in settings; dates use Spanish month and weekday names too. The translation is machine-drafted and needs review by native speakers.

## v1.20.6

🐛 **Fixed**

- **Hardware video decoding on NVIDIA under X11 (Flatpak):** with an NVIDIA graphics card in an X11 session, hardware-decoded videos showed up black and HEVC videos didn't play at all. They now play, decoded by your graphics card. If your graphics card draws Zam wrongly with this on, start it with `ZAM_NVIDIA_VULKAN_VIDEO=0` to go back, or turn hardware acceleration off in Settings > Debug.
- **The bundled NVIDIA video driver is always used:** on some NVIDIA systems the Flatpak still picked up a separately installed copy of the driver instead of the one it ships.

## v1.20.5

🐛 **Fixed**

- **NVIDIA video decoding works out of the box in the Flatpak:** the Flatpak now includes NVIDIA's video decoding driver itself, so you no longer have to install `org.freedesktop.Platform.VAAPI.nvidia` by hand to get hardware-accelerated video on an NVIDIA graphics card.

🔧 **Diagnostics**

- **Hardware video on NVIDIA under X11:** the bundled driver has an experimental mode for the X11 problem where hardware-decoded video doesn't display. It's off unless you start Zam with `NVD_LINEAR=1`.

## v1.20.4

🔧 **Diagnostics**

- **Hardware video on NVIDIA under X11 (Flatpak):** the Flatpak now includes a diagnostic tool for the step where hardware-decoded video fails to display on NVIDIA graphics cards in an X11 session. It does nothing unless you start Zam with `ZAM_VK_DEBUG=1`; if you're affected and want to help, see the issue tracker for the exact command.

## v1.20.3

✨ **New**

- **GPU info and a hardware acceleration switch:** Settings > Debug in the desktop app now shows which video formats your graphics card decodes, what Chromium has hardware acceleration on for, and a full report you can copy into a bug report. If your graphics driver draws videos black or the window wrongly, you can turn hardware acceleration off there; it applies after a restart, and a button restarts Zam for you.

🐛 **Fixed**

- **Black videos with NVIDIA on X11 in the Flatpak:** 1.20.2 sent video to NVIDIA graphics cards for decoding, which only displays properly in a Wayland session. On X11, videos that used to play came out black. Zam now only does this on Wayland.

## v1.20.2

🐛 **Fixed**

- **HEVC videos and hardware video decoding on NVIDIA in the Flatpak:** the Linux Flatpak never used an NVIDIA graphics card to decode video, so HEVC videos didn't play at all and other videos used more processor than they should. It now uses the card, once you install NVIDIA's video decoding driver for Flatpak: `flatpak install flathub org.freedesktop.Platform.VAAPI.nvidia//25.08`.
- **Chromium features from the command line are no longer ignored:** `--enable-features=...` passed when launching the desktop app was being dropped.

## v1.20.1

✨ **New**

- **Tracker music plays in the chat:** MOD, XM, S3M, IT and other tracker module files now get a player above their download card, like MIDI files, so you can listen without downloading them.
- **DPDFNet on your GPU:** version 1.1.0 of the DPDFNet plugin (update it in Settings > Plugins) runs the noise filter on your graphics card where it can, using a fraction of the processor it needed before. It checks its results against the original model before first use, and falls back to the processor if your GPU is missing, too slow or misbehaves.

🐛 **Fixed**

- **MKV videos play while they load:** Matroska videos with H.264, HEVC or AAC audio, such as OBS recordings, no longer have to download completely before they start playing.
- **DPDFNet no longer hogs the processor in the desktop and Android apps:** the plugin's native runtime kept more than a whole processor core busy during calls for a fraction of that work. Update the plugin to 1.1.0 to get the fix.

## v1.20.0

✨ **New**

- **Noise filter plugins:** plugins can now add their own noise suppression for your microphone. It shows up under Voice & Audio > Noise suppression next to DeepFilterNet3, and runs with the rest of Zam's voice processing. If a plugin's filter can't run on your device, or stops keeping up during a call, DeepFilterNet3 takes over without interrupting you.
- **DPDFNet:** a new plugin in the official plugin repo (Settings > Plugins) adds DPDFNet, an AI noise filter that removes more noise than DeepFilterNet3 while keeping your voice clearer and at its natural volume, even on a quiet microphone. It needs more processing power, so Zam tests it on your device first and keeps using DeepFilterNet3 on devices that are too slow. It downloads about 25 MB the first time, plus its native runtime in the desktop and Android apps.
- **Plugins can bring native code:** in the desktop and Android apps, a plugin can ship its own native program, for example to run an AI model faster. Zam asks you first in a system dialog, checks every file against what the plugin published, and asks again whenever the plugin updates. Only allow it for plugins you trust: on Android it runs inside Zam with access to your account.

## v1.19.11

🐛 **Fixed**

- **No more volume spikes or boosted background noise in calls:** Zam's mic leveller and the volume evening-out for other people mistook leftover background noise in pauses for a quiet voice and kept turning it up. You could hear people's noise floor whenever they were quiet, and the next word came in so loud it distorted. Now only actual speech changes the volume.
- **Clicks and typing are filtered again:** noise suppression now also quietens the gaps between words, so mouse clicks, keyboard sounds and room noise in pauses are cut much further while your voice comes through as before.
- **Changing audio settings during a call:** turning auto gain control or echo cancellation on or off mid-call no longer fails with "Couldn't apply audio processing change". If a change does fail, the message now says why.

## v1.19.10

🐛 **Fixed**

- **No more pumping or "helium" voice with noise suppression:** in 1.19.9, the boost Zam gives a quiet microphone mistook room noise for a quiet voice, so it kept jumping up in pauses and back down when you spoke. Your voice swung between too loud and too quiet, sounded thin and high while the noise suppression caught up with each jump, and got muffled. The boost now only listens to your actual speech, and a normal microphone isn't boosted at all.
- **Less muffled noise suppression:** DeepFilterNet3 no longer suppresses without limit, which was eating into voices along with the noise. Speech comes through clearer and steadier, with background noise still well reduced.
- **Changing audio settings during a call works again:** switching auto gain control or noise suppression mid-call showed an error and could briefly cut your microphone. It now switches smoothly without interrupting what you're sending.

## v1.19.9

🐛 **Fixed**

- **Noise suppression no longer mangles quiet microphones:** DeepFilterNet3 noise suppression damaged speech that reached it too quietly, and with Zam's mic leveller (the default) a quiet mic always did, so voices came out watery or broken up, or dropped out altogether on very quiet mics. Zam now raises a quiet mic before noise suppression and takes the same amount off again afterwards, so your voice is cleaned up properly without changing how loud you sound. The mic test in Settings uses the same processing, so you can hear the difference there.

## v1.19.8

🐛 **Fixed**

- **Emote packs from Sable and other newer clients now show up:** packs made in clients that use the newer standard names (`m.room.image_pack`) were invisible in Zam: missing from the emoji and sticker pickers and from both lists in Settings → Emotes. Zam now reads both the new and the old names, shows packs the same way Sable does, and packs you enabled for all rooms in Sable are picked up too.

✨ **New**

- **New emote packs use the standard name:** packs you create in Zam are now saved under the newer standard name, like Sable does. Existing packs keep the name they already have, and nothing gets duplicated.
- **Editing respects each pack's permissions:** room settings only offers to edit a pack when your power level allows every change it needs, and an edit is never left half-saved.

## v1.19.7

✨ **New**

- **Videos you send start playing sooner:** MP4 and MOV videos have their index moved to the front of the file before they're uploaded, so people can start watching while it downloads instead of waiting for the whole file (this only helps if the video's index was at the end, which is how most phones and screen recorders save them). Nothing is re-encoded and the picture is identical. If a file looks unusual it's sent exactly as it was. You can turn this off in Settings → Messages and media → "Send videos that stream faster".

## v1.19.6

✨ **New**

- **WebM videos play while they download:** WebM videos (what browsers and many bridges produce) now start as soon as the first seconds arrive instead of waiting for the whole file, including encrypted ones.
- **The video viewer streams too:** opening a video from the room media panel no longer downloads the entire file before it starts, and shows progress while it loads.
- **Audio plays while it downloads:** MP3, M4A and WebM audio attachments start playing right away instead of waiting for the full file, with a progress bar until they do.
- **Big encrypted images show up as they download:** an encrypted image of 256 KB or more paints a preview that sharpens as it arrives (progressive JPEG, interlaced GIF and similar) instead of a spinner. It's replaced by the real image once it has been checked. JPEG XL gets the same treatment automatically in browsers that can decode it.

🐛 **Fixed**

- **Failed streams fall back instead of failing:** if the browser can't play a video or audio file while it downloads (some audio+video WebMs, for example), Zam now retries it as a full verified download rather than showing a playback error.

## v1.19.5

✨ **New**

- **Download progress on media:** encrypted images, videos and voice/audio messages (and videos in the viewer) now show how much has downloaded, with a progress bar, instead of a bare spinner. Handy on slow homeservers.
- **Encrypted videos play while they download:** encrypted videos of 4 MB or more start playing as soon as the first seconds arrive instead of waiting for the whole file. The file is still checked for tampering once it finishes; if that check fails, playback stops and Zam falls back to a full verified download.

🐛 **Fixed**

- **Encrypted images downloaded twice:** an encrypted image was fetched once for its preview and again for the full-size viewer. It's now downloaded once, halving the wait.
- **Favourite GIFs hold their space while loading:** the favourites tab now reserves each GIF's shape before it loads, like the main GIF picker, instead of collapsing and jumping around.

## v1.19.4

✨ **New**

- **Shift+click to download on desktop:** holding Shift while clicking a download button (image or video viewer, file attachments, room media panel) saves the file straight to your Downloads folder with no save dialog, like on Android. A plain click still asks where to save.

## v1.19.3

🐛 **Fixed**

- **Updates download once:** on Android, leaving Settings → About and coming back while an update was downloading started a second download alongside the first, so the progress bar jumped back and forth between them. Reopening About now shows the download that's already running, and an update that already finished downloading isn't fetched again.
- **Steady update progress on desktop:** opening About during a download no longer resets it to "Download available" while it's still downloading.

## v1.19.2

🐛 **Fixed**

- **Noise suppression and auto gain control work in calls:** with DeepFilterNet3 or Zam's auto gain control turned on (the defaults), joining a call showed "Audio context needs to be set on LocalAudioTrack" and your microphone wasn't processed. Your mic is now cleaned up from the moment the call starts.

## v1.19.1

✨ **New**

- **See where an emote comes from:** the emoji suggestions that pop up while you type `:` now show the room or space each custom emote belongs to, or "Your emotes" for your own, instead of just "custom".

🐛 **Fixed**

- **No emote preview for formatted words:** typing `*name*` or `_name_` in the composer showed the custom emote called `name` even though it isn't an emote shortcode. Only a full `:name:` shows one now. Sent messages were never affected.

## v1.19.0

✨ **New**

- **AI noise suppression:** Zam now removes background noise from your microphone with DeepFilterNet3, an AI model that runs on your device. Keyboards, fans, traffic and room noise are taken out while your voice is kept. It replaces the browser's built-in suppressor, which only handled steady hum. You can switch back to the browser's version or turn it off under Voice & Audio, and Test mic there lets you hear the result before a call. If you had noise suppression off, it stays off. Browsers that can't run it (Safari before 16.4) use the browser's suppressor instead.
- **The model stays on your device:** the Android and desktop apps ship with it. On the web it's downloaded once in the background after Zam starts (about 11 MB compressed) and kept across updates. Calls wait for it to load before your mic goes live, so you're never heard unfiltered at the start of a call.

## v1.18.0

✨ **New**

- **Turn people up to 500%:** the volume slider in a call participant's menu now goes up to 500% instead of stopping at 100%, so a quiet microphone is no longer stuck being quiet. Very loud voices are rounded off smoothly instead of distorting.
- **Even out voice volumes:** a new setting under Voice & Audio automatically turns quiet people up and loud people down, so you don't have to set everyone's volume by hand. It adjusts each person separately, so switching microphones mid-call is fine, and it never boosts background noise during pauses.
- **Zam's own auto gain control:** your own microphone is now levelled by Zam instead of the browser. Unlike the browser's (and Discord's) version, it never changes your system microphone volume and doesn't raise your room noise between sentences. You can switch back to the browser's version or turn it off under Voice & Audio. If you had auto gain control off, it stays off.

🐛 **Fixed**

- **Deafen stays on:** when the browser had blocked call audio and you clicked to allow it, or on Safari when you came back to the tab, other people's audio could start playing even though you were deafened.

## v1.17.1

🐛 **Fixed**

- **No more reloading two or three times on startup:** with sliding sync off, Zam could finish loading, blank the screen and start over, sometimes twice. It checked for missing rooms before the server had answered, so any room you'd joined since your last session looked lost and triggered a reload. It now waits for the server, and a room that really is missing is repaired in place instead of reloading.
- **Opening a room no longer wipes the local cache:** the first room you opened in a session could make Zam delete its saved copy of your rooms, so the next launch had to load everything from scratch.
- **Muted rooms show new messages again with sliding sync:** in muted or mentions-only rooms, new messages from others never made the room show as unread when sliding sync was on.
- **Rooms whose latest event is a reaction or edit:** with sliding sync, such rooms could load with no messages at all, and "Mark as read" did nothing for them.
- **Calls in group rooms show who's in them with sliding sync:** the room list showed nobody in a group room's call, because the people in it weren't loaded yet. Direct messages were already fine.
- **Pings in quick bursts notify with sliding sync:** when several messages arrived in a room at once, or while Zam was catching up after sleep or a dropped connection, only the newest one reached notifications, so a ping before it made no sound or popup. Zam now fetches skipped messages when your mention count went up and notifies for them as usual.

## v1.17.0

✨ **New**

- **Coloured text blocks:** code blocks marked `ansi` (Discord's coloured text) now show their colours, backgrounds, bold, italic, underline and strikethrough instead of raw escape codes. Blocks pasted without the hidden escape character work too.

🐛 **Fixed**

- **Code blocks wrap:** long lines in code blocks now wrap instead of scrolling sideways, including long runs without spaces like links and hashes.

## v1.16.1

🐛 **Fixed**

- **Scrolling up in rooms full of joins:** loading older messages fetched a fixed 15 events at a time and stopped as soon as the screen was full, so in rooms where most events are joins or leaves you could get one message per load and wait at the top every time. Zam now keeps about 30 messages loaded above where you're reading, and asks for more events at once in rooms where few of them are visible.
- **Less stutter in big rooms:** loading history that contains only joins or other hidden events no longer redraws the whole message list, messages decrypting one by one now refresh the screen at most once per frame, and the member list sorts much faster.

## v1.16.0

✨ **New**

- **Search and media in encrypted rooms:** the server can't read encrypted messages, so search used to find nothing in encrypted rooms. Zam now keeps a compressed index of your encrypted rooms on this device, filled as messages arrive and by slowly fetching older history in the background. Search finds partial words and ignores accents, and rooms that turned on encryption later still find their older messages. The media list shows indexed attachments instantly. You can turn this off under Privacy & Safety, which deletes the index; it's also deleted when you sign out.

🐛 **Fixed**

- **Media list loads a screenful at a time:** opening a room's media list showed only one or two items per click, and sometimes none. It now fills the list and loads more as you scroll.
- **Faster first upload:** the server's upload size limit is now checked while you're still writing, instead of after you press send.

## v1.15.12

🐛 **Fixed**

- **Room permissions with sliding sync:** with sliding sync on, rooms could show the wrong permissions (for example, everyone treated as able to post or moderate) because the room's power levels were never loaded. They now load for every room, so permissions match classic sync.
- **Read-only rooms lock the message box:** in rooms where you're not allowed to post, like announcement channels, the message box is now disabled and says you don't have permission, instead of letting you type a message that would fail.
- **Uploads no longer stall before starting:** on slow connections (like Tor), an attachment could sit for a long time before any data was sent while the app waited on the server's upload size limit. That check now gives up after a few seconds, and the sending indicator shows upload progress.
- **Thread names keep their spacing:** extra spaces inside a thread name are no longer squashed into one.

## v1.15.11

🐛 **Fixed**

- **New threads show up right away:** the first reply in a thread you just started could vanish from the thread panel, and the thread's reply count and its entry in the Threads list didn't appear until you reloaded or someone else replied. Your first reply now shows immediately.

## v1.15.10

🐛 **Fixed**

- **Joined rooms no longer show up under Browse:** after 1.15.9, a room you'd just joined could appear both in your list and in the space's Browse rooms list. Browse now only shows rooms you're not in.

## v1.15.9

🐛 **Fixed**

- **Joined rooms and spaces show up right away:** on servers using sliding sync, a room or space you joined vanished from Browse but didn't appear in your list until a minute later or an app restart. It now appears immediately. The same applies to accepted invites and newly created rooms.

## v1.15.8

🐛 **Fixed**

- **Room and space settings load again:** 1.15.7's Permissions tab could get stuck on "Loading…" forever. Settings now fetch what they need directly, wherever you open them from, and show an error with a Retry button if that fails.
- **Saving access settings no longer changes things you didn't touch:** on servers using sliding sync, history visibility and guest access could show defaults before loading, and saving the tab could write those defaults back. The Access tab now waits for the real values.
- **Space menus only show admin options to admins:** "Space settings" and "Add room" showed for everyone in a space.

## v1.15.7

🐛 **Fixed**

- **Space and room permissions show their real values:** on servers using sliding sync, a space's (or an unopened room's) Permissions tab showed every level as 0. It now loads the real levels first.
- **Saving permissions can no longer wipe everyone's levels:** saving from that screen while the levels hadn't loaded could reset every user's power level, admins included. Changes are now always applied on top of the room's current permissions.

## v1.15.6

🐛 **Fixed**

- **Replies to stickers say what they're replying to:** a reply to a sticker, poll or untitled photo/video/file now shows "Sticker", "Poll", "Image" and so on in its quote, instead of "Original message unavailable".

## v1.15.5

🐛 **Fixed**

- **Thread unread dot clears once you've read it:** on servers using sliding sync, the threads button kept showing unread messages after you'd read them, until you reloaded. Opening the thread (or reading it on another device) now clears it.

## v1.15.4

🐛 **Fixed**

- **New threads show up right away:** after you start a thread, the "replies" chip under its first message now appears immediately instead of only after a refresh.

## v1.15.3

🐛 **Fixed**

- **Stickers as replies:** sending a sticker while you're replying to a message now sends it as a reply to that message, in threads too.

## v1.15.2

🐛 **Fixed**

- **Safer handover of encryption keys in the background (Android):** when Zam hands its keys over to the notification decryptor, it now waits until it has completely finished with them first, instead of a fixed half second. This closes a rare case where the two could both be writing at once.

## v1.15.1

🐛 **Fixed**

- **Encrypted notifications while the app is in the background (Android), properly this time:** 1.15.0's fix didn't work, because Zam's page can't run at all while the app is in the background. Now, about 10 seconds after you leave Zam, it hands its encryption keys over to the part that decrypts notifications, so they show the message. Coming back picks up where you left off, without reloading the app.

## v1.15.0

✨ **New**

- **Thread names:** the person who started a thread, or a moderator, can name it from the pencil button in the thread's header. The name shows in the thread header, the thread list and the "replies" chip under the first message. Other Matrix apps don't show thread names.
- **My threads:** the thread list has an All threads / My threads switch. My threads shows the threads you started or replied in.
- **Reply inside a thread:** Reply now works on messages in a thread, and tapping a quoted message scrolls to it.
- **Export and import room keys:** Settings → Security & Encryption can save your encryption keys to a passphrase-protected file and load one back. It's the same format Element uses, so key files move between the two.
- **Request to join from Explore rooms:** rooms that need an invite request now have a Request to join button instead of a greyed-out "Knock only".
- **Source code link:** Settings → About links to Zam on GitHub.

🐛 **Fixed**

- **Encrypted notifications while the app is in the background (Android):** after Zam had been in the background for more than about half a minute, notifications for encrypted messages only said who sent something. Zam now pauses syncing shortly after leaving the screen so it can answer notifications straight away. On a phone where that still isn't fast enough, Zam steps aside in the background instead, and reloads when you come back to it (your drafts are kept).
- **Thread scrolling:** "Load older replies" no longer jumps you back to the bottom, and new activity elsewhere no longer scrolls a thread you're reading.
- **Missing thread replies:** replies that couldn't be decrypted, and polls started in a thread, were left out of the thread. They now show, with the usual "unable to decrypt" placeholder where needed.
- **The first message of a thread:** the thread panel showed it as three lines of plain text. It now shows in full, with images, formatting and reactions.

## v1.14.2

✨ **New**

- **Notifications for all your accounts in the browser:** with web push on, notifications for the accounts you aren't using now show the sender and message, decrypted, like the active account's, and tapping one switches to that account. Open each account once after updating to turn this on for it.
- **Notifications for all your accounts on desktop:** while the app is open, your other accounts now notify too, within about 30 seconds. Tapping one switches to that account. This also covers browsers without web push.

## v1.14.1

✨ **New**

- **See when an account's notifications are switched off:** another app (such as Element's "Enable notifications for this account") can turn off every notification for an account, and Zam never showed it, so that account just went quiet. Settings → Notifications now warns when this is on, with a button to turn notifications back on, and Debug Info shows it too.

## v1.14.0

✨ **New**

- **Notifications for all your accounts (Android):** with several accounts signed in, notifications for the ones you aren't using now show the sender and message, decrypted, like the active account's. Tapping one switches to that account and opens the room, and Mark as read works from any account. Open each account once after updating to turn this on for it.

🐛 **Fixed**

- **Encrypted notifications on desktop:** with "Show all events" on, notifications for encrypted messages only said "🔒 Encrypted message". They now show the message.
- **Editing the same message twice:** a second `s/old/new/` on a message added a "* " to the start of it, and pressing ↑ to edit your last message did nothing after you had edited it once. Both now edit the message itself.

## v1.13.10

🐛 **Fixed**

- **Encrypted notifications when the app was closed (Android):** with the app swiped away, notifications for encrypted messages still only said who sent something. They now show the message whether or not the app is running.

✨ **New**

- **Gboard stickers and images (Android):** stickers, Emoji Kitchen combos and GIFs from the keyboard can now be sent from the message box. They're added as attachments, like a pasted image.
- **Edit your last message with `s/old/new/`:** sending `s/teh/the/` fixes your last message instead of sending a new one. Add `g` to replace every match or `i` to ignore case, e.g. `s/teh/the/gi`. Works in threads too.
- **Link preview rewriter:** a new built-in plugin that fetches link previews from a different address, e.g. a mirror of a site your homeserver can't reach. The link itself isn't changed. Add rules in its plugin settings.

## v1.13.9

🐛 **Fixed**

- **Invites you couldn't ignore with sliding sync:** clicking Ignore on an invite left it in the inbox forever. It now goes away, and stays gone after a reload.
- **DM invites named "Empty room" with sliding sync:** an invite to a DM showed as "Empty room (was ...)". It's now named after the person who invited you.
- **Left rooms coming back with sliding sync:** a room you left could reappear in the sidebar about 30 seconds later. It now stays gone.
- **Presence with sliding sync:** you showed as offline to others shortly after opening the app, and nobody else's online status showed up. Both now work like they do with sliding sync off.

## v1.13.8

🐛 **Fixed**

- **Encrypted messages unreadable with sliding sync:** with sliding sync on, most messages in encrypted rooms showed "Unable to decrypt" even though the keys were there, and reloading didn't help. They now decrypt like they do with sliding sync off.
- **Pinned messages in encrypted rooms:** pinned messages that weren't already loaded in the timeline showed as encrypted. They're now decrypted.
- **"Show all events" stuck on encrypted:** with the debug option on, messages that decrypted after loading kept showing as `m.room.encrypted` until you left the room.

✨ **New**

- **Why a message couldn't be decrypted:** with "Show all events" on, messages that fail to decrypt now show the reason, to help track down missing keys.

## v1.13.6

🐛 **Fixed**

- **"Set up recovery" could replace your existing recovery:** on accounts that already had a recovery key but weren't fully set up, the button could delete your key backup and show a new key that didn't actually work. It now only appears on accounts with no recovery at all.
- **Restoring history could leave a session unverified:** entering your recovery key restored message history before verifying the session, so a slow or failed restore left it unverified. The session is now verified first.
- **Messages from devices that aren't cross-signed couldn't be read:** "Exclude non-cross-signed devices" is now off by default, and turning it off unlocks messages it had already blocked without a reload.
- **Notifications could damage encryption keys:** decrypting a notification in the background while the app was opening could, rarely, leave both using the key store at once. They now never overlap, and a stuck background decrypt no longer holds the notification back.

## v1.13.5

🐛 **Fixed**

- **Encrypted messages in notifications:** notifications for encrypted messages only said who sent something. They now show the message, on Android and in the browser, even when the app isn't running.

## v1.13.4

✨ **New**

- **Encryption setup on matrix.org:** setting up or resetting recovery on servers that sign you in through an account page, like matrix.org, now works. Instead of asking for a password, Zam sends you to your account page to approve the change, then carries on.
- **Why a message can't be decrypted:** messages you can't read now say why, for example that the sender's device isn't verified, that their identity changed, or that the message was sent before this device signed in, instead of always saying the keys might be missing.

🐛 **Fixed**

- **"Content is not encrypted!" when setting up recovery:** accounts whose encryption had been reset before could never finish setting up recovery. They now can.
- **Names and avatars stuck on placeholders:** with sliding sync on, people who joined a room or changed their name or avatar could keep showing a raw user ID and default avatar. They now update.
- **Verification stalling on "Verifying…":** verifying someone while viewing a different room could lose a step and hang until it timed out. The verification's room now stays fully synced until it finishes.

## v1.13.3

🐛 **Fixed**

- **Images failing to load on Android:** opening the app could make every image load two or three times over, and some stayed broken. Images now load once, with your login, from the start.
- **Freezes on JPEG XL images:** showing a JPEG XL image where it has to be converted could freeze the app for a moment. The conversion now happens in the background.

## v1.13.2

🐛 **Fixed**

- **Messages disappearing after a notification tap:** opening the app from a notification could show the newest messages for a moment, then lose them. They now stay.
- **Stuck on "Reconnecting" on slow connections:** on a slow or weak connection, the app could keep reconnecting forever without catching up. It now gives slow responses more time to arrive, so it gets through and syncs.

## v1.13.1

✨ **New**

- **Notifications without Google (Android):** Zam can now deliver notifications through UnifiedPush, using a distributor app such as ntfy, instead of Firebase. This works on phones without Google Play services. Choose it under Settings → Notifications → Push service. Automatic uses Firebase when it's available, and otherwise the UnifiedPush distributor you have installed.
- **JPEG XL images:** JPEG XL images now display everywhere. The desktop app shows them natively, and elsewhere they're converted on the fly.

🐛 **Fixed**

- **Missing history in busy rooms:** in very active rooms, older messages could disappear after a sync gap, and scrolling up could stop early as if you'd reached the start of the room. History now stays intact and keeps loading.

## v1.13.0

✨ **New**

- **Calls between homeservers:** calls between people on different homeservers (say matrix.org and your own server) now work both ways. Before, whoever joined on the other server's call server could listen but not talk ("failed to publish track, insufficient permissions"). Each person now sends from their own homeserver's call server and listens on everyone else's. Everyone in the call needs this version or newer to hear each other.

🐛 **Fixed**

- **Incoming calls not ringing:** a call to you could stay invisible, with no ring, until you switched rooms and back, even in the room you had open. It now rings straight away.

## v1.12.11

🐛 **Fixed**

- **New messages missing after opening a notification (Android):** tapping a notification could show the room without the message you were notified about, or anything after it. Zam now waits for sync to catch up before jumping to the message.
- **Voice calls failing to start:** starting a call could fail with "fetchClientWellKnown is not a function". Settings also wrongly reported that your server had no call server.
- **Calls showing as "Call ended" right away:** a call you started could show as already ended in the chat and leave you looking like you weren't in it. Calls now show as ongoing until everyone leaves.

🔧 **Changed**

- **Ringing:** calls now ring using the newer call notification format, so calls from Element X and other current clients ring in Zam, including on Android with the app closed. Rings from older Zam versions still ring too, and a ring that arrives after the caller gave up no longer rings.

## v1.12.10

🔧 **Changed**

- **Electron 44:** the desktop app now runs on Electron 44. macOS 12 (Monterey) is no longer supported.
- **Flatpak permissions:** the Flatpak no longer needs read access to your whole home folder. Drag-and-drop now hands files over through the desktop portal instead.

## v1.12.9

🐛 **Fixed**

- **Stuck on "Reconnecting" (sliding sync):** an error while processing an update could stop syncing for good until the app was restarted. Zam now restarts syncing on its own.
- **Messages vanishing after opening a notification:** opening a room from a notification could show the newest messages and then drop them when sync caught up.

🔧 **Debug**

- **Sync log:** Settings → Debug Info now keeps a short sync log you can copy, to help track down connection problems.

## v1.12.8

🐛 **Fixed**

- **Drag-and-drop attachments in the Flatpak:** files dragged in from outside your Downloads folder now upload instead of silently failing.
- **Settings that didn't apply:** the taskbar flash option no longer shows in the browser or on Android, the MIDI "System" sound bank is only offered in the desktop app, and on Android the notification permission row now actually asks for permission instead of saying notifications aren't supported.
- **Classic blurple:** buttons, your own message bubbles and the light theme's accent use classic blurple again instead of Discord's newer, more purple shade.

## v1.12.7

🐛 **Fixed**

- **New messages not showing up:** after a brief network drop, or when coming back to the app (for example from a notification), new messages could take up to two minutes to appear. Zam now reconnects right away.
- **Messages out of order with sliding sync:** when several messages arrived in a room you weren't viewing, the ones in between could end up above older history instead of at the bottom.
- **™ ® ©:** `:tm:`, `:registered:` and `:copyright:` (and picking them from the emoji picker) now insert the plain symbols instead of the emoji versions, and the emoji versions sent from other apps show as plain symbols.

## v1.12.6

🐛 **Fixed**

- **Custom emoji when editing:** custom emoji typed into the edit box now show up as emoji instead of `:text:`, and emoji already in the message are kept.
- **Plugin sync:** pulling your plugin setup now also installs and turns on plugins from repos that you had on your other device, instead of only syncing their settings.
- **`:tm:` and other emoji names:** emoji names work like Discord. Typing `:tm:` turns into ™️ as soon as you type the closing colon, and autocomplete finds emoji by their short name.
- **DM pictures:** direct messages without their own picture now show the other person's avatar.
- **Window size and position:** the desktop app now remembers its size, position and whether it was maximised. On Wayland, the position is still chosen by your desktop.

## v1.12.5

✨ **New**

- **Flatpak:** Zam is now available as a Flatpak from its own repository. Install it from https://az4521.github.io/Zam/ (or with `flatpak install --user https://az4521.github.io/Zam/zam.flatpakref`), and it updates through `flatpak update`. A `.flatpak` file is also attached to each release.

## v1.12.4

🐛 **Fixed**

- **Editing image text on desktop:** the text on a sent image, video, or file could only be edited from the phone menu. The Edit button now shows up on desktop too, and swipe or double-tap to edit works on these messages.

✨ **Changed**

- **Edit in the mobile message bar:** on your own messages, Edit now sits in the quick-actions bar in place of Thread. Thread is still in the ⋯ menu.

## v1.12.3

🐛 **Fixed**

- **Can't edit the text on a sent image:** when you sent an image, video, or file with a message attached, the message text couldn't be edited afterwards. You can now edit it like any other message (and clearing it removes the text while keeping the attachment).

## v1.12.2

🐛 **Fixed**

- **Videos not playing in Tor Browser:** videos in the timeline failed to load in Tor Browser (and briefly after a hard reload) because they depended on a background helper that isn't available there. They now load directly and start playing while they download.

## v1.12.1

🐛 **Fixed**

- **Rooms disappearing when switching spaces:** switching to a space briefly hid its unjoined rooms and the contents of its sub-space categories until they loaded again. The last known list now shows straight away (also right after startup) and refreshes in the background.

## v1.12.0

✨ **New**

- **Calls work like phone calls on Android:** calls keep going with the app in the background or the screen off, and show an ongoing-call notification with Hang up. Calls are registered with Android's calling system, so a Bluetooth headset, your car or a watch can answer, decline and hang up, and the headset's mute button works.
- **Cellular calls put Matrix calls on hold:** answering a phone call mutes the Matrix call both ways instead of fighting over the microphone. Tap Resume in the call view when you're done.
- **Speaker button:** in a call on Android, switch between speaker and earpiece (or your headset). The screen turns off when you hold the phone to your ear, and turning on your camera moves the call to the speaker.
- **Ringing like a phone:** an incoming DM call rings until you answer or decline, wakes the screen and shows over the lock screen. On Android 14 and later, Settings → Voice & Audio offers to allow lock-screen calls if Android hasn't. Pressing a volume key silences the ring without dismissing the call.

🐛 **Fixed**

- **Only DMs ring:** calls in rooms and spaces no longer ring, on Android or with web push. They show a normal notification instead, matching the app.
- **Ringing setting on notifications:** with "Ring for incoming DM calls" turned off, a DM call now shows a quiet notification instead of ringing.
- **Calls answering themselves:** a DM call arriving on a locked phone could join the call without you pressing Accept. It now just rings.
- **Reply and Mark as read on Android 12+:** these notification buttons did nothing. Reply now opens the app and sends your message, and Mark as read works without opening the app, respecting private read receipts.
- **Repeated notification actions:** reopening the app from Recents could re-send a quick reply or re-join a call. Each action now runs only once.

## v1.11.0

✨ **New**

- **Sub-spaces as categories:** inside a space, its sub-spaces now appear as collapsible categories in the room list, nested like a tree, instead of separate spaces you had to switch into. Rooms you haven't joined show up in place with a Join button, and a collapsed category shows an unread dot. Joined sub-spaces no longer take up their own icon on the space bar.
- **Resizable room list:** on desktop, drag the edge of the room list to make it wider or narrower (or use the arrow keys on it; double-click resets). Long room names show in full on hover.
- **Instant room list on startup:** the room list from your last session is shown right away while the app syncs, with both regular and sliding sync, then quietly replaced with the live list. It is deleted when you sign out.
- **MIDI sound bank:** Settings → Messages & media → MIDI lets you choose which sound bank MIDI attachments play with: your system's (desktop), the included one, or your own SF2/SF3/DLS file.

🐛 **Fixed**

- **Reordering spaces:** dragging a space on the space bar sometimes dropped it one slot above where you let go, or sent it to the top, especially near the bottom of the list. It now lands where you drop it.

## v1.10.2

🐛 **Fixed**

- **Messages that looked failed but had sent:** if the app closed right after you sent a message, it could come back marked as failed even though it had been delivered, and when the real message loaded the whole room's chat log could stop showing with a duplicate key error. Delivered messages are now recognised and cleaned up, and a room can no longer be broken by a repeated message.
- **Opening a room from a notification:** tapping a notification could open the room frozen on the notified message, with newer messages never loading. The room now opens in its normal live view when it can, and otherwise keeps loading newer messages until it catches up.
- **Loading older messages:** scrolling to the top of a room sometimes did nothing, with no spinner, even though older messages existed. Failed loads now retry, and reaching the top always asks again.
- **Messages disappearing after switching rooms:** after the app reconnected or resumed while you were in another room, coming back could show only the newest messages with no way to scroll back. Older history loads again as you scroll up.

## v1.10.1

🐛 **Fixed**

- **Space and room emoji with sliding sync:** custom emoji and sticker packs from spaces and other rooms were missing from the picker while sliding sync was on, because only the open room's packs were loaded. Packs now load for every room.

## v1.10.0

✨ **New**

- **Native OAuth 2.0 / OIDC sign-in:** on homeservers that publish an OAuth API (Matrix Authentication Service, e.g. matrix.org), the sign-in form leads with "Continue" and signs you in on the server's own page, using the authorization-code flow with PKCE. Access tokens are short-lived and refresh in the background; the session survives restarts and account switching, and signing out revokes the tokens at the provider. Servers without it keep the password and single sign-on options, and so does a server that refuses to register Zam.
- **Account page link:** on an OAuth account, Settings → Account and Security & Sessions point to your provider's account page for the password, other sessions and deactivation, instead of the in-app forms that can't work there.
- **Single sign-on:** the sign-in form reads the server's login options and offers "Continue with {provider}" or "Continue with SSO" (OIDC, OAuth, SAML, CAS). Password fields are hidden on servers that don't accept passwords. It works on the web, in the desktop app and on Android.
- **Languages:** the whole interface is now translatable. English, French, German and Assyrian Neo-Aramaic (Suret) are included, with a language picker in Appearance settings. Right-to-left languages mirror the layout inside each panel. The translations are machine-drafted and need review by native speakers.
- **Sliding sync:** faster startup and room list on servers that support it, now on by default on the login form. Servers without it fall back to regular sync with a notice. Debug settings show the sync mode and progress.
- **MIDI attachments:** `.mid` files now play. On desktop they use your operating system's sound bank, otherwise a bundled General MIDI bank (Phoenix MT-32 by W.D. Tharinda Perera, credited under Settings → About → Credits), with a simple synth as a last resort.
- **Emote packs:** enable packs for all your rooms and manage them in Settings → Emotes. You can edit a pack's avatar and attribution, delete packs, and copy images into your own pack.
- **Typing indicators:** Settings → Privacy & Safety has a new option to stop sending your typing status.

🔒 **Security**

- Devices that aren't cross-signed are now excluded when encrypting, and you are alerted when someone's cross-signing identity changes, with actions to accept or withdraw. A toggle in Session settings turns the exclusion off for testing.
- Single sign-on: sign-in buttons stay disabled until the typed server address has been checked, and a forged or stale callback link can no longer cancel a real sign-in.

🎨 **Polish**

- Appearance: the layout toggles have their own heading.
- Image uploads now record their dimensions and size.

## v1.9.2

🎨 **Polish**

- Profiles and status: emoji in statuses, bios, pronouns and presence messages now show as the same emoji images as in chat, on the profile card and in the account menu.

## v1.9.1

✨ **New**

- Profile: the timezone picker is now two steps. Choose a region (Europe), then a city (London).

🐛 **Fixes**

- Account menu: setting a status now has a Back button, like the presence and account lists.
- Profile card: a status that this app also writes to your presence message no longer shows twice.

## v1.9.0

✨ **New**

- **Extended profile:** Settings → Account has a new "More about you" section with pronouns, status, bio, timezone, banner, links and username colour. It needs a server that supports extended profiles, and honours the server's rules about which fields you may set.
- **Username colour:** pick one colour for dark themes and one for light. Names in the chat use it, and it falls back to the normal colour when it would be hard to read. Settings → Appearance → Show name colours turns this off.
- **Other people's profiles:** the profile card now shows their banner, pronouns, status, bio, local time and links. A banned user's extra fields are hidden.
- **Call status:** your profile shows "In a call" while you are in a voice call, and other people's cards show how long they have been in one. Settings → Account → Show when I am in a call turns it off. A leftover from a crash is cleaned up on the next start.
- **Account menu redesign:** the menu above your name at the bottom left is now a profile card with your banner, avatar, status and presence. It has Edit Profile, a presence menu and Switch Accounts. Click the bubble beside your avatar to set a status, with an emoji picker.
- **Status in other clients:** your status is also written where Sable and Commet look for it (Commet's status field and your presence message), so it shows up there too.
- Debug: Settings → Debug shows your raw extended profile and presence message as the server returns them.

🐛 **Fixes**

- Presence: a status message you cleared no longer sticks around in the app until you reload.
- Presence: changing your presence (Online, Away, Invisible) no longer wipes your status message on servers that clear it.

## v1.8.5

🐛 **Fixes**

- Chat: ©, ® and ™ now show as normal text instead of black emoji images that were unreadable on the dark background.

## v1.8.4

🐛 **Fixes**

- Windows: the taskbar button shows the Zam icon even when an old or broken Start menu shortcut for the app exists. The app now tells Windows which icon to use instead of relying on that shortcut.

## v1.8.3

✨ **New**

- Desktop: a red dot appears at the top right of the tray icon while you have unread pings, like the browser tab icon.

🐛 **Fixes**

- Desktop: pings now show a system pop-up. Notifications are posted by the desktop app itself, and clicking one brings the window back and opens the room.
- Desktop: the taskbar icon no longer shows as blank in installed builds. The icon files are now unpacked so Windows can read them.

## v1.8.2

✨ **New**

- **Desktop alerts setting:** Settings → Notifications → Desktop alerts chooses which notifications show a pop-up and flash the taskbar: loud only, silent and loud (the default), or none. Silent notifications no longer make the system chime.
- Desktop: the taskbar button flashes (the dock icon bounces on macOS) when a notification or incoming call arrives while the window is in the background.

🎨 **Icons**

- Android: the notification icon is much bigger, filling the status bar slot instead of sitting in a padded box.
- Desktop: the app now has a proper taskbar icon on Windows, with hand-sized icons from 16 to 256 px so small sizes stay crisp everywhere.
- Desktop: the tray icon is the white logo with a black outline, so it shows on light and dark taskbars alike.

## v1.8.1

🔒 **Privacy & security**

- **Attachments you send into an encrypted room are now encrypted:** images, files, videos and voice messages. Encrypted videos, yours and other people's, play in the timeline and the media browser.
- **Plugins with auto-update off stay frozen:** an installed repo plugin is pinned to the exact commit you installed or updated it at, and a cleared cache refetches that same commit. A plugin can't install under the id of a built-in or another repo's plugin.
- Hardened message rendering: an emoji inside a link address can no longer break out of the link.
- Sharing into the web app accepts only same-origin share requests, and caps them at 20 files, 100 MB per file and 200 MB in total. The share sheet says when it dropped files.
- Desktop: the built-in file server handles malformed addresses safely, and links to local or private network addresses no longer open in your browser.

📲 **Sharing & notifications**

- **Share-sheet Send sends only what the sheet shows.** Your unsent draft, staged files and armed reply in that room stay where they were. If the send fails, the share is staged in the composer instead of lost.
- Notification Mark as read respects private read receipts, even with the app closed.
- A quick reply from a notification goes into the thread when the message was in a thread. A reply that fails to send comes back as a draft with an error, and a reply typed with the app closed is kept as a draft for next launch.
- A call ring notification no longer replaces or dismisses a message notification from the same room.

💬 **Messages**

- A failed delete shows an error and the message comes back, instead of vanishing until reload.
- Swiping sideways inside a wide code block scrolls it instead of starting a reply.
- Swiping your own image or file replies instead of trying to edit it.
- Links in your own message bubbles are readable, and the read-receipt button is easier to hit.
- Switching rooms is faster: a message builds its action bar only when you hover, focus or select it.
- Touch scrolling through messages is smoother, because message rows no longer hold up the scroll to check for a swipe.
- Plugins that rewrite your outgoing messages now also apply to thread replies and file captions.

🪟 **Menus & dialogs**

- Escape and the Android back button close only the top overlay: the read-receipt list, What's New, the screen-share quality menu, the who-reacted sheet, plugin popovers and the composer "+" menu now all behave the same way.
- The image and video viewer shows your place in a gallery, such as "2 of 5", and screen readers announce it as you step through.

📞 **Calls**

- Leaving a call while it is still connecting no longer shows an error.
- A call that fails to connect shows one error, not an extra "disconnected" message.
- Changing noise suppression or other mic settings keeps your chosen microphone.
- A failed mic or camera switch goes back to the previous device and tells you.
- Screen-share quality changes apply to the running share, and the lower-quality stream gets its own bitrate. The system-audio toggle says it applies to the next share.
- Kick and Ban from a call tile ask you to confirm first.
- Screen readers announce the status badges on call tiles.
- Joining a call without a usable microphone tells you why: access is blocked, no microphone is connected, or another app is using it.
- Leaving a call is faster, and a camera or screen-share failure that lands after you leave no longer shows an error.
- Voice & Video settings no longer create a new audio context on every call update while you are in a call.

⚙️ **Settings**

- The sidebar and room list no longer clip at large text sizes.
- Deleting a theme preset and removing a plugin ask you to confirm first.
- If a custom font can't be saved on this device, the app tells you.
- The tray settings no longer show on the web, and settings search announces how many results it found.
- In settings search, Escape clears what you typed before it closes settings, and Enter opens the first result.

🧰 **Maintenance**

- Dependency updates within their current versions. Known security advisories went from 22 to 4 low-severity ones.
- Release builds now run type checks, tests and a formatting check first.

## v1.7.4

✨ **New**

- The image viewer shows the file's name in the top-left corner, and hovering an image in chat shows it as a tooltip.

🐛 **Fixes**

- The settings sidebar (app and room settings) scrolls when its tabs don't fit.
- Custom emoji reactions, picker grids, member lists and other homeserver images now load in browsers without service workers, such as Tor Browser.

## v1.7.3

🐛 **Fixes**

- Downloading from the image viewer keeps the original filename instead of saving as "image".
- Downloads with no file extension get the right one added, so they open correctly.

## v1.7.2

🐛 **Fixes**

- Desktop: right-click "Save image as…" now saves the actual image (full size, with its filename) instead of a JSON error file.

## v1.7.1

✨ **New**

- **Rename attachments before sending:** tap a queued file in the composer to edit its filename, like Discord.
- **Right-click menu on desktop:** open or copy links, copy or save images, cut/copy/paste in the composer, and spelling suggestions.

🐛 **Fixes**

- Downloading images and files now works on Android; they save straight to your Downloads folder.
- Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) undo and redo in the message box.
- Ctrl+E (emoji), Ctrl+G (GIFs) and Ctrl+S (stickers) open their pickers again, including from a thread's composer.
- The Home button is back to classic blurple.

## v1.7.0

✨ **Animations & UI**

- Subtle fades when you switch rooms and settings tabs, and desktop popovers scale-fade in. Everything respects reduce motion.

📞 **Calls & voice**

- **Device submenus in the call menu:** expandable Input/Output rows let you switch mic and speaker without leaving the menu.
- **Deafen shown on your own tile:** your roster row now carries the deafen icon.
- **Snappier mic meter:** the input level bar uses a fast-attack/slow-release envelope (no more symmetric smear), so it tracks your voice honestly.
- Picking "Default" mid-call now switches to the current system default mic.
- Screen share biases the encoder toward detail and maintaining resolution.
- Leaving a call briefly keeps a solo "Join" affordance (recently-left window) so you can hop back in.
- The screen-share quality popover closes when you stop sharing from the OS.

📲 **Share into Zam**

- Reworked receive flow: a full-screen preview with per-file rows, a caption field, a recent-rooms list, and one-step send. Nothing sends automatically.

⚙️ **Settings & appearance**

- Your **custom font now applies app-wide**, not just to messages.
- Settings tidy-up: link-preview media policy moved to Privacy & Safety, keep-sidebar and hold-to-open moved to Appearance/Messages, and search was reindexed for the new spots.

✨ **Polish & fixes**

- Reverted the in-app top-bar accent tint from 1.6.0.
- Display names drop the disambiguation/Matrix-ID suffix in default mode; per-member ID lines follow the "show Matrix IDs" toggle.
- Rightward row-swipe reliably opens the channel drawer instead of starting a reply.
- Arrow-key roving focus in the room notification options.

## v1.6.0

🖥️ **Screen sharing**

- **Quality picker in the share flow** — choose resolution (720p–4K), FPS (15/30/60) and system audio right where you start a share, and change quality mid-share from your own tile. Your last pick is remembered; the old Settings section is gone.
- **Quality actually applies now** — the chosen resolution/FPS drives the published stream. Previously the stream was always down-encoded to a conservative default no matter what you picked.

⚙️ **Settings overhaul**

- **Grouped settings** — Discord-style sections: **Account** (Account · Security & Sessions · Privacy & Safety), **App** (Appearance · Messages & Media · Notifications · Voice & Video · Emotes), **Advanced** (General · Plugins · Server · About · Debug).
- **Settings search** — type to find any setting; it jumps to and highlights the match.
- **Custom font** — upload your own font (.woff2/.ttf/.otf, one slot, stays on this device) and use it for messages.
- **App-wide text size** — the text-size slider now scales the whole app, not just messages, with a Reset button.
- **Per-room notifications moved home** — set a room's (or a space's, applied to all its rooms) notification level in its own Room Settings. The per-room list in global Settings and the Room Order section are gone (reorder lives in the room list).

📞 **Calls**

- **Call member menu** — switch your mic/speaker mid-call from your own menu, hide someone's video just for you, or mention them in chat. The kick button now says what it does ("Kick … from room").
- **Tile status & animations** — tiles show mute/deafen, local-mute and multi-device badges, and animate in/out on join/leave (respects reduce motion).
- **No more Join flash** — leaving a call alone no longer flashes a bogus "Join Call" button.
- **Device selection honored** — voice/video now uses the exact mic and camera you picked in Settings.
- **"Join calls" permission row** — control who can join calls from room Permissions.

📲 **Share into Zam**

- Zam now appears in the Android share sheet and as a PWA share target. Share text, links or images from any app, pick a room, and review before sending — nothing sends automatically.

✨ **Polish & fixes**

- **What's New** — a one-time popup after updates, plus release notes in Settings → About.
- The image lightbox pages through a burst of image uploads with arrows (and still pages inline images).
- Subtle open animations for dialogs, sheets and the lightbox — all respect reduce motion.
- The top navbar is tinted with your theme's accent color.
- Media device dropdowns are sorted alphabetically.
- Fixes: context menu reopens on a second right-click, participant-menu Profile works (+ volume %), read receipts no longer overlap right-aligned bubbles, reselecting the Plugins tab returns to the plugin list.

## v1.5.1

**Mobile & touch**

- **Swipe to reply / edit** — swipe a message left to reply; swipe your own message further to edit. The button morphs from a reply arrow to a pencil as you go.

**Fixes & platform**

- **Samsung One UI keyboard** — word suggestions work again in the composer.
- **Desktop: minimise-to-tray toggle** — a setting to choose whether the X closes to the tray (default) or quits Zam.

## v1.5.0

🧩 **Plugins (new!)**

- Zam now has a full plugin system. Install plugins from GitHub repos or use the built-ins — all from **Settings → Plugins**. Each plugin has its own settings, and you can optionally sync your enabled plugins + settings across your devices.
- Built-ins: fun slash commands (`/shrug`, `/tableflip`, `/me` …), double-tap-to-reply, a text replacer, and the GIF & sticker pickers.
- Plugins can add slash commands, composer buttons, message actions, custom link embeds, side panels, and keyboard shortcuts — through a documented `zam` API.

🎨 **Appearance**

- **Message text size & font** — set your size and pick a bundled font (Inter, or the high-legibility Atkinson Hyperlegible). Per-device.
- **Right-aligned own messages** — opt into an iMessage/WhatsApp-style layout where your messages sit in a coloured bubble on the right. Off by default; the bubble colour follows your theme.
- A dedicated **Theme** settings tab.

📱 **Mobile & touch**

- **Hold-to-open** the message menu — switch between tap and long-press.
- A **⋯ overflow menu** for the less-used message actions.

🔔 **Notifications**

- Tapping a notification now **jumps to the exact message**, not just the room.
- **Quick-reply and mark-as-read** straight from a notification (web + Android).
- Launching from a notification opens the right room/message even on a **cold start**.
- Unanswered **call rings auto-dismiss** instead of lingering.

🖼️ **Media**

- **Page through a message's images** in the lightbox (arrows / arrow keys).
- **Instagram thumbnails are clickable** now — tap to open the reel.

🧰 **Other**

- **Room / Space ID** field with a copy button in Settings → General.
- A **"+" on the space rail** to create a space; fixed the empty room-header menu.
