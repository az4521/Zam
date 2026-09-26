# Changelog

Human-readable release notes. The `## v<version>` section for the released version is pulled into
the GitHub release body automatically (see `.github/workflows/release.yml`); the auto-generated
commit list is appended below it.

## Unreleased

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

🪟 **Menus & dialogs**

- Escape and the Android back button close only the top overlay: the read-receipt list, What's New, the screen-share quality menu, the who-reacted sheet, plugin popovers and the composer "+" menu now all behave the same way.

📞 **Calls**

- Leaving a call while it is still connecting no longer shows an error.
- A call that fails to connect shows one error, not an extra "disconnected" message.
- Changing noise suppression or other mic settings keeps your chosen microphone.
- A failed mic or camera switch goes back to the previous device and tells you.
- Screen-share quality changes apply to the running share, and the lower-quality stream gets its own bitrate. The system-audio toggle says it applies to the next share.
- Kick and Ban from a call tile ask you to confirm first.
- Screen readers announce the status badges on call tiles.

⚙️ **Settings**

- The sidebar and room list no longer clip at large text sizes.
- Deleting a theme preset and removing a plugin ask you to confirm first.
- If a custom font can't be saved on this device, the app tells you.
- The tray settings no longer show on the web, and settings search announces how many results it found.

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
