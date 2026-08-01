# Zam Matrix Client

this is Zam, a Matrix client for desktop, web, and mobile (APK and PWA)

it's pretty good

feel free to try it out :) a copy is hosted at https://matrix.crafty.moe/ which you can install as a progressive webapp (the recommended way to install this client on iOS)

you can find other packaged versions on the [releases page](https://github.com/az4521/Zam/releases/latest)

## what's in it

Messaging

- markdown (Discord flavoured — `**bold**`, `__underline__`, `~~strike~~`, `||spoilers||`, code blocks), replies, edits, deletes, forwarding, reporting
- threads, with a per-room thread list and threaded read receipts
- reactions, custom emoji + sticker packs (MSC2545 `im.ponies`, room-level and personal), GIF picker (KLIPY, no API key needed)
- polls (create, vote, close), voice messages with a real waveform, location + live location sharing on a Leaflet map
- pinned messages, per-room message search, media/files browser, link previews, read receipts (public or private) and typing indicators
- per-room drafts that survive a room switch (in memory only — a reload drops them)

Rooms & spaces

- spaces with drag-and-drop folders, custom colours, and ordering that syncs across devices via account data
- room directory, join by address, knocking, invites (incl. an invite panel with email invites — see the limits below)
- room admin: name/topic/avatar, join rules, history visibility, aliases, power levels, kick/ban/unban, room upgrades
- favourites / low-priority tags and manual room ordering

Calls

- voice + video group calls over MatrixRTC (MSC4143) with LiveKit, screen sharing on web and desktop, incoming-call cards, per-participant volume
- **needs server-side infrastructure** — see "serving it" below

Encryption

- E2EE via rust-crypto: encrypted rooms and DMs, SAS (emoji) and QR device verification, cross-signing, secret storage (4S), key backup and recovery
- **attachments are not encrypted yet** — files, images and voice messages sent into an encrypted room are uploaded unencrypted, and attachments encrypted by other clients can't be displayed

App

- multi-account (switching reloads the app; one account syncs at a time)
- push notifications with a full push-rules UI, including keyword highlight rules and per-room overrides
- themes and customization (colours, timestamp formats, timeline density) synced via account data
- auto-update on Electron and Android; the web build checks and offers a reload
- installable PWA, Electron desktop build, Android APK

things left to do:

Rooms

- Server admin tools (Synapse admin API)
- Approving/denying knock requests (you can knock, but there's no admin UI for handling one)
- Muting a user (power levels can't go negative here)

User

- SSO / OAuth login (password login only right now)
- Identity server support — invite-by-email is built and wired, but nothing ever configures an identity server, so it always falls back to "your homeserver has no identity server"

Media

- Listing encrypted attachments in the media/files browser (it says so in the panel — the enumerator needs an `mxc://` url and encrypted events don't have one)
- Searching encrypted rooms (search is server-side, so there are no results there), and searching across all rooms rather than one

UI / Polish

- Empty-state illustrations (a couple of the empty states are designed; most are a line of muted text)
- First-run / onboarding flow
- `prefers-reduced-motion` — animations are unconditional today
- Roving-tabindex arrow navigation in the menus that declare `role="menu"`

for devs, same install process as every other js app

```
git clone https://github.com/az4521/Zam.git
cd Zam
npm i
npm run dev
```

useful scripts: `npm run check` (svelte-check), `npm run test` (vitest, run-once), `npm run build`, `npm run format` (prettier), `npm run electron:build`. `npm run lint` is currently broken — there's no root eslint config, so the `eslint .` half errors out; prettier is the formatting source of truth.

## serving it

run `npm run build` and copy the files in `build/` into a web directory. it's all static — there is no backend to serve. point your SPA fallback at `index.html` (e.g. nginx `try_files $uri $uri/ /index.html;`).

there are three _optional_ services the client talks to. none of them are needed to chat, but each one is a feature you don't get without it — and two of them have live defaults baked into the build, so read this before deploying a fork:

| service                                                                      | what it powers                             | default in this repo                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Sygnal](https://github.com/matrix-org/sygnal) push gateway                  | Android FCM push, and browser/PWA web push | **falls back to `https://sygnal.crafty.moe`** (`src/lib/push.ts`, `src/lib/webPush.ts`). web push also falls back to a **public VAPID key** committed in `src/lib/webPush.ts`. so a fork you deploy unchanged will register pushers pointing at _this project's_ gateway |
| LiveKit SFU + [lk-jwt-service](https://github.com/element-hq/lk-jwt-service) | voice/video calls                          | none. the SFU is discovered from the homeserver's `.well-known` (`org.matrix.msc4143.rtc_foci`); with none configured, joining a call fails with "No LiveKit focus available for this call"                                                                              |
| identity server                                                              | invite-by-email                            | none, and nothing in the app configures one                                                                                                                                                                                                                              |

to point push at your own gateway, set `VITE_PUSH_GATEWAY_URL` (and `VITE_VAPID_PUBLIC_KEY`) at build time — see [ANDROID_PUSH_SETUP.md](ANDROID_PUSH_SETUP.md), which also covers how to turn push off. leaving the vars unset does _not_ turn it off; that's what the fallbacks above are.

---

## Editing src/lib/config.ts

### DEFAULT_HOMESERVER

the default homeserver url for the login page when viewed as a webapp. currently set to https://matrix.crafty.moe

### INSTALLED_APP_DEFAULT_HOMESERVER

the default homeserver url for the login page when installed as a pwa, electron app, or apk. currently set to https://matrix.org
