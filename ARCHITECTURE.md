# Architecture & Design

## What this is

A Discord-styled Matrix chat client. Despite the repo/folder name (`vue_matrix_client`), there is **no Vue** here — it's **SvelteKit + Svelte 5**. It builds to static files, runs in the browser, and is also packaged as an Android app via Capacitor with FCM push notifications.

## Tech stack

- **SvelteKit** with `adapter-static` (no SSR; single static build)
- **Svelte 5** runes throughout (`$state`, `$derived`, `$effect`, `$props`, `{#snippet}`)
- **TypeScript**
- **Tailwind CSS**, Discord-inspired palette (`discord-background`, `discord-accent`, `discord-textMuted`, …)
- **matrix-js-sdk** v34 — the only place the SDK is imported
- **marked** (markdown), **@twemoji/api** (emoji), **@ruffle-rs/ruffle** (legacy Flash embeds)
- **Capacitor** + **@capacitor/push-notifications** (Android/FCM)

## Top-level layout

```
src/
  routes/
    +layout.svelte, +layout.ts        -- root layout; ssr=false, prerender=true
    +page.svelte                       -- login screen
    app/+page.svelte                   -- THE main 3-pane app + global keyboard/back handling
  lib/
    config.ts                          -- DEFAULT_HOMESERVER
    push.ts                            -- Capacitor/FCM push (no-op on web)
    matrix/
      client.ts                        -- the matrix wrapper (~2200 lines, ~150 exports)
    stores/
      interface.svelte.ts              -- centralised UI state: modal/sidebar slots, keyboard hooks
      auth.svelte.ts                   -- session (persisted to localStorage)
      rooms.svelte.ts                  -- active space/room, layout, "tick" counters
      messages.svelte.ts               -- per-room timeline cache + ticks
      notifications.svelte.ts          -- "loud" (sound) notification tracking + inbox feed
      favourites.svelte.ts             -- favourite GIFs (synced via account data)
    components/
      layout/                          -- screen-region components
      messages/                        -- message rendering + composer
      ui/                              -- reusable atoms (Avatar, Portal, pickers, embeds)
      debug/DebugPanel.svelte          -- dev inspector (Ctrl+Shift+D)
    utils/                             -- markdown, formatters, twemoji, colors
    data/emojis.ts                     -- unicode emoji catalog
android/                               -- Capacitor Android shell
capacitor.config.ts                    -- appId moe.crafty.matrix, webDir build
```

## Data flow

```
matrix-js-sdk client (singleton in client.ts)
        |  emits sync / timeline / account-data / receipt / typing events
        v
client.ts subscriber helpers (onTimelineEvent, onAccountData, onRoomUpdate, onAnyReceiptEvent, ...)
        |  registered in routes/app/+page.svelte onMount
        v
$state stores (rooms, messages, notifications, favourites, interface)
        |  Svelte 5 reactivity
        v
components re-render
```

**Tick pattern.** SDK objects mutate in place, which Svelte can't observe. Stores expose monotonic counters (`roomsState.unreadTick`, `roomsState.roomsTick`, `messagesState.reactionTick`, `messagesState.timelineTick`, `notificationsState.tick`). Event handlers bump a tick; components read it inside a `$derived` (e.g. `void roomsState.unreadTick`) so the derived re-runs even though the underlying object identity didn't change. This is the bridge between the SDK's event-driven model and Svelte's pull-based reactivity.

## src/lib/matrix/client.ts (the core)

The single module that imports `matrix-js-sdk`. Everything else calls these wrappers; components import only the `Room`/`MatrixEvent` *types* from the SDK, never the client. Roughly grouped:

- **Lifecycle**: `getClient`, `login`, `register`, `reconnect`, `startSync`, `logout`, `stopClient`
- **Rooms/spaces**: `getRooms`, `getRoom`, `getSpaces`, `getSpaceChildIds`, `getRoomsInSpace`, `getOrphanRooms`, `getDirectRooms`, `getInvitedRooms`, `fetchSpaceHierarchy`
- **Creation/join**: `createRoom(name, topic, spaceId?)`, `createSpace`, `addRoomToSpace`, `canAddRoomToSpace`, `joinRoom`, `joinRoomByAlias`, `createDirectMessage`, `acceptInvite`, `rejectInvite`, `leaveRoom`
- **Display**: `getRoomDisplayName`, `getRoomAvatar`, `getRoomTopic`, `getMemberName`, `getMemberAvatar`, `getRoomMembers`
- **Messages**: `getTimelineMessages`, `getLatestTimelineEvent`, `sendTextMessage`, `sendFormattedMessage`, `sendReply`, `sendEdit`, `sendSticker`, `sendFile`, `deleteMessage`, `loadPreviousMessages`, `loadMessagesUntilEvent`, `loadContextAroundEvent`, `findEventById`, `fetchEventById`
  - Note: `sendTextMessage` passes an explicit `null` threadId — the SDK's overload shim otherwise treats a body starting with `$` as a thread ID.
- **Reactions/receipts/typing**: `getReactions`, `sendReaction`, `removeReaction`, `sendReadReceipt`, `getReadUpToEventId`, `getReceiptsForEvent`, `sendTyping`, `onTypingEvent`
- **Unread + loud**: `getUnreadCount`, `getHighlightCount`, `getRoomUnreadInfo`, `isLoudEvent` (true when an event's push actions include the `sound` tweak)
- **Notifications API**: `fetchServerNotifications(limit, from?)` — `GET /_matrix/client/v3/notifications`; returns `null` if the homeserver doesn't support it
- **Push rules**: `DEFAULT_PUSH_RULES`, `PushRuleLevel = "loud" | "silent" | "off"`, `getDefaultPushRuleLevel`, `setDefaultPushRuleLevel` (handles server-default dotted rule IDs that reject creation), `RoomNotificationSetting = "default" | "all" | "mentions" | "mute"`, `getRoomNotificationSetting`, `setRoomNotificationSetting`
- **Power levels / moderation**: `getMyPowerLevel`, `getRoomPowerLevels`, `setRoomPowerLevels`, `setUserPowerLevel`, `kickUser`, `banUser`, `unbanUser`, `getBannedMembers`
- **Room admin**: `setRoomName`, `setRoomTopic`, `setRoomAvatar`, `getJoinRule`, `setJoinRule`, `getHistoryVisibility`, `setHistoryVisibility`, `pinMessage`, `unpinMessage`, `getPinnedEventIds`
- **Custom emoji/stickers**: `getCustomEmojis`, `getCustomEmojiPacks`, `getCustomStickerPacks`
- **Space layout** (custom account-data, folders + ordering): `SpaceLayout`, `getSpaceLayout`, `setSpaceLayout`, `getSpaceOrder`, `setSpaceOrder`
- **Media**: `mxcToHttp`, `fetchAttachmentBlob`, `getContentType`, `uploadContent`, `getRawUrlPreview`, `getUrlPreview`
- **Subscriptions** (each returns an unsubscribe fn): `onTimelineEvent`, `onLocalEchoUpdated`, `onEditEvent`, `onReactionEvent`, `onRedactionEvent`, `onReceiptEvent`, `onAnyReceiptEvent`, `onRoomUpdate`, `onAccountData`, `onSyncPrepared`, `onTypingEvent`
- **Service worker** for media auth: `initServiceWorker`, `updateServiceWorkerAuth`

## Stores (all Svelte 5 `$state`, live outside components)

- **`interface.svelte.ts`** — centralised UI state. See "Modal/sidebar system" below. Holds device flags (`isMobile`, `isTouchscreen`), the `leftOpen` mobile drawer flag, `lightboxOpen`, `selectedMessageId` (mobile message-action selection), `debugOpen`, `composerPicker`, `focusComposer`, and the two slot pairs `modal`/`modalClose` + `sidebar`/`sidebarClose`. Helpers: `openModal`, `closeModal`, `clearModal`, `openSidebar`, `closeSidebar`, `clearSidebar`, `openComposerPicker`.
- **`auth.svelte.ts`** — `auth` (isAuthenticated, userId, accessToken, deviceId, homeserverUrl, syncState, error). Persisted to `localStorage["matrix_session"]`. `saveSession`, `loadStoredSession`, `clearSession`.
- **`rooms.svelte.ts`** — `roomsState` (spaces, orphanRooms, directRooms, invitedRooms, activeSpaceId, activeRoomId, showInbox, roomsInSpace, spaceHierarchy, hierarchyLoading, unreadTick, roomsTick, spaceLayout). Active space/room persisted per-space in localStorage. `setActiveSpace`, `setActiveRoom`, `bumpUnreadTick`, `getActiveRoom`.
- **`messages.svelte.ts`** — `messagesState.byRoom` = `Record<roomId, { events, isLoading, canLoadMore }>` (plain object for Svelte deep reactivity). `getMessages`, `setMessages`, `appendMessage`, `prependMessages`, plus `reactionTick`/`timelineTick`.
- **`notifications.svelte.ts`** — tracks notifications, each flagged `loud` (sound-triggering) or silent. `notificationsState.byRoom` persisted to `localStorage["matrix_loud_notifications"]`. `markNotification`, `clearReadNotifications(room, userId)`, `hasLoudInRoom`, `hasLoudInSpace`, `getLoudEventIds`, `getAllNotifications`. Loud entries drive the red unread dots; the inbox panel shows both loud and silent.
- **`favourites.svelte.ts`** — favourite GIFs via account data (`m.favourite_gifs`); `initFavourites()` reloads on sync/account-data.

## Components

### layout/
- **`SpaceSidebar.svelte`** (~1400 lines) — left rail of space icons + folders (collapse/expand, color via HSV picker, drag reorder; HTML5 drag on desktop, custom long-press touch drag on mobile). Home/Settings buttons. Space/folder context menus (Portal). Inline create-room / add-room modals.
- **`RoomList.svelte`** — second pane: rooms in the active space (or DMs/orphans on home). Header `+` dropdown hosts `QuickActions` + Space Settings. Hover gear → room settings. Room context menu (right-click / long-press). Red dot when a room has a loud notification.
- **`MessageArea.svelte`** (~1000 lines) — timeline + composer host. Owns the right-side panels (member list / pinned / notifications) via the `sidebar` slot, plus the mobile drawer drag animations for them. Top-bar buttons toggle the panels.
- **`MemberList.svelte`**, **`PinnedMessagesPanel.svelte`**, **`NotificationsPanel.svelte`** — the three right-side panels. NotificationsPanel prefers `fetchServerNotifications` and falls back to the local `notificationsState` (clearable only in the fallback case).
- **`AppSettings.svelte`** — account info, push-rule levels per category (Loud/Silent/Off + sound toggle), per-room overrides, logout.
- **`RoomSettings.svelte`** — manage a room *or* space: name, topic, avatar, members, bans, power levels, join rule, history visibility.
- **`QuickActions.svelte`** — New DM / Create Room / Create Space / Join by Address / Add Room to Space; behavior gated by whether a `spaceId` is set. Modal rendered through a Portal.
- **`InboxPanel.svelte`** — pending invites.
- **`ThreadPanel.svelte`** — thread replies (note: references some not-yet-implemented `client.ts` thread helpers; pre-existing type errors).

### messages/
- **`MessageItem.svelte`** (~1100 lines) — one event: sender/avatar/timestamp, markdown body, media, reactions, reply quoting, edit/delete, pin, reaction emoji picker. Yellow highlight when `isLoudEvent(event)`. Mobile long-press action sheet.
- **`MessageInput.svelte`** (~1000 lines) — composer: send, file queue, mention autocomplete, `:emoji:` autocomplete, reply/edit, emoji/sticker/gif pickers. Registers `interfaceState.focusComposer`.
- **`Reactions.svelte`**, **`LinkPreview.svelte`**, **`MediaPreview.svelte`**.

### ui/
- **`Avatar.svelte`**, **`Portal.svelte`** (appends node to `document.body` to escape stacking contexts), **`EmojiPicker.svelte`** / **`GifPicker.svelte`** / **`StickerPicker.svelte`**, **`Lightbox.svelte`**, **`FlashEmbed.svelte`** / **`SwfEmbed.svelte`** (Ruffle).

## Modal / sidebar system (the central UI pattern)

All popups and panels are coordinated through two mutually-exclusive slots in `interfaceState`:

- **`modal`** (`ModalId | null`) + **`modalClose`** — exactly one popup at a time: app-settings, room-settings, quick-actions, room-menu, room-header-menu, space-menu, color-picker, create-room, add-room, reaction-picker, composer-picker, lightbox.
- **`sidebar`** (`SidebarId | null`) + **`sidebarClose`** — exactly one side panel at a time: members, pinned, notifications.

Rules:
- Components **render from the slot** (`{#if interfaceState.modal === "space-menu"}`) and keep only their *associated data* locally (coordinates, target Room, etc.), set just before calling the helper.
- **`openModal(id, close)`** sets the slot and auto-runs the previous occupant's `close` first (enforcing one-at-a-time). **`closeModal()`** clears the slot and runs the close handler. **`clearModal(id)`** clears without re-running close (used by a component dismissed by its own means; e.g. Lightbox on unmount). Same trio for sidebars.
- The `close` function a component passes is what resets its local data (`() => (contextMenu = null)`), so dismissal works no matter who triggers it.

This is why opening, say, the QuickActions modal from the RoomList header dropdown automatically closes the dropdown: they occupy the same `modal` slot.

## Keyboard + back-button handling (centralised in routes/app/+page.svelte)

There is **one** `<svelte:window onkeydown>` for the whole app (`onWindowKeydown`). Components do **not** register global key handlers; only element-scoped, focus-dependent editor keybindings remain local (e.g. the composer's Enter-to-send / autocomplete arrows, message edit/delete-confirm keys, modal Enter-to-submit, picker selection arrows).

Global shortcuts in `onWindowKeydown`:
- **Escape** → `dismissTopmost()`: close the open `modal`, else the open `sidebar`.
- **Ctrl+Shift+D** → toggle `interfaceState.debugOpen` (DebugPanel reads it).
- **Ctrl+E / Ctrl+S / Ctrl+G** → `openComposerPicker("emoji" | "sticker" | "gif")` when a room with a composer is visible.
- **Type-to-focus**: a plain alphanumeric key (no Ctrl/Alt/Meta) focuses the composer via `interfaceState.focusComposer()` — skipped when a modal is open, when (on mobile) a sidebar/drawer is open, or when focus is already in an input/textarea/contenteditable. It does **not** `preventDefault`, so the triggering character lands in the now-focused composer.

Mobile **back button** (`popstate` + a pushed history "guard" entry):
- Priority: dismiss `modal` → dismiss `sidebar` → open the left drawer (`leftOpen`) → real back navigation.
- A reactive `$effect` calls `ensureBackGuard()` to keep a guard entry on the stack whenever there's something to intercept (a modal, a sidebar, or the drawer is closed). On Capacitor Android the hardware back button drives the same `popstate`.

## Other recurring patterns

- **Portals for overlays.** Anything needing full-viewport coverage (context menus, dropdowns, modals) is wrapped in `<Portal>` so ancestor stacking contexts don't clip it. Touch context menus render as bottom sheets; pointer menus use a `positionMenu` action that measures the element and flips/clamps it to the viewport.
- **Touch vs pointer dual rendering.** Context menus use a `touch: boolean` field + a shared `{#snippet menuContent()}` so the same markup serves a bottom sheet (touch) and a positioned popover (pointer). Touch is detected as `!(e instanceof MouseEvent)`.
- **Enter-to-send physical-keyboard detection.** The composer sends on Enter only for a *physical* press: `!e.isComposing && e.keyCode !== 229` (229 = Android soft-keyboard/IME sentinel) **and** `!interfaceState.isMobile` (phones always newline + use the send button). Shift+Enter is always a newline.
- **Mobile drawer.** `app/+page.svelte` animates a left-edge swipe drawer (SpaceSidebar + RoomList) via `drawerTranslate`, with direction detection and a release threshold. Swipe is gated off when a modal/sidebar/lightbox is open.

## Notifications

A message whose push actions include the `sound` tweak (see `isLoudEvent`) is a "loud" notification:
1. `onTimelineEvent` in `+page.svelte` plays the ping (if enabled); it calls `markNotification` for every notifying event (loud or silent).
2. The originating room — and every space/folder containing it — shows a **red** unread indicator (`hasLoudInRoom` / `hasLoudInSpace`).
3. The message itself renders with a yellow highlight in the timeline.
4. The notifications inbox panel lists them (server-backed when available).
5. `onAnyReceiptEvent` calls `clearReadNotifications` to drop entries the user has now read.

## Push notifications

- **Web**: browser Notification API from foreground sync events.
- **Android (Capacitor + FCM via Sygnal)**: `src/lib/push.ts` `initPush(client)` (no-op off-native) requests permission, gets the FCM token, and registers an HTTP Matrix pusher pointing at a [Sygnal](https://github.com/matrix-org/sygnal) gateway. The homeserver POSTs to Sygnal (`POST /_matrix/push/v1/notify`), which forwards to FCM. Tapping a notification calls `navigateToRoom`. `PUSH_GATEWAY_URL` (build-time `VITE_PUSH_GATEWAY_URL`) / `APP_ID` in `push.ts` must match the Sygnal config (see `ANDROID_PUSH_SETUP.md`). `unregisterPush` runs on logout. There is no in-repo gateway — Sygnal is deployed separately.

## Service worker for media auth

Matrix `mxc://` media needs an `Authorization: Bearer` header that `<img src>` can't send. The service worker (`initServiceWorker` / `updateServiceWorkerAuth`) intercepts media fetches and injects the header; the token is refreshed on login/logout.

## Routing & persistence

- `/` → login (`routes/+page.svelte`); on success navigates to `/app`.
- `/app` → main UI; bootstraps the SDK, registers subscribers, owns global keyboard/back handling; redirects to `/` if unauthenticated.
- `+layout.ts`: `ssr = false`, `prerender = true`.
- localStorage keys: `matrix_session`, `matrix_last_space`, `matrix_last_room_by_space`, `notifSoundEnabled`, `matrix_loud_notifications`. Space layout (folders/order) and favourite GIFs persist via Matrix **account data** so they sync across devices.

## Build & deploy

- `npm run dev` — Vite dev server.
- `npm run build` — static output in `build/` (deploy anywhere; SPA, no backend). Refresh-on-deep-path needs SPA fallback (e.g. nginx `try_files $uri $uri/ /app.html;`).
- `npm run check` — svelte-check. `npm run lint` — prettier + eslint.
- Android: `npx cap sync android`, then build in Android Studio (`webDir` → `build/`).
- Push gateway is a separate Node service needing Firebase credentials and reachability from the homeserver.

## Conventions for continuing development

1. **Never import `matrix-js-sdk` outside `client.ts`.** Add a wrapper export. Components may import SDK *types* only.
2. **Subscribe via the `on*` helpers** and always call the returned unsubscribe in teardown.
3. **When an SDK object mutates in place, bump a tick** and read it inside the relevant `$derived`.
4. **New popups/panels go through the slot system** (`openModal`/`openSidebar`) and render from the slot — don't add ad-hoc `showX` booleans. Pass a `close` that resets your local data.
5. **New global keyboard shortcuts go in `onWindowKeydown`** in `app/+page.svelte`, not in components. Keep focus-dependent editor keybindings local to their element.
6. **Overlays that could be clipped use `<Portal>`**; desktop popovers use the `positionMenu` action.
7. **Server-default push rules** (dotted IDs like `.m.rule.roomnotif`) can't be created via `addPushRule`; `setDefaultPushRuleLevel` already handles this by updating local state when the server rejects.
8. **Svelte 5 only** — `$state`/`$derived`/`$effect`, no `svelte/store`.
9. **The repo name is misleading** — there is no Vue anywhere.
