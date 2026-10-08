# Zam Matrix Client

this is Zam, a Matrix client for desktop, web, and mobile (APK and PWA)

it's pretty good

feel free to try it out :) a copy is hosted at https://matrix.crafty.moe/ which you can install as a progressive webapp (the recommended way to install this client on iOS)

you can find other packaged versions on the [releases page](https://github.com/az4521/Zam/releases/latest), and there's a Flatpak repo at https://az4521.github.io/Zam/

## what's in it

Messaging

- markdown (Discord flavoured — `**bold**`, `__underline__`, `~~strike~~`, `||spoilers||`, code blocks), replies, edits (including `s/old/new/` on your last message), deletes, forwarding, reporting
- threads, with a per-room thread list (all or just yours), replies inside threads, threaded read receipts, and thread names (our own event, proposed as [MSC4558](https://github.com/matrix-org/matrix-spec-proposals/pull/4558))
- reactions, custom emoji + sticker packs (MSC2545 `im.ponies`, room-level and personal), GIF picker (KLIPY, no API key needed)
- polls (create, vote, close), voice messages with a real waveform, location + live location sharing on a Leaflet map
- pinned messages, per-room message search (has limits — see "things left to do"), media/files browser, link previews, read receipts (public or private) and typing indicators
- per-room drafts that survive a room switch (in memory only — a reload drops them, though the reload Android does after a while in the background keeps them)
- JPEG XL images (converted on the fly where the browser can't show them), and MIDI attachments that play with a sound bank of your choice
- an offline outbox — messages you send while disconnected queue up and go out when you reconnect, instead of just failing

Rooms & spaces

- spaces with drag-and-drop folders (each folder takes a custom colour), and ordering that syncs across devices via account data
- sub-spaces shown as collapsible categories in the room list, with Join buttons for rooms you're not in yet
- room directory, join by address, knocking (request to join from the directory too), invites (incl. an invite panel with email invites — see "things left to do" below)
- room admin: name/topic/avatar, join rules, history visibility, aliases, power levels, kick/ban/unban, room upgrades (rooms only, not spaces)
- favourites / low-priority tags and manual room ordering

Calls

- voice + video group calls over MatrixRTC (MSC4143) with LiveKit, screen sharing on web and desktop, incoming-call cards, per-participant volume, and calls between homeservers
- on Android, calls work like phone calls: they keep going in the background, ring over the lock screen, and work with Bluetooth headsets, cars and watches
- **needs server-side infrastructure** — see "serving it" below

Encryption

- E2EE via rust-crypto: encrypted rooms and DMs, SAS (emoji) and QR device verification, cross-signing, secret storage (4S), key backup and recovery, and key export/import to a passphrase-protected file (the same format Element uses)
- encrypted attachments decrypt and display (in the timeline and the media/files browser), with the ciphertext hash verified before anything is shown; files, images, videos and voice messages you send into an encrypted room are encrypted, and encrypted videos play in-timeline

App

- multi-account (switching reloads the app and one account is open at a time, but every signed-in account still gets notifications)
- push notifications with a full push-rules UI, including keyword highlight rules and per-room overrides. encrypted messages are decrypted for the notification, even with the app closed. on Android, push goes through Firebase or UnifiedPush (e.g. ntfy) for phones without Google services
- sliding sync (optional, in Debug settings) alongside classic sync
- translations: English, French, German and Assyrian Neo-Aramaic
- theming — light, dark, and true-black AMOLED, plus fully custom colours you save as your own presets and share by a copy-paste code; timestamp formats and double-tap actions too, all synced across devices via account data
- auto-update on Electron and Android; the web build checks on request and offers a reload
- installable PWA, Electron desktop build (also as a Flatpak), Android APK
- plugins, installed from GitHub plugin repos. a plugin runs with full access to the app and your account (there is no sandbox), so only install ones you trust. with auto-update off, an installed plugin stays frozen at the exact commit you installed or last updated it at

things left to do:

Rooms

- Server admin tools (Synapse admin API)
- Jump to date (`/timestamp_to_event`)
- Marking a room as unread (`m.marked_unread`)

User

- Sign-in methods: password, legacy SSO and native OAuth 2.0 / OIDC (Matrix Authentication Service) all work. Not done: QR-code login from another device, the OAuth device-code grant, and signing other sessions out from inside the app on an OAuth account (it links to the provider's account page instead)
- Identity server support — invite-by-email is built and wired, but nothing ever configures an identity server, so it always falls back to telling you your homeserver hasn't got one

Media

- Searching encrypted rooms (search is server-side, so there are no results there), and searching across all rooms rather than one

UI / Polish

- Empty-state illustrations (a couple of the empty states are designed; most are a line of muted text)
- First-run / onboarding flow
- Roving-tabindex arrow navigation in the menus that declare `role="menu"`

for devs, same install process as every other js app

```
git clone https://github.com/az4521/Zam.git
cd Zam
npm i
npm run dev
```

useful scripts: `npm run check` (svelte-check), `npm run test` (vitest, run-once), `npm run build`, `npm run format` (prettier), `npm run electron:build`, `npm run lint` (`prettier --check .`). CI runs check, test and lint before any release build.

## serving it

run `npm run build` and copy the files in `build/` into a web directory. it's all static — there is no backend to serve. point your SPA fallback at `index.html` (e.g. nginx `try_files $uri $uri/ /index.html;`).

there are three _optional_ services the client talks to. none of them are needed to chat, but each one is a feature you don't get without it — and two of them have live defaults baked into the build, so read this before deploying a fork:

| service                                                                      | what it powers                             | default in this repo                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Sygnal](https://github.com/matrix-org/sygnal) push gateway                  | Android FCM push, and browser/PWA web push | **falls back to `https://sygnal.crafty.moe`** (`src/lib/push.ts`, `src/lib/webPush.ts`). web push also falls back to a **public VAPID key** committed in `src/lib/webPush.ts`. so a fork you deploy unchanged will register pushers pointing at _this project's_ gateway |
| LiveKit SFU + [lk-jwt-service](https://github.com/element-hq/lk-jwt-service) | voice/video calls                          | none. the SFU is discovered from an existing call member's advertised service url, or the homeserver's `.well-known` (`org.matrix.msc4143.rtc_foci`); with neither, joining a call fails with "No LiveKit focus available for this call"                                 |
| identity server                                                              | invite-by-email                            | none, and nothing in the app configures one                                                                                                                                                                                                                              |

to point push at your own gateway, set `VITE_PUSH_GATEWAY_URL` (and `VITE_VAPID_PUBLIC_KEY`) at build time — see [ANDROID_PUSH_SETUP.md](ANDROID_PUSH_SETUP.md), which also covers how to turn push off. leaving the vars unset does _not_ turn it off; that's what the fallbacks above are.

---

## Editing src/lib/config.ts

### DEFAULT_HOMESERVER

the default homeserver url for the login page when viewed as a webapp. currently set to https://matrix.crafty.moe

### INSTALLED_APP_DEFAULT_HOMESERVER

the default homeserver url for the login page when installed as a pwa, electron app, or apk. currently set to https://matrix.org
