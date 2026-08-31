# Changelog

Human-readable release notes. The `## v<version>` section for the released version is pulled into
the GitHub release body automatically (see `.github/workflows/release.yml`); the auto-generated
commit list is appended below it.

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
