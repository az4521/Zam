# Changelog

Human-readable release notes. The `## v<version>` section for the released version is pulled into
the GitHub release body automatically (see `.github/workflows/release.yml`); the auto-generated
commit list is appended below it.

## v1.55.1

✨ **New**

- **Load a whole folder of local plugins:** picking a folder that has no `manifest.json` of its own now loads every subfolder that does, each as its own local plugin. Reload re-reads just that plugin, and one plugin failing to load no longer stops the others.

🐛 **Fixed**

- **Voice calls on lossy connections:** audio redundancy is now sent only while someone in the call is losing packets, instead of always. On a clean connection that saves bandwidth; once anyone reports loss, everyone's mic sends redundancy until the link has been quiet for about 30 seconds. In unencrypted calls this switches RED on and off, which briefly restarts your mic stream when it changes.
- **Unintelligible voices over ~5% packet loss in encrypted calls:** encrypted calls could not use RED at all and fell apart on bad connections. Zam now carries copies of the previous audio frames inside each packet while loss is reported, and rebuilds lost frames on the other end. In testing with 10% of frames dropped, concealed (guessed) audio fell from about 10% to under 1%, for roughly 20 kbps extra while it is active. Other clients in the call are unaffected, and a bad listening connection now also triggers it for the people they are listening to. This works in Chromium-based browsers and the desktop app.
- **Icons:** the encryption setup badge no longer uses a lock emoji, and close, warning, expand/collapse and status controls across the app use matching icons instead of text symbols. "Copied" and "selected" labels show a check icon beside the text.

## v1.55.0

✨ **New**

- **MIDI plays instantly:** MIDI files now stream through the built-in synthesizer as they play, instead of being converted to audio first, so playback starts at once with its own seek bar and volume. Playing another MIDI pauses the first and remembers where it was. Phones use lighter synth settings, so MIDI should play more smoothly on mobile.
- **Lightbox zoom:** zoom images with the mouse wheel, the `+` / `-` keys (`0` resets), a double-click, or the new zoom buttons, up to 16×.
- **Resizable Flash player:** Flash embeds open larger and have a resize grip in the corner (drag it, or use the arrow keys; double-click resets). Zam remembers the size you chose.

🐛 **Fixed**

- **MIDI files with an uppercase extension:** files like `SONG.MID` now embed and play, including ones already sent.
- **Flash volume:** the volume you set in a Flash player is remembered for the next one.
- **SVG images:** SVGs that only declare a viewBox or a tiny size no longer show up tiny in the timeline and viewer, and SVGs that use HTML entities such as `&nbsp;` now display instead of failing. Images that fail to load in the viewer are retried.

## v1.54.17

🐛 **Fixed**

- **Green, sheared video on NVIDIA in the Flatpak:** on Linux with an NVIDIA GPU, 1080p video (and anything whose width isn't a multiple of 256) could play as a green band with diagonal smearing. Hardware-decoded frames are now laid out the way NVIDIA's Vulkan driver reads them. If a different NVIDIA driver misbehaves, `NVD_LINEAR_PITCH=256` restores the old layout.
- **GIF picker crashes and green corruption:** the picker started every GIF result at once, which could use up the GPU's video decoders. Only the GIFs near the visible part of the picker play now.

## v1.54.16

🐛 **Fixed**

- **iOS app after an update:** reopening Zam after a new version no longer gets stuck on "500 Internal Error". It now waits for the network, clears the old cached copy and reloads into the new version.
- **Duplicate and own-message notifications on iOS:** notifications for messages you sent, and a second copy of the same notification, are now suppressed. Old leftover push registrations from this device are cleaned up.
- **Windows updates:** "Restart to apply" now installs silently and reopens Zam. A version that failed to install is no longer re-applied automatically, and Zam keeps an update log.
- **Windows portable build:** it no longer tries to install an update it cannot apply and points to the release page instead.
- **Crashes when switching windows on Windows:** Zam now recovers a crashed window by reloading it and records what went wrong in a log file.

## v1.54.15

🐛 **Fixed**

- **"Listening to" in the Flatpak:** the Flatpak could not see media players on the system, so what you were playing never showed in your presence. It now has permission to read media players over MPRIS.

## v1.54.14

🐛 **Fixed**

- **Games run through Proton or Wine are detected:** on Linux (including the Flatpak), Steam games that run as Windows programs were never recognised by game scanning, so no activity showed. Zam now matches them and ignores Wine's own system programs.
- **Games in folders with spaces are detected in the Flatpak:** native games under paths like `steamapps/common/Hollow Knight` are matched.
- **Scanning recovers after a failed host check:** a slow first permission check no longer turns scanning off until Zam restarts.
- **Steam icons for scanned games on Windows:** the game's own Steam icon is used, and a Discord icon that fails to load falls back to the program's icon.

## v1.54.13

🐛 **Fixed**

- **Rooms and DMs coming back as unread:** encrypted rooms (including DMs) could show as unread again after you read them, because the server's unread count overwrote Zam's own count whenever the room appeared in a sync update. Zam now keeps its own count for encrypted rooms.
- **Failed read receipts are retried:** if sending a read receipt failed, Zam still treated the room as read until the next reload, when it came back unread. It now retries the next time you read the room, and clears the room's notification dot once the receipt goes through.

## v1.54.12

🐛 **Fixed**

- **Game icons for Steam games on Linux (Flatpak):** a Steam game such as Satisfactory, run through Proton, showed the default application icon in your rich presence. Zam can't see Steam's files from inside Flatpak, so it now reads the game's own Steam icon from the host, finding the game from its install folder or from the app id Steam records as running.

## v1.54.11

✨ **New**

- **Mute and unmute sounds for others in a call:** you now hear the mute or unmute sound when someone else in the call mutes or unmutes their microphone.
- **Soundboard rate limit setting:** a new "Soundboard interval" slider in Debug settings sets the shortest gap between one person's soundboard sounds. The default is now 1.5 seconds, up from 0.4.

🐛 **Fixed**

- **Voice messages on mobile:** tapping Record Voice Message closed the recorder immediately, before it asked for the microphone, so nothing was ever recorded. The recorder now stays open. It also starts more reliably on devices that reject the preferred audio format, and if it still fails the error now names the cause.
- **Soundboard sounds that arrive late are dropped:** a sound that has not started within 3 seconds of arriving, for example while it downloads on a slow connection, no longer plays over a conversation that has moved on.
- **Call audio:** microphone audio is now sent with the voice preset and redundancy instead of the music preset, which holds up better on lossy connections. Normalizing incoming voices boosts quiet speakers by at most +12 dB (down from +18 dB), raises them more slowly, and ignores quiet noise more strictly, so it no longer jumps too loud too quickly.

## v1.54.10

🐛 **Fixed**

- **Voice message recording on Android:** if the microphone could not start recording, the mic indicator stayed on with nothing recorded and no message. Zam now shows an error and releases the mic, keeps recording even when the level meter cannot start, and no longer gets stuck before the preview when the waveform cannot be generated.

## v1.54.9

🐛 **Fixed**

- **Volume is remembered between videos and audio:** the volume (and mute) you set on a video or audio player is now saved on your device and used by the next one, in messages, the fullscreen viewer and link-preview videos, instead of every player starting at full volume. GIF-style videos and voice messages are unchanged.
- **DM previews show your message right away:** the line under a DM's name in the room list now updates the moment you send a message, instead of waiting for the server to accept it, so it no longer lags behind the chat.

## v1.54.8

✨ **New**

- **Cover art for what you're listening to (desktop):** the track you share with "Report media playback" now shows its album cover on your profile where the player provides one (Windows media controls, Spotify and Linux players). When there's no cover it shows the player's own icon instead, and when there's no icon at all the empty grey square is gone and the text takes the full width.

## v1.54.7

✨ **New**

- **Share what you're listening to (desktop):** a new "Report media playback" toggle in Rich Presence settings shows the track you're playing (title, artist, album and a progress bar) on your profile as "Listening to". It reads the system media controls on Windows and Linux (any player that reports to them, such as Spotify, browsers, VLC), and Spotify and Music on macOS. It's off by default and needs sharing to be on. Each player appears in the app list below with its own switch, so you can show Spotify but hide your browser, for example. Covers aren't shown yet. On macOS the first run asks for permission under Privacy & Security > Automation.

🐛 **Fixed**

- **Restart Discord automatically now works:** the setting added in 1.54.6 wasn't actually reaching the part of Zam that restarts Discord, so turning it on did nothing.

## v1.54.6

✨ **New**

- **Restart Discord automatically (desktop):** a new toggle in Rich Presence settings, under the Discord apps option. When Zam starts and Discord is already running ahead of it (so apps report to Discord and Zam never sees them), Zam closes and reopens Discord once so apps report to Zam. This ends any call or stream you're in, so it's off by default. Not shown in a Flatpak until host access is granted.

## v1.54.5

🐛 **Fixed**

- **Flatpak: game detection and Restart Discord work out of the box:** the Flatpak now asks for permission to run commands on the host, which it needs to list running games and to close and reopen Discord. You no longer have to run a `flatpak override` command first; update the Flatpak to get it.

## v1.54.4

✨ **New**

- **Additional room creators (room v12):** when you create a room or upgrade one to v12 or later, you can pick extra creators in a collapsed "Additional creators" section. Creators have unlimited power in a v12 room.
- **Creators stand out:** v12 room creators now show as "Creator" instead of "100" on profile cards and in room settings, get their own group above the admins in the member list, and can act on admins (nobody can act on a creator).

🐛 **Fixed**

- **Profile pictures load again on slow or mobile connections:** avatars and link-preview images are now fetched from the server already sized for where they are drawn (animated ones stay animated where the server supports it), instead of downloading the full-size original and shrinking it on your device. Images that fail to load are retried automatically a few times, and again when your connection comes back.
- **No false "beginning of the chat":** a room whose history hasn't loaded yet shows a "Loading older messages" line instead of the start-of-chat banner, which now appears only once the room's start has really been reached.
- **Long room names no longer grow the message box:** the "Message #room" hint stays on one line and is cut off with an ellipsis.
- **Room v12 links and detection:** links to v12 rooms (whose ids have no server name) now list several servers that can help others join, creators are recognised before a room's full state has loaded, and room versions after 12 are treated as having creators too.
- **Real game icons on Linux (desktop):** a game that Discord has no icon for no longer shows the stock executable icon. Zam now looks for the icon in the game's launcher (PNG or SVG), in Steam's library cache, and inside the game's Windows `.exe` (PNG or old bitmap icons), and shows no picture rather than a generic one when none is found.

## v1.54.3

✨ **New**

- **Rich presence apps are on by default (desktop):** apps and games that report to Zam are now allowed on your profile when first seen, so you no longer have to switch each one on. Turn off the ones you don't want in Settings > Account > Rich presence.
- **See how a game was found:** each app in the list says whether it came from Discord Rich Presence, the running-game scan, or both.

🐛 **Fixed**

- **Discord Rich Presence wins over game detection (desktop):** when a game reports its own activity, the entry guessed from the running process is dropped instead of being shown next to it, even if the two use different Discord app ids.
- **Stray green dot:** removed the decorative dot at the end of the rich presence row above the account button, which did nothing.

## v1.54.2

✨ **New**

- **Plugins can annotate messages and read attachments:** plugins can show their own text under a message (`zam.messages.annotate` / `refresh`, for example a transcript under a voice message), read a message's decrypted attachment with `zam.matrix.getMedia`, and see the message's `msgtype` in a message action's `when` and `onSelect`.

🐛 **Fixed**

- **Discord Rich Presence reaches Discord (desktop):** an app's activity is now passed on to the real Discord only after Discord has answered the handshake, so it no longer gets dropped. Apps that connect over WebSocket, such as browser-based ones, are passed on too.
- **App names in activity cards (desktop):** apps that don't name their activity show the name registered with Discord again, instead of "Discord app", and a lookup that failed is retried.
- **Restart Discord keeps its tray icon (Windows):** Discord's tray icon no longer goes missing after the restart; Zam clears the stale icon the old Discord leaves behind before it reopens it.
- **Notification ping no longer ducks other apps (Windows):** the ping plays on its own audio context and closes it afterwards, so it no longer leaves an audio stream open that dipped the volume of other apps, such as a video, after a ping.

## v1.54.1

✨ **New**

- **Discord keeps working next to Zam (desktop):** apps that report Discord Rich Presence now also reach a running Discord, so turning on Zam's Discord support no longer takes presence away from Discord itself. This works when Zam starts before Discord.
- **Restart Discord:** if Discord started first and apps report to it instead of Zam, Settings > Account > Rich presence offers a Restart Discord button (after a confirmation) that lets Zam take its place and then reopens Discord. Works on Windows, macOS and Linux, and from the Flatpak once `org.freedesktop.Flatpak` is allowed.
- **Pretend Discord is running:** some apps refuse to send Rich Presence unless a process named Discord exists. A new option starts an idle one, only while Discord itself isn't running.
- **Richer activity cards:** the party size ("3 of 4") now shows after the state, streaming, watching and competing activities say so, and apps that don't name their activity show the name registered with Discord instead of "Discord app".

## v1.54.0

✨ **New**

- **Timestamps in messages:** write `<t:UNIX>` (a Unix time in seconds) and everyone sees it as a date and time in their own time zone. Add a style such as `<t:UNIX:R>` for relative ("2 hours ago"), `:t` / `:T` for time, `:d` / `:D` for date, or `:f` / `:F` for date and time.
- **Space home page:** clicking the space you are already in opens its home page with the space's name, topic and your rooms, so you can get back to it after picking a room.
- **Warning before logging out your last device:** if it is your only signed-in session, Log Out now explains that its encryption keys will be lost and says whether your history is backed up, before it signs you out.
- **Rich presence tab:** Settings > Account has a Rich presence tab (desktop only), and General moves to the top of the App group. Games with no icon in Discord's list now show the icon of their running program.
- **Website and downloads (web):** the login page and About link to the Zam website, the app downloads and GitHub. They are hidden in the desktop and Android apps.

## v1.53.2

✨ **New**

- **Custom CSS:** Settings > Appearance has a Custom CSS box whose rules apply live, after your theme. If a rule ever locks you out of the app, open it with `?nocustomcss` to load it without your custom CSS.
- **Themes as plugins:** plugins can add their own stylesheet with `zam.ui.addStyles`, which is removed when the plugin unloads, so a theme can now ship as a plugin. An example theme plugin is available.

🐛 **Fixed**

- **Grey window after minimizing (desktop):** a window restored after being hidden or minimized for a while could come back as a blank grey page. The memory trim that caused it now only runs plain garbage collection.

## v1.53.1

✨ **New**

- **See what you're sharing:** a card above your account row shows each game or app whose rich presence is being published to your profile, like Discord's.

## v1.53.0

✨ **New**

- **Your own profile card:** it is the same card others see, with an Edit profile button and your sessions list. Clicking your avatar in the footer opens it.
- **Registered games:** Settings > Rich presence now has a single list of detected games and apps, with an allow toggle, when each was last played, and games you add by hand by picking a running program. Games that match Discord's list are allowed by default, and allowing a blocked app publishes it right away.

🔧 **Changed**

- **Smaller download:** Discord's list of detectable games is no longer bundled. It is downloaded the first time game detection or Discord RPC is used, stored compressed in your user data folder, and refreshed weekly.

## v1.52.6

✨ **New**

- **Rich presence (desktop):** show what you're doing, like the game you're playing or the music you're listening to, on your profile, and see it on other people's profile cards. It uses [MSC4544](https://github.com/matrix-org/matrix-spec-proposals/pull/4544), so Matrix apps can publish to it directly, and Zam also understands Discord Rich Presence, so apps and games that only talk to Discord work too. Zam can also detect running games on its own. Everything is off until you turn it on in Settings > General > Rich presence, and each app is blocked until you allow it. Game icons and cover art are fetched only from Discord and Spotify, shrunk, and uploaded once.
- **Game detection in Flatpak:** a Flatpak can't see your other programs, so "Detect games" there needs a permission that you grant yourself. Turning it on shows the command to run.

🐛 **Fixed**

- **Less memory in the tray (desktop):** once the window has been hidden or minimized for a minute (and no call is running), Zam frees memory the app no longer needs, about 10 MB on top of what Chromium already releases.

## v1.52.5

🐛 **Fixed**

- **Less memory from YouTube and tweet videos:** YouTube links and videos in tweets show a thumbnail until you press play, instead of loading a player for every one you scroll past. A played one that is paused and scrolled well away lets go of its memory and picks up where it left off when played again. "Pause videos when scrolled off screen" now pauses YouTube videos too.

## v1.52.4

🐛 **Fixed**

- **Hover times clear of messages:** the time shown when hovering a message sent in a run no longer runs right up against the message.
- **AM/PM in German:** 12-hour times say AM/PM instead of "vorm."/"nachm.".

## v1.52.3

✨ **New**

- **Memory over time (desktop):** Settings > Debug > GPU can record the memory report every few seconds while you use the app, then show how each part grew or shrank, copy that as text, or save every sample as a CSV.

🐛 **Fixed**

- **Steadier scrolling past links and media:** link previews hold their space while they load, cards whose site gives no image size are all one size, and messages scrolled away and back keep their size instead of growing again as their previews and images reload.

## v1.52.2

🐛 **Fixed**

- **Skia Graphite toggle on Linux (desktop):** the Settings > Debug > GPU switch did nothing on Linux; it now turns Graphite on there. The line under it now says whether Graphite is really in use, not just whether it was asked for.

## v1.52.1

⚡ **Improved**

- **Less memory in the background:** once the desktop app has been minimised or hidden to the tray for a couple of minutes, with no call and no video playing, it lets go of the graphics memory that playing videos left behind (often over 100 MB). It comes back by itself the next time it's needed.

## v1.52.0

✨ **New**

- **Latest message under each DM:** direct messages in the room list show the newest message, so you can see what was said without opening them.
- **Request keys:** locked messages have a button to ask your other sessions for the key again.

⚡ **Improved**

- **Lighter long sessions:** scrolling far back in a room no longer keeps every message on screen in memory, rooms you have left for a while let go of older history (it loads again when you scroll up), and cached images are released once nothing shows them.
- **Fewer background wake-ups:** timers that checked for work every few seconds now sleep until there is some.
- **Smaller desktop app:** the desktop app no longer ships a second copy of its libraries (over 200 MB less), and emoji take far less disk space.
- **Flash player updated:** Flash content now plays with Ruffle 0.7.1.

🐛 **Fixed**

- **Messages locked during verification:** messages sent while a session was being verified now unlock once it is verified, and failed messages show the usual locked placeholder instead of raw text.
- **One ping for a burst:** catching up on many messages at once plays one notification sound instead of one very loud one.
- **Safer Flash:** Flash content plays in a locked-down frame that cannot reach your account or the network.
- **DM names:** a DM created before the other person joined no longer stays "Empty room" until a reload.
- **Smaller Android app:** the Android app no longer carries the desktop emoji pack.

## v1.51.1

✨ **New**

- **Swipe the emoji picker away:** on phones, the emoji, sticker and GIF picker slides up and down, and you can swipe it down to close it.
- **Quick delete:** hold Shift while clicking delete on a message to delete it straight away, without the confirmation. Your own delete button now sits at the end of the message's buttons, in the same place as a moderator's.

⚡ **Improved**

- **Lighter animated images:** large animated GIFs and images are shrunk to the size they're shown at, so they use far less memory.

🐛 **Fixed**

- **Sheet animations:** profile cards now slide up like the other sheets, and sheets slide away instead of vanishing when you tap outside them.
- **Swipe from anywhere:** you can swipe a sheet down from anywhere on the screen, not just on the sheet itself.

## v1.51.0

✨ **New**

- **Swipe sheets away:** on phones, menus and other sheets that slide up from the bottom can be dragged down to close them, like in other apps.
- **Profile cards on phones:** tapping someone's name or avatar slides their profile up from the bottom, and you can swipe it away.
- **Full room description on phones:** tap the description under the room name to read all of it.
- **Camera, photos or files:** on mobile web, the + menu now has separate Camera, Photos & videos and Files options, so you no longer have to pick from your phone's menu every time.
- **Rooms in a space are open to the space:** a room you create inside a space can be joined by anyone in that space, without inviting each person.
- **Leaving as the last member:** if you're the only person in a room or space, Zam warns you before you leave that no one will be able to join it afterwards.

⚡ **Improved**

- **Swipe to reply:** the reply icon fades in and grows as you swipe, and the message springs back when you let go.
- **Sidebar:** joined and unjoined rooms now look the same size, "Browse rooms" lines up with the other headings, the sidebar says "Rooms" everywhere, and AMOLED mode has a thin line between the server list and the room list.

🐛 **Fixed**

- **Rooms you left in a space:** rooms you've left now show up under "Browse rooms" so you can join them again.
- **New rooms in Browse rooms:** a room in a space that becomes open to the space shows up within a minute, instead of up to five.
- **Changing someone's power level:** the member list now shows the new level as soon as it's saved.

## v1.50.0

✨ **New**

- **Repaint (desktop):** if parts of the window show up as black or white boxes, or in the wrong place, choose **Repaint** from the tray menu or in Settings > GPU to draw the window again from scratch. This can happen after running out of video memory, for example with a game open on NVIDIA under Linux. Calls keep going.

⚡ **Improved**

- **Encrypted images when switching rooms:** images you've already seen in an encrypted room show straight away when you come back to it, instead of downloading and decrypting each one again. The full-size image is fetched again only when you open it.
- **Less work while hidden (desktop):** Zam does less in the background while its window is hidden in the tray, and calls still ring promptly.

🐛 **Fixed**

- **Mic sound in calls:** your mic no longer goes through your system's voice isolation on top of Zam's own noise suppression, so calls now sound the same as the mic test in settings.

## v1.49.0

✨ **New**

- **Sound packs in every call:** a room's sound pack can now be offered in your calls everywhere, not only in that room. Turn it on with **Use in every call** on the pack in the room's settings, under Emotes > Soundboard.

⚡ **Improved**

- **Soundboard follows the updated proposal:** sound packs now use the same name rules as emoji (letters, numbers, dashes and underscores). If you type a name with spaces, it's saved with underscores, and what you typed is kept as the sound's description. Your existing sounds and packs keep working as they are, names included, and older versions of Zam still hear the sounds you play.

🐛 **Fixed**

- **Adding sounds to room packs:** uploading a sound to a room or space pack could fail on many servers. It now works.
- **Space sound packs:** packs from a room's spaces now show up in its calls without opening the space first.
- **Sound packs shown as emoji:** image packs meant for something else, such as another app's sound packs, no longer show up as broken emoji or stickers. Changing a pack's emoji or sticker settings in Zam no longer removes what other apps use it for.

## v1.48.1

🐛 **Fixed**

- **Direct file transfers between servers:** transfers no longer depend on the sender's server letting people from other servers send data through its voice server. Each side now only sends through its own server's voice server, the same way calls work, so transfers keep working on servers that follow the new Matrix rules for this.

## v1.48.0

✨ **New**

- **GPU acceleration for noise suppression:** FastEnhancer can now run on your graphics card, which takes most of its work off the CPU (about 7% of a CPU core instead of 16% in testing). It's on by default and adds about 11 ms of delay. Turn it off with the new **GPU acceleration** switch under the noise suppression setting in Settings > Voice & Video. If your GPU can't keep up, or can't run it, Zam switches back to the CPU by itself.
- **FastEnhancer Tiny:** a lighter noise suppression option between FastEnhancer and RNNoise. It uses about a third of FastEnhancer's CPU and still keeps your voice at a steady level. It runs on the CPU by default, where it's already as cheap as the GPU.

⚡ **Improved**

- **No CPU spent while muted or silent:** noise suppression now pauses after a quarter of a second of silence, including whenever you're muted, and starts again the moment you make a sound.

🐛 **Fixed**

- **No noise suppression on older browsers:** where FastEnhancer can't run, Zam now falls back to RNNoise as intended.

## v1.47.1

✨ **New**

- **Adaptive video quality:** a new option under Settings > Voice & Video, off by default. When it's on, each video in a call is received at the size it's shown, and video that's off screen (or while Zam is minimised) is paused. This saves download bandwidth and decoding work. It applies the next time you join a call.

🐛 **Fixed**

- **Doubled line breaks when pasting:** text pasted from Windows apps no longer shows every line break twice, in the message box or when editing.
- **GIF favourites order:** favourites in the GIF picker now stay in the order you saved them, left to right, instead of jumping between columns as they load.

## v1.47.0

✨ **New**

- **Memory report:** Settings > Debug has a Memory report button. It shows what is using Zam's memory, including video memory, by process and by what holds it. Copy it into a bug report if Zam is using more memory than it should.

⚡ **Improved**

- **Much less video memory:** in a busy room, Zam now uses well under half the video memory it did (about 190 MB instead of 460 MB in testing).
    - Profile pictures and room icons are now shrunk to the size they're shown at. A large profile picture used to take up to 30 MB every place it appeared. Animated ones still animate.
    - Link preview images and images in encrypted rooms are shrunk the same way. Opening one still shows it at full size.
    - Link previews of videos no longer keep the video loaded just to show its first frame.
    - A video you've played and paused is unloaded once you scroll well past it. Press play again and it picks up where it stopped.

## v1.46.4

🐛 **Fixed**

- **Memory use from GIFs:** GIFs embedded from Tenor, Giphy and Klipy now unload once you scroll well past them, and load again when you scroll back. Before, every GIF you had scrolled past stayed loaded until you left the room.

⚡ **Improved**

- **Video in calls:** your camera and screen share no longer upload video quality levels that nobody in the call is watching, which saves upload bandwidth and processing.

## v1.46.3

🐛 **Fixed**

- **Calls when graphics crash:** running out of video memory (a game using it, say) no longer drops the call every time Zam's graphics restart, and Zam no longer ends up stuck without the GPU until a restart. The call keeps going. If you're sharing your camera or screen, it reconnects once after graphics have stayed up for a while, to get hardware encoding back.
- **Favouriting embedded videos:** videos embedded from a link (Instagram and the like) can now be favourited, like images.

## v1.46.2

🐛 **Fixed**

- **Sending while viewing older messages:** after jumping to an old message, sending a message or attachment no longer loads everything up to the present and scrolls you down. The view stays where you were reading.

## v1.46.1

🐛 **Fixed**

- **Android notifications while Zam is open:** new messages no longer pop up a notification while you have Zam open on screen. Messages for another signed-in account still notify.

## v1.46.0

✨ **New**

- **Message link previews:** a link to a specific message (matrix.to or matrix: link) now shows a card with the sender, room, time and text of that message. Click it to jump to the message. Links to rooms you can't read stay plain links.

🐛 **Fixed**

- **iOS after an update:** reopening Zam from the background after a new version came out no longer shows "500 Internal Error". It now reloads into the new version by itself.
- **Replying from an older message:** sending while viewing a message you jumped to no longer scrolls you all the way to the bottom.

## v1.45.0

✨ **New**

- **Japanese:** Zam can now be shown in Japanese (日本語). Pick it in Settings > Appearance > Display language. Thanks to tsubotan1985 for the translation.
- **Rooms when you start offline:** if Zam starts with no connection, your rooms open and show their most recent messages saved on this device, instead of an empty pane. Encrypted rooms are decrypted from the keys on this device. Sending comes back on its own once the room has loaded.
- **Bot commands:** a slash command Zam doesn't know, such as a bot's `/model` or `/status`, can now be sent. The first Enter warns you it's unknown, in case of a typo; press Enter again (or tap send again on mobile) to send it as a message.

🐛 **Fixed**

- **Japanese, Chinese and Korean input:** typing with an IME in the message box or when editing a message no longer drops the text being converted.
- **Android keyboards:** tapping send while the keyboard is still underlining the word you're typing now sends that word too. Mention, emoji and command suggestions also keep up as you type instead of waiting for the end of each word.
- **Connection indicator:** the Offline / Reconnecting pill now appears at the top of the chat, under the room header, instead of on top of your name in the bottom corner (or the + button on mobile).

🔧 **Changed**

- **Language list:** languages in the picker are in alphabetical order.

## v1.44.0

✨ **New**

- **Login section in Settings > Account:** sign in another device from one you are already signed in on, without typing a username and password. Scan the new device's QR code, type the short code it shows, or (on servers that support it) show a QR code for the new device to scan.
- **Sign in with a typed code:** no camera needed. The new device shows a code under its QR code; type it in Settings > Account > Login > Enter a code from the new device. If several new sessions signed in at once you pick the right one.
- **Scan from the new device:** on servers that support the full QR protocol, the new device can scan a code shown by a signed-in one.
- **Android:** sign-in and account approval pages open in an in-app browser instead of the external one, and you return to Zam when sign-in completes.

🐛 **Fixed**

- **QR sign-in:** verifying the new device is retried for up to 90 seconds while it finishes starting up, instead of failing straight away, and a verification that still cannot start no longer shows as a failed sign-in.
- **QR sign-in:** the new device shows Logging in while the session starts, and a failure to start is reported instead of leaving a login form that looks stuck.

## v1.43.5

🐛 **Fixed**

- **New spaces:** creating a space now switches you into it instead of leaving you in the space you were in.

## v1.43.4

✨ **New**

- **QR sign-in button:** the button to sign in a new device by scanning its QR code is now at the top of Settings > Account, labelled Scan QR code to sign in a new device.
- **Clearer room reordering:** the reorder toggle in the room list now uses an up/down arrows icon, and the actions menu uses the burger icon.

🐛 **Fixed**

- **QR sign-in:** a new device that signed in successfully is no longer reported as a failed sign-in when verification could not be started; you are told to verify it from Settings > Sessions instead.
- **Permissions:** the reorder toggle is hidden in spaces where you cannot reorder rooms, and the emote and soundboard settings no longer show an add form you cannot use. The Add image form now matches the soundboard layout.

## v1.43.3

✨ **New**

- **Easier new spaces:** creating a space now also makes a general text room and a Voice room in it, and anyone you invite to the space can join both without a separate invite for each. Untick Add a text room and a voice room in the Create a space dialog to start with an empty space.

## v1.43.2

🐛 **Fixed**

- **Soundboard:** sounds played in an encrypted call are heard by everyone again. Since 1.43.0-era changes, other people's clients were dropping them, so only the sender heard the clip.
- **Read receipts:** a reader whose read receipt lands on an event the timeline hides (a state change, an edit, a reaction) now shows under the message just above it instead of disappearing.

## v1.43.1

✨ **New**

- **QR sign-in on more servers:** Sign in with QR code now also works on servers that do not support the full QR protocol, such as matrix.org. The new device shows a code, you scan it from Settings > Sessions > Link new device on a Zam you are signed in to, approve on your account's sign-in page, and then verify the two devices against each other. Servers that support the full protocol still sign in and verify in one step.

## v1.43.0

✨ **New**

- **Sign in with QR code:** on servers that support it (such as matrix.org), the login screen has a Sign in with QR code button. Scan the code from Settings > Sessions > Link new device on a Zam you are already signed in to, type the number it shows, and approve. The new session signs in and gets your encryption keys, so it is verified straight away.

## v1.42.12

✨ **New**

- **Message order hints toggle:** Settings > Debug has a new Message order hints switch. Turning it off stops Zam sending and obeying the order hints from 1.42.11, so messages show in the server's order exactly as in Element.

## v1.42.11

🐛 **Fixed**

- **Message order:** Zam no longer re-sorts messages by timestamp, which could put an answer above its question when the other person's server clock was off. Messages now show in the order the server gives them, as in Element.
- **Late messages:** your messages now carry a hint of what was at the bottom of your chat log when you sent them, and Zam puts a message that arrived late back below it. Other clients ignore the hint.

## v1.42.10

🔒 **Security**

- **Fake soundboard sounds in encrypted calls:** in an encrypted call, a soundboard message that arrived unencrypted is now ignored. Such a message could be injected by the call server with any participant's name on it.

## v1.42.9

🐛 **Fixed**

- **Notifications inbox in encrypted rooms:** messages from encrypted rooms all showed "Unable to decrypt" in the notifications inbox, even when you had the keys. They now show their real text, including the latest version of edited messages.

## v1.42.8

✨ **New**

- **GIFs show up on more servers:** many homeservers can't preview KLIPY, GIPHY or Tenor links, so those GIFs appeared as plain links. Zam now loads them straight from the site when your server can't.

🔧 **Changed**

- **Link preview media now defaults to All:** YouTube players, X/Twitter cards and these GIFs now load without a click, which means those sites see your IP address and when you read the message. Images on ordinary link previews still come through your homeserver. If you already picked a setting, it stays; to go back, choose Homeserver only in Settings > Privacy & Safety, where the description now spells out what each option does.

🐛 **Fixed**

- **Messages in order on sliding sync:** opening a small room on some servers, including matrix.org, could put older messages below the newest one. Messages that arrive a little late from other servers now also settle into place right away instead of after a reload. A message that turns up much later stays at the bottom, so you still see it.

## v1.42.7

🐛 **Fixed**

- **One tab per session:** opening the same account in a second tab could leave encryption keys out of step with the server and lose keys needed to read new messages. A second tab now waits and tells you the session is open elsewhere, then takes over when the first one closes. Different accounts can still run side by side in separate tabs.
- **Safer encryption startup:** Zam now checks this device's encryption keys before it starts syncing. If that can't be confirmed, it stops and asks you to check your connection instead of uploading keys that could cause decryption problems. Once a device has passed this check, it starts offline as usual.
- **Smoother call audio on Linux:** the desktop app and Flatpak now ask the system for realtime priority during calls, so your microphone keeps up when the computer is busy.

## v1.42.6

✨ **New**

- **Thread names are private in encrypted rooms:** a thread's name is now encrypted like the messages around it, so your homeserver can't read it. Renaming a thread still doesn't notify anyone using Zam. Update to this version to see names set from now on; older versions won't show them, and names set before this update keep working.
- **Choose who can name threads:** a new Name any thread setting on a room's Permissions tab sets the power level needed, 50 by default. People can always name threads they started.

## v1.42.5

✨ **New**

- **Run at startup:** the desktop app can now start when you log in to your computer. Turn it on in Settings > General > Desktop. It works on Windows (including the portable version), Linux, the Flatpak and macOS. In the Flatpak, your desktop may ask you to allow it the first time.

## v1.42.4

✨ **New**

- **Switch attachments to direct send:** the Edit attachment dialog has a Send directly toggle, so a file already in the composer can be sent directly, or a direct file turned back into a normal upload. It isn't available in threads.
- **Video previews in the composer:** queued videos show a thumbnail instead of a file icon, and the Edit attachment dialog has a larger preview that plays them.

## v1.42.3

🐛 **Fixed**

- **YouTube videos that said "This video is unavailable" now play in the desktop app:** music videos from big labels, for example, play the same as they do on Android. You no longer need the Fix YouTube Embeds plugin, and it has been removed from the plugin list.

## v1.42.2

🐛 **Fixed**

- **Direct files now get a final check before sending, like other attachments:** "Send a file directly" puts the file in the composer's attachment tray with a Direct badge, where you can rename or remove it, and the offer only goes out when you press send. "Send directly" on the over-limit message works the same way. Text you type goes out as a normal message just before the offer.

## v1.42.1

✨ **New**

- **Join a call without a microphone:** if your mic is unavailable because permission was refused, none is plugged in or it's in use elsewhere, you now join muted with a message saying why, instead of the join failing. You can listen and share your screen, and unmuting asks for the mic again.
- **Disabled camera option:** pick "Disabled" in the camera list to stop a running camera and hide the camera buttons and preview. Keybinds and system controls can't turn it back on.

🐛 **Fixed**

- **Mute status:** people with no open mic now show as muted to everyone, including people who have no mic at all.

## v1.42.0

✨ **New**

- **Send very large files directly:** choose "Send a file directly" from the composer's + menu, or "Send directly" when a file is over your server's upload limit. The file goes straight to the person who accepts it and is never stored on the server. It travels through your server's call service, end-to-end encrypted, and neither side sees the other's IP address. Both people need to be using Zam, and the sender needs to keep Zam open until the transfer finishes.
- **Works across devices:** the file is saved straight to disk as it arrives, so it doesn't have to fit in memory, on desktop, Android and in the browser. The Android app keeps going in the background with a notification while a transfer runs. In Safari the file needs room in the browser's storage first, and takes up twice its size for a while.
- **Every file is checked:** a file is only finished once its hash matches, and anything altered on the way is discarded. Withdrawing the offer, or deleting it, stops any transfer in progress.

🔒 **Security**

- **Soundboard sounds in encrypted calls are now encrypted:** the call server could previously read which sound was played.

## v1.41.0

✨ **New**

- **Picture-in-picture for calls:** when you leave the call view, a stream keeps playing in a small floating video, so you can read the chat and still watch. Drag it to any edge of the window, click it to go back to the call, or close it with the X. It shows someone's screen share first, then whoever is talking, and you can pick a stream by spotlighting it.
- **Pop a stream out of the app:** where your browser supports it, a new button on the floating video and on call tiles opens a window that floats over your other apps, and it stays open while you move around Zam. This isn't available in Firefox or the Android app, which still get the floating video.

🐛 **Fixed**

- **Less hiss on quiet voices:** voice normalization no longer boosts a quiet speaker enough to bring up their background noise during pauses.

## v1.40.4

✨ **New**

- **Soundboard clips play while they download:** a sound you haven't heard before starts playing right away instead of after the whole file arrives. This works for MP3, WebM, Ogg (Opus and Vorbis), FLAC, WAV and MP4/M4A audio.
- **Sounds are saved on your device:** once a soundboard clip has downloaded, it is kept (up to 64 MB) and every later play comes from your device, with no request to the server.
- **M4A sounds are prepared for streaming when uploaded:** like videos sent in chat, their index is moved to the front so listeners can start playing them straight away. Sounds uploaded before this still wait for the full download the first time.

## v1.40.3

✨ **New**

- **Soundboard button in the sidebar and the call banner:** the soundboard is now one click away from the call panel in the sidebar and from the call banner above a room's timeline, as well as from the call view, next to the other call buttons.

🐛 **Fixed**

- **Clicking the soundboard button again closes it:** it used to close and immediately reopen.

## v1.40.2

🐛 **Fixed**

- **Soundboard clips and boosted voices no longer slow down with OBS open:** call audio that goes through the audio mixer (soundboard clips, voices boosted above 100%, and normalized voices) played through a hidden element that the browser stretches to absorb timing drift. With OBS or other heavy audio software running, that made the sound play slow and then speed up to catch up. It now plays directly to your speakers where the browser allows it.

## v1.40.1

✨ **New**

- **Temporal layers for H.264 and HEVC video:** when your GPU encoder can produce them, camera and screen-share video in H.264 or HEVC is now sent with three temporal layers (L1T3), as VP9 and AV1 already were. Software encoders are left as they were.

## v1.40.0

✨ **New**

- **Soundboard for calls:** a new button in the call controls opens a soundboard. Click a sound and everyone in the call hears it, along with you. Sounds work like custom emoji but with audio: add your own under Settings > Emotes, or add them to a room or space in its settings, where everyone in it can use them in calls. "Add to mine" copies a room's sound into your own pack. Sounds can be up to 15 seconds and 1 MB.
- **Soundboard volume for each person:** every participant's menu in a call has a Soundboard Volume slider (0 to 500%), separate from their voice volume. Muting someone or deafening yourself silences their sounds too, and there's a slider for how loud your own sounds are to you.

## v1.39.1

🐛 **Fixed**

- **Other accounts' pictures in the account switcher load reliably:** the pictures of your inactive accounts were requested as the account you were using, so those on a different homeserver came back unauthorised and showed initials instead. Each one is now fetched with its own account's sign-in, from its own homeserver only. The same goes for the account list on the sign-in screen.
- **SVG images can no longer phone home when opened in a tab:** an SVG avatar or image could reference an outside image or stylesheet, which would reveal your IP to its sender if you opened it in its own tab. Zam now strips those references and keeps only the SVG's own drawing.

## v1.39.0

✨ **New**

- **Web UI updates without a reinstall (desktop and Android):** Zam now downloads signed updates to its interface in the background and applies them when it starts, when you're idle, or when the app goes to the background, never during a call. Updates that change the app itself still come as an installer or APK. Settings > Automatic updates controls downloading and applying.
- **Video codec info in Debug on web and Android:** Settings > Debug now lists which video codecs decode and encode on the GPU in the browser and the Android app too, not only on desktop.
- **GPU H.264 profile fix (debug switch):** Settings > Debug has a switch for the fix below, so you can compare with it off.

🐛 **Fixed**

- **H.264 calls and screen shares now use the GPU encoder on Windows:** LiveKit answers with a H.264 profile Chromium encodes in software, which cost CPU and could drop frames. Zam now asks for the profile the GPU encoder takes, and turns on Chromium's Constrained Baseline GPU encoding on Windows.
- **Away and invisible presence stick:** with sliding sync, every sync poll was resetting your chosen presence to online. Zam now sends the state you picked, and your own presence dot shows it.

## v1.38.0

✨ **New**

- **A steadier noise filter, now the default:** the built-in noise removal for your microphone is now FastEnhancer, a small model that ships with Zam (nothing to download). DeepFilterNet3 and DPDFNet sometimes dipped your voice by 8 to 13 dB for a moment inside a word, which came across as your volume jumping around, most noticeably with automatic gain control on. FastEnhancer keeps your voice at an even level. Where your device can't run it, Zam uses RNNoise, which is also in the list. If you had picked DeepFilterNet3 or a plugin filter yourself, that choice stays; pick FastEnhancer under Settings > Voice & Audio > Noise suppression.
- **Push to talk switch in voice settings:** turn push to talk on or off in Settings > Voice & Audio, with a link to the keybinds when no key is set yet.
- **Randomize file names (off by default):** Settings > Messages & media can upload files under a random name instead of their real one. The file extension is kept.
- **Right-click a screen share to set its volume.**
- **H.264 encode test (desktop):** Settings > Debug > GPU can time H.264 encoding at a few sizes, to show whether it runs on the GPU.
- **Ignore reported codec support (debug):** Settings > Debug can send the picked video codec even when others report they can't decode it, for testing codecs like HEVC.

🐛 **Fixed**

- **Call stats no longer show a stray "Other track" after a codec switch.**

## v1.37.5

🔒 **Privacy**

- **Location and metadata stripped from uploads:** photos and videos you send (and avatars, banners and emote images) no longer carry GPS location, camera details, XMP/IPTC data or comments. Works for JPEG, PNG, WebP, GIF, TIFF/DNG, HEIC/AVIF and MP4/MOV/M4A files, without re-encoding, and photos stay upright. On by default; turn it off in Settings > Messages & media (not recommended, as files you send could reveal where they were taken).

## v1.37.4

🐛 **Fixed**

- **Video downloads no longer fail on big files:** saving a video could end in "Failed to download video" when the browser couldn't re-read the video it had just fetched. The download now goes ahead without that step.

✨ **New**

- **HEVC encoding in the GPU debug list (desktop):** Settings > Debug > GPU now probes HEVC and HEVC 10-bit encoding alongside H.264, VP8, VP9 and AV1.

## v1.37.3

🐛 **Fixed**

- **Calls keep GPU video encoding after a graphics crash (desktop):** when Chromium's GPU process crashed during a call, your camera and screen share switched to software encoding for the rest of the session, while Settings > Debug still said hardware. The call now reconnects on its own to get the GPU back and tells you so. If graphics crash again straight away it offers a reload, and once Chromium has turned the GPU off it offers to restart Zam.
- **NVIDIA hardware decoding stays on through unrelated crashes (Flatpak):** the automatic switch back from the Vulkan video path now only counts GPU crashes that happen while video is playing.

## v1.37.2

✨ **New**

- **Automatic video codec:** Settings > Voice & Audio has an Automatic option for the video codec, now the default. It picks the best codec your GPU encodes that everyone in the call can play, and stays on H.264 when someone's support is unknown.
- **Changelog since your last version:** after an update, What's New lists every release since the one you last saw, not just the newest.

🐛 **Fixed**

- **Skia Graphite can no longer lock you out (desktop):** if a launch with it on doesn't come up cleanly, or the GPU process crashes, it is switched off automatically and Settings > Debug says so. `--no-skia-graphite` (or `ZAM_NO_SKIA_GRAPHITE=1`) forces it off.
- **Noise removal limit wording:** the hint now reads "The most the noise filter may take off".

## v1.37.1

✨ **New**

- **Skia Graphite toggle (desktop):** Settings > Debug > GPU can switch Chromium to its newer Graphite renderer, for testing rendering problems. Off by default; applies after a restart.

## v1.37.0

✨ **New**

- **Separate volume for shared audio:** when someone shares a screen or application with sound, their menu in a call now has a second slider, so you can set their share apart from their voice.
- **Push to talk sounds:** a short click plays when you press and release push to talk during a call.
- **Upload speed override:** the screen share quality panel has an Upload speed field. If the automatic measurement reads lower than your real connection, enter your own figure to raise the bitrate limit. The measurement also counts what is actually being sent now.
- **Video I can't watch:** Settings > Voice & Audio lets you list video codecs your device can't show, so others send you H.264 instead.

🐛 **Fixed**

- **Black or missing video in calls:** devices announce only the video codecs they can really decode, and a stream that arrives but never decodes is now handled by asking for H.264. HEVC is no longer offered on the Flatpak's NVIDIA video decoding, where it showed black. AV1 is no longer sent in encrypted calls, which can't carry it.
- **Screen share ending when switching codec:** if the switch failed to restart the share, it is now retried and restored with the previous codec.
- **Signed out after an update (desktop):** the app waits for its saved local port to free up instead of switching to a new one, which signed you out.
- **Clearer bitrate limit:** the screen share bitrate is now labelled as the maximum.
- **Call media in DevTools:** call audio and video players get descriptive names in the Media panel.

## v1.36.5

🐛 **Fixed**

- **Settings > Debug showed H.264 encoding as Software on NVIDIA (Linux):** the check asked for a variable bitrate that GPU encoding does not use. It now matches what calls send, so the list shows Hardware when the GPU encodes.

## v1.36.4

✨ **New**

- **Power level on profiles:** a member's profile card now shows their exact power level in the room (for example 50 or 100, or a custom value), not just whether they are a moderator or admin.
- **Send GIFs as animated WebP:** a new option in Settings > Messages & Media (off by default) converts GIFs to smaller animated WebP files when you send them.

## v1.36.3

🐛 **Fixed**

- **Video download button on mobile:** the download button on videos in chat did nothing on phones. Videos now have their own download button that saves the original file.

## v1.36.2

🐛 **Fixed**

- **Flash (SWF) files in encrypted rooms:** SWF files sent in encrypted rooms now play inline like they do in unencrypted rooms, instead of showing only as a file card.

## v1.36.1

✨ **New**

- **Plugins for embedded pages (desktop):** plugins can now adjust the pages embedded in Zam, such as YouTube players, with the new "frames" permission. The first to use it is Fix YouTube Embeds in the plugin list, which makes YouTube videos that say "This video is unavailable" in Zam (music videos from big labels, for example) play.

## v1.36.0

✨ **New**

- **Find the call view:** the call panel at the bottom of the sidebar now has an "Open call" button (with how many videos are on), and the call bar above a room's messages has an "Open" button. The room header's button for it is now an expand icon labelled "Open call view".
- **Know when someone shares their screen:** if someone starts sharing while you're not looking at the call, a message tells you, with a Watch button that opens their share.
- **Simpler screen sharing:** the share button goes straight to choosing what to share. On desktop the quality settings are in that same window, so sharing is one step instead of two. While you share, the sidebar shows "Sharing your screen" with Quality and Stop buttons.
- **Video troubleshooting:** the connection stats window (the signal icon in the call panel) has a Video section that says, for each camera and screen share, whether it's working and if not, where it breaks: your capture stopped, the call server paused it because your connection is too slow, nothing is arriving, it can't be decrypted (often someone on an older Zam), or this device can't decode it. On desktop, a Proxy section shows whether the call goes through your proxy or direct.

🐛 **Fixed**

- **"Connect directly to call servers" still used the proxy (desktop):** joining the call and the connection to the call server still went through the proxy, so a slow or blocking proxy broke calls in that mode too. The whole call now skips the proxy, and everything else keeps using it.
- **Sharing your screen showed you your own screen:** starting a share no longer puts your own screen in the spotlight. Other people's shares still are.

## v1.35.0

✨ **New**

- **Guided encryption setup:** after you sign in, Zam walks you through encryption in one dialog instead of a small notice pointing at Settings. On a new account it sets up recovery in one step (no need to type your password again) and shows your recovery key with Copy and Download buttons. On a new device for an existing account, it lets you confirm it's you with another device or your recovery key. The "Verify" / "Set up" notice above your profile opens the same dialog.
- **Clearer sign-up on matrix.org:** creating an account on matrix.org now says up front that it happens on matrix.org's own account page and brings you straight back signed in, with a "Create account on matrix.org" button.
- **Sign-up checks as you go:** the form now checks whether your username is free and shows your full address (@name:server), asks you to confirm your password, and says up front when a server needs a registration token or isn't taking new accounts (with a link to create one on matrix.org instead). Sliding sync moved under "Advanced options".

🐛 **Fixed**

- **Signing up on servers that ask for extra steps:** servers that ask you to accept terms, confirm an email address, solve a captcha or pass any other sign-up step now walk you through it, instead of failing with "MatrixError: [401] Unknown message". A wrong registration token is asked for again.
- **Readable sign-up errors:** a taken username, a weak password, closed sign-ups and similar problems are now explained in plain words.
- **Encryption setup could replace your identity:** setting up encryption on a new device of an account that already uses encryption now verifies the device first, so devices you verified before stay trusted.

## v1.34.0

⚠️ **Update everyone at once**

- Calls in encrypted rooms are now end-to-end encrypted. Someone still on an older Zam in the same call can't hear or see you until they update, though you can still hear and see them. Element Call users in encrypted rooms can now hear you, and you them.

✨ **New**

- **End-to-end encrypted calls:** calls in encrypted rooms are now encrypted end to end, the same way Element Call does it, so only the people in the call can hear and see it. A lock next to the room name in the call view, and next to the call status, shows whether the call is encrypted. If someone's app sends audio and video without encryption, it says who.
- **Pick your video codec in the call:** the screen-share quality menu now has a video codec choice for your camera and screen share: AV1, HEVC, VP9, H.264 or VP8, from those your device can send. It only lists codecs everyone in the call can play, and marks the ones your graphics card encodes. Switching takes effect straight away. Settings > Voice & Video lists all five.
- **Viewers who can't play your codec still see you:** in unencrypted calls, anyone whose app can't play the codec you picked automatically gets an H.264 copy instead. In encrypted calls Zam sends H.264 until they leave.

## v1.33.0

✨ **New**

- **Pick your screen-share bitrate:** the screen-share quality menu has a bitrate slider of its own, separate from resolution and frame rate. It goes from 300 kbps up to just under your measured upload speed, instead of a fixed bitrate for each resolution. Zam measures your upload while you're sending video, so until your first share on a device the slider goes up to 10 Mbps.
- **Choose your video codec:** Settings > Voice & Video > Camera has a video codec setting for your camera and screen shares. H.264 is the new default, since most graphics cards can encode it; VP8 is the other choice. Both play everywhere, including iPhones and iPads.
- **Hardware video encoding on Linux (desktop):** the desktop app on Linux now encodes your camera and screen share on the graphics card, for codecs the driver supports. Settings > Debug can turn this off and shows which codecs your system encodes in hardware.
- **NVIDIA video encoding on Linux, experimental (Flatpak):** NVIDIA cards can now encode H.264 calls and screen shares on the GPU in the Flatpak. Turn it on in Settings > Debug and restart.

## v1.32.4

🐛 **Fixed**

- **SVG images showed up blank:** after 1.32.2, most SVG images showed as empty once any formatted message had been on screen, and downloading one gave back a broken file. They display properly again, and animated SVGs keep their animation.

## v1.32.3

🔒 **Security**

- **Unencrypted SVG images can't run code:** opening an unencrypted SVG image in a new tab could, in some cases, run code inside it with access to your Zam session. Every SVG now has that code removed first, the same as SVGs in encrypted rooms.

## v1.32.2

🐛 **Fixed**

- **SVG images in encrypted rooms:** SVG images sent in end-to-end encrypted rooms showed as "Image unavailable". They now display, with anything in them that could run code removed first.

## v1.32.1

🐛 **Fixed**

- **Seeking back in long audio and video:** in a FLAC, a long MP3 or a big video that was streaming, jumping back to a part that had already played could leave it stuck loading forever. The browser throws away what has played once it holds too much, and now Zam hands it that part again.
- **WebM videos with sound play in Chrome:** streamed WebM files with both video and audio (most of what ffmpeg makes) failed to play at all in Chrome-based browsers and the desktop app.

## v1.32.0

✨ **New**

- **Share one app's audio:** the screen-share picker has an Audio menu. Share the sound of the window you're sharing, everything except Zam, any single app that's playing, or nothing. Before, Windows shared all system sound, including the call itself, and Linux shared none. Works on Windows 10 (version 2004) and later, and on Linux with PipeWire.
- **Built-in proxy setting (desktop):** Settings > General > Network sets a proxy for Zam: a SOCKS or HTTP proxy, a PAC file, none, or your system settings (launch flags still work). Calls can follow the proxy as before, connect straight to the call servers so audio never goes through the proxy, or go only through the proxy so call servers never see your IP address.
- **More call stats:** the call stats panel now lists every audio and video stream, yours and everyone else's: codec, bitrate, audio frame size, resolution and frame rate, and whether video is encoded in hardware or software and what's holding its quality back. Screen shares included. It also says when the call server has switched you to TCP, which is different from your network blocking UDP.
- **FLAC plays right away:** FLAC files now start playing while they download, like MP3s, instead of waiting for the whole file.
- **Voices start at the right volume:** volume normalization remembers each person's level, and your own, between calls, so calls no longer spend their first few seconds evening out.
- **Calls hold up under load (desktop):** while you're in a call, Zam asks the system to give its call audio and video work priority over other programs. On Linux this needs extra permissions, and without them nothing changes.

🐛 **Fixed**

- **Rejoining no longer distorts someone's voice:** each time someone left and rejoined a call, their voice got louder and more distorted, because every earlier copy of their audio started playing again alongside the new one.
- **Your own mute shows next to your name:** in the call list under a room, muting yourself now shows the muted icon by your name, like it does for everyone else.
- **24-bit FLAC in videos:** 24-bit FLAC audio tracks in MKV files now play.

## v1.31.0

✨ **New**

- **New DMs wait for your first message:** clicking "Message" on someone you haven't talked to used to create the conversation and invite them straight away, even if you were only looking. Now you get a draft, and nothing is created and no invite is sent until you send your first message. If they message you while the draft is open, you're moved into that conversation instead.
- **Call connection stats:** a signal icon next to the call status in the sidebar opens a live view of your call connection: your ping, upload and download, packet loss, and whether your audio is going over UDP, TCP or a relay. TCP is flagged, since it's a common cause of audio lagging or drifting out of sync. It also shows how good the server thinks each other person's connection is, so you can tell whether a problem is on your end or theirs. "Copy as JSON" grabs a snapshot to share.

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
- **MIDI sounds the same everywhere:** MIDI attachments now play with the included sound bank by default, rather than your device's own. You can still pick System or a custom bank under Settings > Messages & Media > MIDI.

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
