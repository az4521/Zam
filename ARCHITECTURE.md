# Architecture & Design

## What this is

**Zam**, a Discord-styled Matrix chat client. It's **SvelteKit + Svelte 5**, builds to static
files, and ships from that one build to four targets: the web, an installable PWA, an **Electron**
desktop app, and an **Android** app via Capacitor.

> This document describes responsibilities and data flows. It deliberately does **not** inventory
> exports, file sizes or line counts — those drift within days and the previous version of this
> file was wrong about most of them. When you need the current surface of a module, read the
> module.

## Tech stack

- **SvelteKit** with `adapter-static` — no SSR, single static build, SPA fallback `index.html`
- **Svelte 5** runes throughout (`$state`, `$derived`, `$effect`, `$props`, `{#snippet}`) — no
  `svelte/store`
- **TypeScript**, **Tailwind CSS** (Discord-inspired palette), **Vitest** (jsdom)
- **matrix-js-sdk v41** (`^41.9.0`) with the **rust-crypto** E2EE stack
- **livekit-client** for MatrixRTC voice/video
- **marked** + a hand-rolled Discord-flavoured markdown layer, **DOMPurify** for sanitization,
  **@twemoji/api**, **leaflet** (location), **@ruffle-rs/ruffle** (legacy Flash embeds)
- **Capacitor** (Android) + **electron-builder** (desktop)

## Top-level layout

```
src/
  app.html, app.css                  -- app.css also holds the light-theme token block
  routes/
    +layout.svelte, +layout.ts       -- ssr=false, prerender=true; global external-link
                                        interception + Android long-press-to-copy
    +page.svelte                     -- THE route: splash / login / shell switch, session
                                        restore, session-expiry handling
    app/+page.svelte                 -- legacy redirect stub -> "/" (stale bookmarks, cached
                                        PWA start_url)
  lib/
    config.ts                        -- default homeserver per runtime
    push.ts / webPush.ts             -- Android FCM push / browser+PWA VAPID web push
    nativeSession.ts                 -- mirrors session creds into Android SharedPreferences
    update.ts, desktopUpdater.ts, androidUpdater.ts   -- the three update runtimes
    desktopScreenShare.ts            -- Electron desktopCapturer bridge
    matrix/
      client.ts                      -- THE SDK boundary
      crypto.ts                      -- the E2EE subsystem (deliberate exception)
      pushRules.ts, notifications.ts -- push-rule helpers, /notifications wrapper
    stores/                          -- the rune stores (see "Stores")
    components/
      layout/                        -- AppShell, LoginView, Splash, sidebars, panels, call UI
      messages/                      -- timeline item, composer, polls, location, voice
      settings/                      -- the settings panels
      ui/                            -- atoms: Avatar, Portal, pickers, Lightbox, toasts, maps
      debug/                         -- DebugPanel (Ctrl+Shift+D)
    utils/                           -- the pure-logic layer, each module with a colocated test
    actions/                         -- focusTrap, longPress, resizeHandle, videoTrack
    audio/                           -- device enumeration, mic/output meters, speaker test
    data/emojis.ts                   -- unicode emoji catalog
    plugins/                         -- the plugin subsystem: zam host API, loader, registry,
                                        built-in plugins (see "Plugin system")
static/                              -- sw.js, manifest.webmanifest, icons, ruffle/, sounds/,
                                        twemoji/
electron/                            -- main.cjs, preload.cjs
android/                             -- Capacitor shell + 3 custom Java classes
scripts/                             -- gen-vapid.mjs (VAPID private key -> PKCS#8 PEM for Sygnal)
svelte.config.js                     -- adapter-static, fallback index.html, prod-only CSP
capacitor.config.ts                  -- appId moe.crafty.matrix, appName Zam, webDir build
```

## Routing

There is **one** auth-gated route.

- **`/`** (`src/routes/+page.svelte`) decides what to render: `Splash` while a stored session is
  being restored, `LoginView` when there is none, `AppShell` once sync is up. It owns session
  restore, the add-account mode (`?add`), and `handleSessionExpired`, which returns to login **in
  place** — no navigation.
- **`/app`** is a redirect stub that `goto("/")`. It exists only for stale bookmarks and cached
  PWA `start_url`s. Nothing new should point at it.

The 3-pane application itself is a component: `src/lib/components/layout/AppShell.svelte`. It
registers every subscriber, owns global keyboard and back-button handling, the mobile drawer, and
all the `init*()` wiring.

## Data flow

```
matrix-js-sdk client (single module-level instance in client.ts)
        |  emits sync / timeline / account-data / receipt / typing / crypto events
        v
client.ts subscriber helpers (onTimelineEvent, onAccountData, onRoomUpdate, onAnyReceiptEvent, ...)
        |  registered in AppShell.svelte onMount, torn down by the returned disposers
        v
$state stores (rooms, messages, notifications, voiceCall, interface, ...)
        |  Svelte 5 reactivity
        v
components re-render
```

**Tick pattern.** SDK objects mutate in place, which Svelte can't observe: the same `Room` object
comes back from `getRoom()` with different contents, so a `$derived` that reads it never re-runs.
Stores therefore expose monotonic counters. An event handler bumps a tick; a component reads it
inside a `$derived` (`const members = $derived((void roomsState.roomsTick, getRoomMembers(room)))`)
so the derived re-runs even though the underlying object identity didn't change. This is the bridge
between the SDK's event-driven model and Svelte's pull-based reactivity, and it is load-bearing —
kick/ban/rename/reaction/decryption refreshes all ride on it.

The counters live next to the state they invalidate: `roomsState.unreadTick`/`roomsTick`,
`messagesState.reactionTick`/`timelineTick` (the latter also swaps a decryption placeholder for
real content when a UTD event decrypts late), `notificationsState.tick`,
`voiceCallState.voiceTick`, `verificationState.verificationTick`, `securityState.securityTick`,
`presenceState.presenceTick`, `liveLocationState.beaconTick`, and `pushRulesState.revision` (same
idea, different name).

**Cost note:** a tick is a global invalidation. Every rendered row re-derives on every sync. Keep
the tick _read_ — that's the correctness part — but make the resulting _write_ conditional when
the derived is expensive.

## The SDK boundary

**`src/lib/matrix/client.ts` is the SDK boundary.** Components and stores call its exported
wrappers; they import matrix-js-sdk _types_ only. It holds the single module-level client
instance, and it is also the **LiveKit** boundary.

Sanctioned exceptions, all deliberate:

- **`src/lib/matrix/crypto.ts`** — the entire E2EE subsystem, sharing the client via `getClient()`.
  Crypto work goes here, not in `client.ts`.
- **`src/lib/matrix/pushRules.ts`** and **`notifications.ts`** — small push-adjacent modules that
  import a few SDK enums.
- Two components pull exactly one runtime enum each (`DebugPanel.svelte` → `EventType`,
  `MessageItem.svelte` → `EventStatus`). Tolerated, not a pattern to copy.
- **`src/lib/plugins/hostApi.ts`** and **`pluginBoot.ts`** — the plugin host's only two `client.ts`
  consumers. Plugins never touch `client.ts` themselves; they call the `zam` host API, and only
  these two modules translate it into `client.ts` wrappers (`hostApi` per plugin, `pluginBoot` for
  host-level account-data sync). `client.ts` imports back exactly one type-only leaf
  (`plugins/types` summaries), so the graph stays acyclic. See "Plugin system".

Everything else in `src/` imports SDK types only. When adding an SDK capability, add a thin wrapper
in `client.ts` first.

`client.ts` is large and grouped by concern: lifecycle, rooms/spaces, creation/join, display
helpers, messages, threads, reactions/receipts/typing, unread + loud, notifications, push rules,
power levels/moderation, room admin, custom emoji/sticker packs, space layout, media, MatrixRTC
calls, live location, and the `on*` subscription helpers (each returning an unsubscribe function).

**Async ownership.** Anything in `client.ts` that awaits more than once must re-check that it still
owns the client it started with — a stopped client's late callback must not act on its successor's
state. The idiom is the client reference captured on entry and compared by identity afterwards
(`const client = matrixClient;` … `if (matrixClient === client)`). Most multi-await functions do
**not** do this yet; the reconnect teardown is the precedent to copy.

## Stores

All Svelte 5 `$state`, living outside components in `src/lib/stores/`. The ones you'll meet first:

- **`accounts.svelte.ts`** — the multi-account registry, persisted to
  `localStorage["matrix_accounts"]` as `{version, activeUserId, accounts:[{userId, accessToken,
deviceId, homeserverUrl, displayName?, avatarUrl?}]}`. Defensively parsed: a bad version or a
  non-array resets to empty; a dangling `activeUserId` is nulled without dropping the accounts.
- **`auth.svelte.ts`** — an in-memory mirror (`isAuthenticated`, `userId`, `syncState`, `error`, …).
  It persists **nothing** session-shaped; every write delegates to the registry
  (`saveSession`→`upsertAndActivate`, `clearSession`/`expireActiveSession`→`removeAccountById`).
  It owns only `matrix_last_homeserver`.
- **`interface.svelte.ts`** — the central UI slot store. See below.
- **`rooms.svelte.ts`** — spaces, orphan/direct/invited/knocked rooms, active space and room, space
  drill state, space layout, and the two room ticks.
- **`messages.svelte.ts`** — the per-room timeline cache (`byRoom`, a plain object for deep
  reactivity) plus the timeline/reaction ticks.
- **`notifications.svelte.ts`** — the notification inbox, each entry flagged loud (sound-triggering)
  or silent, persisted per account.
- **`settings.svelte.ts`** — the client preference layer: device-global settings and
  account-scoped ones, backed by the `settings:*` localStorage namespace.
- **`toasts.svelte.ts`** — the app's only generic failure surface. New user-visible error paths go
  here rather than inventing another.

Plus focused stores for verification, security status, voice calls, incoming calls, live location
and its map, composer drafts, GIF search, ignored users, presence, push-rule revisions, the update
banner, the profile card, and the dialog-target stores (invite/location/poll).

**Never persist a session key by hand.** `matrix_session` (the pre-multi-account key) is read once
at boot, migrated into the registry, and deleted. Per-account keys are namespaced `${base}:${userId}`
by `src/lib/utils/scopedStorage.ts`, which also adopts and removes the pre-multi-account bare key on
first scoped read.

## The UI slot system

`interfaceState` coordinates **three dismissal slots**, plus `callViewRoomId` (which flips a room
between its timeline and the call UI):

- **`subPage`** — a page layered _inside_ an open modal (the mobile settings drill-down).
- **`modal`** — one `ModalId` at a time (app settings, room settings, quick actions, the various
  context menus, pickers, lightbox, live map, …).
- **`sidebar`** — one `SidebarId` at a time: `members`, `pinned`, `notifications`, `search`,
  `threads`, `media`, and `plugin` (a plugin room-panel; see "Plugin system").

Each slot holds at most one owner, but **the slots are not exclusive of one another** — a sub-page
exists precisely while its modal is also open. `dismissTopmost()` (and therefore Escape, and the
mobile back button) walks them in order: sub-page → modal → sidebar.

**Ownership tokens.** `openModal(id, close)` / `openSidebar(id, close)` return an opaque
`SlotToken`. Two properties make this safe:

1. The slot is released **before** the outgoing owner's `close()` runs, so a close handler executes
   against an empty slot and cannot clobber the incoming owner. Re-entrant closes are no-ops.
2. Holders release with `clearModalIfOwner(token)`, which does nothing if a newer owner has taken
   the slot. A late unmount can therefore never null a slot someone else now owns.

The tokens are module-scope `let`s rather than `$state` fields **on purpose** — teardown paths read
them, and a `$state` read from a tracked scope would register a reactive dependency.

Components **render from the slot** (`{#if interfaceState.modal === "space-menu"}`) and keep only
their associated data (coordinates, target room) local, set just before calling the helper. The
`close` function you pass is what resets that local data, so dismissal works no matter who
triggered it.

## Keyboard and back-button handling

Centralised in **`AppShell.svelte`**: `onWindowKeydown` behind the app's primary
`<svelte:window onkeydown>`. Components do not register global key handlers; only element-scoped,
focus-dependent editor bindings stay local (composer Enter-to-send and autocomplete arrows, modal
Enter-to-submit, picker selection). Two components take a global listener of their own — `CallView`
(its own `<svelte:window onkeydown>`) and `Lightbox` (a `window.addEventListener`, deliberately
arranged not to swallow the back-button `popstate`).

- **Escape** → `dismissTopmost()` (sub-page → modal → sidebar).
- **Ctrl+Shift+D** → toggle the debug panel.
- **Ctrl+E / Ctrl+S / Ctrl+G** → open the emoji/sticker/gif composer picker, when a room with a
  composer is visible.
- **Type-to-focus** — a plain alphanumeric key focuses the composer. Skipped when a modal is open,
  when a sidebar or drawer is open on mobile, or when focus is already in an editable element. It
  does **not** `preventDefault`, so the triggering character lands in the now-focused composer.

Mobile **back button** (`popstate` plus a pushed history "guard" entry, or Capacitor's
`App.backButton` on Android): dismiss the topmost slot → open the left drawer → real back
navigation. A reactive `$effect` keeps the guard entry present whenever there is something to
intercept.

## Subsystems

### E2EE (`src/lib/matrix/crypto.ts`)

The whole encryption stack: rust-crypto init with a per-account IndexedDB prefix, device
verification (SAS emoji and QR) behind a verification controller, cross-signing, secret storage
(4S), and key backup/recovery. Booted from `client.ts` during client creation.

Supporting cast: `stores/verification.svelte.ts` and `stores/security.svelte.ts`,
`utils/{keyBackup,recoveryKey,cryptoStore,encryptionState,eventShield}.ts`,
`settings/SecuritySettings.svelte`, `layout/VerificationModal.svelte`, `messages/EventShield.svelte`.

**Landmine:** the SDK configures room encryption **only from the sync loop**. Any room state we
inject out of band bypasses that, leaving a room the UI calls encrypted that crypto refuses to
encrypt for. `ensureRoomCryptoConfigured(room)` replays the event through the same hook — call it
after any out-of-band state injection, and gate on the encryptor map rather than
`isEncryptionEnabledInRoom()` (the algorithm is persisted, so that call lies).

**Attachments are not encrypted.** The upload path always emits a plaintext `mxc://` url, and
incoming encrypted attachments cannot be rendered. This is a known gap, not an oversight to
"fix" incidentally.

### Voice/video calls (MatrixRTC + LiveKit)

Real MSC4143 MatrixRTC, not legacy 1:1 WebRTC and not an Element Call widget. Membership is
published as room state through the SDK's `matrixRTC` room session; media rides a
**LiveKit SFU** discovered from an existing member's advertised service URL or the homeserver's
`.well-known` (`org.matrix.msc4143.rtc_foci`), with a JWT obtained from an **lk-jwt-service** via
an OpenID exchange. With no focus configured, joining throws — there is no fallback path.

UI: `CallView`, `VoiceCallPanel`, `VideoTile`, `ActiveCallBanner`, `IncomingCallCard`,
`CallParticipantMenu`, `ScreenSharePicker`. State: `stores/voiceCall.svelte.ts` and
`stores/incomingCalls.svelte.ts`. Device handling lives in `lib/audio/`, track attachment in
`actions/videoTrack.ts`.

### Threads

Real SDK threads. **`threadSupport: true` belongs in `startClient()`, not `createClient()`** — the
latter silently ignores it and threads then look completely dead. The rules live in pure modules:
`utils/threadModel.ts` (including the `belongsToMainTimeline` classification), `threadList.ts`,
`threadUnread.ts`, `threadNotify.ts`, `threadContent.ts`. UI is `ThreadPanel.svelte` plus the
`threads` sidebar slot (`ThreadsListPanel.svelte`).

### Notifications

A message whose push actions carry the `sound` tweak is "loud".

1. The timeline subscriber in `AppShell` plays the ping and records every notifying event.
2. The room — and every space/folder containing it — shows a red unread indicator.
3. If the actions **also** carry the `highlight` tweak, the message renders highlighted in the
   timeline. That is a distinct predicate on purpose — the default DM rule sets `sound` with no
   `highlight`, so treating them as one painted every message in a DM as a mention.
4. The inbox panel lists them, server-backed via `/notifications` once a probe succeeds; an
   unknown, unsupported or errored probe all render the local store.
5. Receipt events clear entries the user has now read.

Page notifications, service-worker notifications and Android notifications are **three separate
domains**. Anything that clears or routes a notification has to address all three, and a routing
decision must check which account the notification belongs to.

### Push

Three paths — foreground (in-app Notification API), background web/PWA (VAPID web push →
`static/sw.js`), and background Android (FCM → `MatrixMessagingService.java`). The two background
paths need a Sygnal gateway, and **both have live fallbacks compiled in**. See
`ANDROID_PUSH_SETUP.md`, which carries the wire shapes and the effective defaults.

### Service worker (`static/sw.js`)

`initServiceWorker()` lives in `client.ts` but is called from the route on login/restore. The
worker has four jobs:

1. **Auth store** — holds the access token in an IndexedDB `matrix-sw/auth` store, fed by
   `postMessage` (`SET_AUTH` / `CLEAR_AUTH` / `SET_NOTIF_PRIVACY`). Writes are serialized through a
   promise chain so concurrent handlers can't persist out of order.
2. **Media auth** — Matrix media needs an `Authorization: Bearer` header that `<img src>` can't
   send, so the worker injects it. Deliberately narrow: only pathnames under
   `/_matrix/client/v1/media/`, only element-initiated requests, and only when no `Authorization`
   header is already present, so the token can't leak onto other homeserver APIs.
3. **A no-referrer proxy** for `video.twimg.com`.
4. **Web push** — receives Sygnal's `event_id_only` payloads, re-fetches the event to build a real
   notification, honours the mirrored "hide message text" privacy flag, and clears a room's
   notification when the unread count reaches zero.

It also mirrors, **by hand**, `src/lib/utils/activeSession.ts` (the account-data heartbeat that
suppresses notifications on idle devices) — as does the Java service. Those three copies must move
together, and **nothing enforces it**: `activeSession.test.ts` pins the TypeScript constants so a
change _there_ is loud, but no test reads `static/sw.js` or the Java service, and no gate compiles
either of them.

### Multi-account

`stores/accounts.svelte.ts` holds the registry; `utils/scopedStorage.ts` namespaces per-account
keys; each account gets its own rust-crypto database. Switching accounts leaves any active call and
then navigates to `/` with `location.assign`, tearing down the whole module graph — so no
cross-account store state can survive. One account syncs at a time.

### Settings

`AppSettings.svelte` is a thin router over the panels in `components/settings/`. The pure
`settingsNavView()` decides between three shapes — desktop (sidebar + panel), mobile list, and
mobile detail (which owns the `subPage` slot). `utils/roomSettingsNav.ts` is the same pattern with a
permission-dependent tab list.

### Updates

Three runtimes collapse into one `UpdatePhase` union (`utils/updateStatus.ts`): the web build checks
GitHub Releases **on demand** against a build-time-injected version (`initUpdateWatch` is a no-op on
web — there is no background poll), desktop streams `electron-updater` events over IPC, and Android
drives the custom APK plugin. `UpdateBanner.svelte` renders only the actionable phases.

### Electron (`electron/main.cjs`)

Serves the static `build/` over a small local HTTP server with SPA fallback, on a **persisted
port** — localStorage is origin-keyed and the session lives there, so a changing port would log the
user out. Single window plus tray with close-to-tray, a single-instance lock, `electron-updater`
with `autoDownload` off behind `updates:*` IPC, and screen-share via `setDisplayMediaRequestHandler`
round-tripped to an in-app picker. `preload.cjs` exposes exactly `window.desktop = { showWindow,
updates, screenShare }`.

### Android native

`MatrixMessagingService.java` is a `FirebaseMessagingService` that enriches data-only Sygnal pushes
by calling the homeserver with the credentials `src/lib/nativeSession.ts` mirrors into
SharedPreferences. `ApkUpdaterPlugin.java` is a custom Capacitor plugin that downloads an APK and
hands it to the system installer. `MainActivity.java` registers the plugin and routes notification
taps into the web layer.

### Live location and polls

Live location is MSC3672 beacons with throttled publishes and expiry timers
(`stores/liveLocation.svelte.ts`, `utils/liveLocation.ts`), rendered on real Leaflet maps
(`LocationMap.svelte`, `LiveLocationMapView.svelte`). Polls are MSC3381, parsed and tallied by the
pure `utils/pollContent.ts`, which accepts both stable and unstable poll event names on read.

### Plugin system

A first-party plugin subsystem (`src/lib/plugins/`). Plugins are **full-trust JavaScript** — they
run with the same privileges as app code, an Obsidian-style trust model where the safety story is
**consent before code**, not a sandbox. A plugin is a module exporting `onload(zam)` and an optional
`onunload()`; it is written against the **`zam` host API** and never imports `client.ts`,
`localStorage`, or `matrix-js-sdk` directly.

**The interop rule is absolute.** Zam must render everything any Matrix client can send with **zero
plugins installed**. Nothing that _displays_ an inbound event or msgtype (`m.room.message` of any
kind, `m.sticker`, `m.poll`, `m.location`, voice, reactions) may be gated behind a plugin. Only
sender-side / compose UI, local enhancements that degrade gracefully, and non-message tools are
pluginable. The emoji, GIF, and sticker pickers are **core composer UI** that mount app-internal
Svelte components, not plugins. The plugin system's extension points — `zam.composer.addButton`,
`zam.ui.openPopover`, `zam.composer.insertText`, `zam.matrix.sendImage` and `sendSticker` — remain
available for third-party plugins to use; the app's own pickers just don't route through them.

**The `zam` host API.** `types.ts` is the full contract; `hostApi.ts` builds a per-plugin instance.
It is grouped into namespaces: `commands` (slash commands), `composer` (buttons, "+" actions,
`startReply` / `startEdit` / `insertText`), `messages` (outgoing text and content transforms,
double-tap handlers, action-menu items, decorators, custom embeds), `room` (header buttons and
panels), `shortcuts` (global hotkeys, conflict-checked against core), `ui` (`openPopover`,
`registerPanel`, `notify`), `events` (a read-only event bus), `matrix` (a curated,
boundary-preserving slice of `client.ts` — `sendMessage` [2-arg], `sendImage`, `sendSticker`,
`react`, and plain room/member summaries, never live SDK objects), `storage` (per-plugin namespaced
key/value), `settings` (schema-driven — see below), and `unsafe` (`getClient()` — the escape hatch).
The curated `matrix` API is a stability/ergonomics layer and a seam for a future sandbox, not a
security cage. **`zam.unsafe.getClient()`** hands a plugin the live matrix-js-sdk client instance for
anything the curated API doesn't cover, with the plugin owning the stability and safety risk. Every
`register` / `add` / `on` returns a **`Disposable`**, and the host tracks all of a plugin's
disposables so disabling it removes exactly its contributions.

**The registry** (`registry.ts` plus `stores/plugins.svelte.ts`) is a reactive `$state` store keyed
per plugin, with one array per extension point — commands, composer buttons and actions, message
actions, decorators, embeds, header buttons, shortcuts, panels, outgoing text and content
transforms, double-tap handlers, event subscriptions — plus a mutation tick. Core UI reads
`[...core, ...pluginRegistry.x]` and re-derives on the tick. **Core always wins on a conflict**: a
full-trust plugin can never shadow `/ban` or a reserved hotkey, because the merge drops the colliding
plugin entry.

**Two load paths** (`loader.ts` plus `pluginBoot.ts`). Built-in plugins live in
`src/lib/plugins/builtins/` and register directly — the loader just calls the in-app module's
`onload`. Repo plugins are fetched from GitHub (`fetch` the bundle text from `raw.githubusercontent
.com` → wrap it in a `Blob` → `import(blobUrl)` → `onload`), which needs **no CSP change** because
`blob:` is already in `script-src`. Fetched bundles are cached in IndexedDB (`bundleCache.ts`, keyed
by plugin id and exact version) and reused when offline. Every load, `onload` and `onunload` is
wrapped in try/catch: a throwing plugin is auto-disabled and flagged, never fatal to boot. Boot runs
after login/sync (`initPlugins`), built-ins first, loading only the enabled set.

**State and sync.** Per-device state lives in `localStorage["zam_plugins"]` (`pluginPersist.ts` —
which plugins are installed and enabled, their source and repo ref, cached manifest, auto-update
flag); per-plugin settings live under their own namespaced key (`pluginSettingsStore.ts`). There is
**no background sync**. A manual "Sync plugins" button pushes and pulls the enabled list and settings
through Matrix account data (`moe.crafty.matrix.plugins`, `pluginSync.ts`). A pull is **two-step
consent**: it shows a summary of what would be enabled, disabled or changed, and never fetches or runs
a repo plugin that isn't already installed on this device.

**Settings are schema-driven** (`settingsSchema.ts`, `settingsForm.ts`). A plugin declares fields —
`toggle`, `text`, `number`, `select`, and a **`list`** of records — and the Manager renders a
consistent form (`PluginSettingsForm.svelte`, reached from the gear button). Labels and values render
as escaped text.

**Host-rendered plugin HTML is sanitized.** A plugin builds its own DOM inside `ui`, panel and
popover mounts — that is the plugin's own responsibility under the full-trust model — but anywhere
Zam renders HTML _on a plugin's behalf_ it passes through `sanitizeMatrixHtml`: custom-embed markup
via `embeds.ts` `mountEmbed` (`el.innerHTML = sanitizeMatrixHtml(markup)`), and message decorators
render as escaped text, never `{@html}`. Plugin popovers claim a `plugin-popover` modal slot and
plugin room-panels a `plugin` sidebar slot, sharing the UI slot system like core UI.

**The Manager UI** is the "Plugins" settings tab (`PluginsSettings.svelte`): Installed (enable
toggle, gear, update badge, remove), Browse (per-repo `index.json` listings plus Install), Repos (the
official repo, non-removable, plus user-added repos behind a third-party consent warning), and
Actions (Sync, a Disable-all kill switch, and the auto-update toggle).

**Built-in plugins** (`builtins/`, all default-enabled): `zam.slash-fun` (the novelty text-transform
commands `/me`, `/shrug`, `/spoiler`, …), `zam.double-tap-reply` (double-tap a message to reply, edit
or react per its settings; it registers its gesture handler only while an action is configured, so
default word-selection is preserved), and `zam.text-replacer` (user-configured outgoing text
substitutions).

## Security

- **Untrusted HTML must be sanitized.** Other users' `formatted_body` and reaction keys are
  rendered with `{@html}`; route everything through `sanitizeMatrixHtml()` (DOMPurify with a Matrix
  allowlist) and never `{@html}` a raw reaction key. The plain-text path is safe only because it
  escapes before converting — keep that invariant.
- **A production-only CSP** (`svelte.config.js`) is the backstop. The load-bearing directive is
  `script-src` without `unsafe-inline`. It is applied at build time only, so a dev-server test
  proves nothing about it.
- Never interpolate remote event content into a style string.

## Testing

Vitest under jsdom, with the Svelte plugin loaded so `.svelte.ts` rune stores compile — which means
**stores are unit-testable**, not just plain utils. Tests are colocated as `<name>.test.ts` next to
the module.

The house rule is visible in the ratio: `src/lib/utils/` is overwhelmingly pure modules each with
its own test file, and there are **no component tests at all**. **Extract the logic out of
components and `client.ts` into a pure util, TDD it there, and verify the SDK/UI wiring live.** A
consequence worth naming: component _wiring_ is unproven by the suite, so a mutation to a `.svelte`
file can leave every test green.

## Build & deploy

- `npm run dev` — Vite dev server. `npm run dev:https` serves over HTTPS on 5443, which is what
  service-worker and web-push work needs.
- `npm run build` — static output in `build/`. Deploy anywhere; SPA fallback is **`index.html`**
  (e.g. nginx `try_files $uri $uri/ /index.html;`). This is also the only place the CSP is applied.
- `npm run check` — svelte-check. `npm run test` — Vitest, run-once. `npm run format` — Prettier.
- **`npm run lint` is broken** — there is no root ESLint flat config, so the `eslint .` half
  errors. Prettier is the formatting source of truth. Don't try to "fix" lint.
- Android: `npx cap sync android`, then build in Android Studio (`webDir` → `build/`).
- Desktop: `npm run electron:build` (electron-builder).

## Conventions for continuing development

1. **Add SDK capabilities as thin wrappers in `client.ts`.** Components import SDK _types_ only.
   Crypto goes in `crypto.ts`.
2. **Subscribe via the `on*` helpers** and always call the returned unsubscribe in teardown.
3. **When an SDK object mutates in place, bump a tick** and read it inside the relevant `$derived`.
4. **Re-check ownership after every await** in long-lived async work — the captured client
   reference for SDK work, a destroyed flag or a generation counter for component-scoped work
   (media capture especially).
5. **New popups/panels go through the slot system** and render from the slot — no ad-hoc `showX`
   booleans. Pass a `close` that resets your local data, and release with the `*IfOwner` helpers.
6. **New global keyboard shortcuts go in `onWindowKeydown`** in `AppShell.svelte`, not in
   components.
7. **Overlays that could be clipped use `<Portal>`**; desktop popovers use the local `positionMenu`
   action (currently duplicated in the three context-menu components); touch context menus render
   as bottom sheets.
8. **Never call an SDK send/receipt function unguarded inside a tracked `$effect`.** They
   synchronously synthesize local echo and fire app-level listeners, so listener reads become the
   effect's dependencies while listener writes retrigger it — `effect_update_depth_exceeded`, which
   freezes the whole component. Wrap in `untrack()` _and_ make the call idempotent.
9. **Failures must surface.** Optimistic UI updates roll back on rejection, and the error goes to
   the toast store. Never let a rejected write leave the UI claiming success.
10. **Extract pure logic to `utils/` with a test**; keep components about rendering.
11. **Svelte 5 only** — `$state`/`$derived`/`$effect`, no `svelte/store`. `{@const}` must be an
    immediate child of a block, not of a plain element.
12. **The timeline is a plain chronological flex column** — DOM order is visual order. Do not
    reintroduce `flex-col-reverse`; it breaks cross-message text selection.
13. **Plugins extend, never gate.** New optional or compose-side behaviour can be a plugin, but
    never gate the _rendering_ of any inbound event or msgtype behind one — Zam displays everything
    with zero plugins installed. Plugins call the `zam` host API only; only `hostApi.ts` and
    `pluginBoot.ts` reach `client.ts`, and any plugin HTML the host renders goes through
    `sanitizeMatrixHtml`. See "Plugin system".
