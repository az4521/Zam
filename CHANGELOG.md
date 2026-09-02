# Changelog

Human-readable release notes. The `## v<version>` section for the released version is pulled into
the GitHub release body automatically (see `.github/workflows/release.yml`); the auto-generated
commit list is appended below it.

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
