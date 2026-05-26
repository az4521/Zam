# Architecture & Design

## What this is

A Discord-styled Matrix chat client. Despite the repo name (`vue_matrix_client`), the codebase is **SvelteKit + Svelte 5**, not Vue. It runs as a static web app and is also packaged as an Android app via Capacitor with FCM push notifications.

## Tech stack

- **SvelteKit** with `adapter-static` — no SSR, single static `build/` output
- **Svelte 5** with runes (`$state`, `$derived`, `$effect`, `$props`, `{#snippet}`)
- **TypeScript**
- **Tailwind CSS** for all styling, with Discord-inspired colors (`discord-background`, `discord-accent`, `discord-textMuted`, etc.)
- **matrix-js-sdk** v34 — the official Matrix client SDK
- **marked** for markdown rendering, **@twemoji/api** for emoji rendering
- **@ruffle-rs/ruffle** for embedded Flash playback (legacy media support)
- **Capacitor** + **@capacitor/push-notifications** for Android/FCM

## Top-level layout

```
src/
  routes/
    +layout.svelte, +layout.ts    -- root layout, redirects to /app or /login
    +page.svelte                   -- login screen
    app/+page.svelte               -- the main 3-pane application
  lib/
    config.ts                      -- DEFAULT_HOMESERVER, INLINE_MEDIA_HOSTNAMES, FLASH_HOSTNAMES, IG_PROXY
    push.ts                        -- Capacitor/FCM push setup (no-op on web)
    matrix/
      client.ts                    -- THE matrix wrapper (~2200 lines, ~150 exports)
    stores/
      auth.svelte.ts               -- session info, persisted to localStorage
      rooms.svelte.ts              -- active space/room, layout, ticks
      messages.svelte.ts           -- byRoom timeline cache + ticks
      mobile.svelte.ts             -- isMobile, isTouchscreen, drawer state
      favourites.svelte.ts         -- favourite GIFs (synced via account data)
    components/
      layout/                      -- big screen-region components
      ui/                          -- reusable atoms (Avatar, Portal, pickers, embeds)
    utils/                         -- markdown, formatters, twemoji, colors
    data/emojis.ts                 -- unicode emoji catalog
push-gateway/
  server.js                        -- Express + firebase-admin Matrix push gateway
android/                           -- Capacitor Android shell
capacitor.config.ts                -- appId: moe.crafty.matrix, webDir: build
```

## The big picture: how data flows

```
matrix-js-sdk client (singleton in client.ts)
        |
        |  emits sync/timeline/account-data/typing events
        v
client.ts subscriber helpers (onTimelineEvent, onAccountData, onRoomUpdate, ...)
        |
        |  registered in src/routes/app/+page.svelte during onMount
        v
$state stores (rooms.svelte.ts, messages.svelte.ts, favourites.svelte.ts)
        |
        |  reactive Svelte 5 runes
        v
components re-render
```

**Key pattern: "tick" counters.** Several stores expose monotonic counters (`unreadTick`, `roomsTick`, `reactionTick`, `timelineTick`). When SDK events fire, we bump a tick. Components that need to react read the tick inside `$derived` (e.g. `void roomsState.unreadTick`) so Svelte re-derives even though the underlying SDK objects mutate in place. This is the bridge between the SDK's mutable, event-driven model and Svelte's pull-based reactivity.

## src/lib/matrix/client.ts (the heart)

This is the only file that imports from `matrix-js-sdk`. Everything else uses these wrappers. ~150 exports, grouped roughly:

- **Lifecycle**: `getClient`, `login`, `register`, `reconnect`, `startSync`, `logout`, `stopClient`
- **Rooms/spaces**: `getRooms`, `getRoom`, `getSpaces`, `getSpaceChildIds`, `getRoomsInSpace`, `getOrphanRooms`, `getDirectRooms`, `getInvitedRooms`, `fetchSpaceHierarchy`, `getSpaceChildren`, `setSpaceChildOrder`, `removeSpaceChild`
- **Display**: `getRoomDisplayName`, `getRoomAvatar`, `getRoomTopic`, `getMemberName`, `getMemberAvatar`, `getRoomMembers`
- **Messages**: `getTimelineMessages`, `getLatestTimelineEvent`, `sendTextMessage`, `sendFormattedMessage`, `sendFile`, `sendReply`, `sendEdit`, `sendSticker`, `deleteMessage`, `loadPreviousMessages`, `loadMessagesUntilEvent`, `loadContextAroundEvent`, `findEventById`, `fetchEventById`
- **Reactions**: `getReactions`, `sendReaction`, `removeReaction`
- **Receipts/typing**: `sendReadReceipt`, `getReadUpToEventId`, `getReceiptsForEvent`, `sendTyping`, `onTypingEvent`
- **Unread tracking**: `getUnreadCount`, `getHighlightCount`, `getRoomUnreadInfo`
- **Push rules** (notifications):
  - `DEFAULT_PUSH_RULES` — catalog of 7 categories: DMs, Rooms, Full Matrix ID, Display name, Username, @room, Invitations
  - `PushRuleLevel = "loud" | "silent" | "off"`
  - `getDefaultPushRuleLevel(ruleId)` — reads from `client.pushRules?.global` (live, not stale `getAccountData`)
  - `setDefaultPushRuleLevel(ruleId, kind, level)` — uses `setPushRuleActions` / `setPushRuleEnabled`; falls back to `addPushRule` for non-default rules; for server-default (dotted) rule IDs that fail server-side, silently updates local state
  - `RoomNotificationSetting = "default" | "all" | "mentions" | "mute"`
  - `getRoomNotificationSetting`, `setRoomNotificationSetting` — per-room overrides
- **Power levels & moderation**: `getMyPowerLevel`, `getRoomPowerLevels`, `setRoomPowerLevels`, `setUserPowerLevel`, `kickUser`, `banUser`, `unbanUser`, `getBannedMembers`
- **Room admin**: `setRoomName`, `setRoomTopic`, `setRoomAvatar`, `getJoinRule`, `setJoinRule`, `getHistoryVisibility`, `setHistoryVisibility`, `pinMessage`, `unpinMessage`, `getPinnedEventIds`
- **Creation/joining**: `createRoom(name, topic, spaceId?)`, `createSpace(name, topic)`, `addRoomToSpace`, `canAddRoomToSpace`, `joinRoom`, `joinRoomByAlias`, `createDirectMessage`, `acceptInvite`, `rejectInvite`, `leaveRoom`
- **Custom emoji/stickers**: `getCustomEmojis`, `getCustomEmojiPacks`, `getCustomStickerPacks`
- **Space layout** (custom account-data `m.space_layout` for folders + ordering): `SpaceLayout = { order, folders }`, `getSpaceLayout`, `setSpaceLayout`
- **Subscriptions** (each returns an unsubscribe fn): `onTimelineEvent`, `onLocalEchoUpdated`, `onEditEvent`, `onReactionEvent`, `onRedactionEvent`, `onReceiptEvent`, `onAnyReceiptEvent`, `onRoomUpdate`, `onAccountData`, `onSyncPrepared`, `onTypingEvent`
- **Media**: `mxcToHttp`, `fetchAttachmentBlob`, `getContentType`, `uploadContent`, `getRawUrlPreview`, `getUrlPreview` (Instagram via IG_PROXY)
- **Service worker** for media auth: `initServiceWorker`, `updateServiceWorkerAuth`

## Stores

All stores use Svelte 5 runes (`$state`). They live outside components so any component can import them.

- **`auth.svelte.ts`**: `auth = $state({ isAuthenticated, userId, accessToken, deviceId, homeserverUrl, syncState, error })`. Persisted to `localStorage["matrix_session"]`. Helpers: `saveSession`, `loadStoredSession`, `clearSession`.
- **`rooms.svelte.ts`**: `roomsState` holds `spaces`, `orphanRooms`, `directRooms`, `invitedRooms`, `activeSpaceId`, `activeRoomId`, `showInbox`, `roomsInSpace`, `spaceHierarchy`, `hierarchyLoading`, `unreadTick`, `roomsTick`, `spaceLayout`. Active space/room are persisted per-space in localStorage so re-entering a space restores the last room. Exports `setActiveSpace`, `setActiveRoom`, `bumpUnreadTick`, `getActiveRoom`.
- **`messages.svelte.ts`**: `messagesState.byRoom` is `Record<roomId, { events, isLoading, canLoadMore }>`. Plain object, not a Map (Svelte 5 deep reactivity works better). Exports `getMessages`, `setMessages`, `appendMessage`, `prependMessages`, `setLoading`, `canLoadMore`, `setCanLoadMore`, plus `reactionTick` and `timelineTick`.
- **`mobile.svelte.ts`**: `mobileState = { isMobile, isTouchscreen, leftOpen, rightOpen, selectedMessageId, lightboxOpen, settingsOpen }`. `isMobile`/`isTouchscreen` set on mount in `app/+page.svelte`.
- **`favourites.svelte.ts`**: favourite GIFs persisted via Matrix account data (`m.favourite_gifs`). `initFavourites()` re-loads on `onSyncPrepared` and `onAccountData`.

## Components

### Layout components (`src/lib/components/layout/`)

- **`SpaceSidebar.svelte`** (~1500 lines) — left rail with space icons. Folders (custom: collapse/expand, color, drag), Home button, Settings button, drag-and-drop reordering (HTML5 drag for desktop, custom touch long-press drag for mobile). Right-click / long-press context menu rendered via `<Portal>` (escapes the rail's stacking context for full-viewport overlay). HSV color picker for folder colors.
- **`RoomList.svelte`** (~700 lines) — second pane: list of rooms in active space (or DMs/orphans on home). Header has a `+` dropdown that mounts `<QuickActions>` plus a Space Settings button. Each room row has hover-revealed gear → `onOpenRoomSettings(room)`. Long-press / right-click opens room context menu (also via Portal). Browse Channels section lists nested sub-spaces. Both menus use a `positionMenu` Svelte action that measures the rendered element and flips/clamps so menus never overflow the viewport.
- **`MessageArea.svelte`** (~1000 lines) — message timeline, composer, member typing indicators, reply/edit, file uploads, sticker picker, GIF picker, emoji picker, mention autocomplete. Mobile message-action sheet on long-press. Auto-loads more on scroll, jumps to permalinks, sends read receipts.
- **`RoomSettings.svelte`** — modal/panel for managing the active room: rename, topic, avatar, members, banned, power levels, join rule, history visibility, pinned messages.
- **`AppSettings.svelte`** — global settings: account info, push rule levels per category (Loud/Silent/Off + sound toggle), per-room overrides, theme, logout.
- **`InboxPanel.svelte`** — recent invites/notifications.
- **`MemberList.svelte`** — third pane: room member list with online status.
- **`PinnedMessagesPanel.svelte`** — popover listing pinned messages.
- **`ThreadPanel.svelte`** — thread reply pane.
- **`QuickActions.svelte`** — buttons + modal for: New DM, Create Room, Create Space, Join by Address, Add Room to Space. Behavior depends on `spaceId` prop:
  - Inside a space: only shows "Create room in space" (gated by `canAddRoomToSpace`)
  - On home: shows New DM, Create Room, Create Space, Join by Address
  - Modal is wrapped in `<Portal>` so it persists when the parent dropdown closes
  - Parent passes `onaction={() => dropdownOpen = false}` to close the dropdown after a button is clicked

### UI atoms (`src/lib/components/ui/`)

- **`Avatar.svelte`** — generic avatar with fallback initials and color hash
- **`Portal.svelte`** — `use:action` that appends node to `document.body`. Used to escape stacking contexts for context menus, dropdowns, and modals
- **`EmojiPicker.svelte`**, **`GifPicker.svelte`**, **`StickerPicker.svelte`** — composer pickers
- **`Lightbox.svelte`** — full-screen image/video viewer
- **`FlashEmbed.svelte`**, **`SwfEmbed.svelte`** — Ruffle-based Flash playback for legacy `.swf` files

## Recurring design patterns

### Portals for overlays
All popups, modals, and context menus that need full-viewport coverage are wrapped in `<Portal>`. This is required because:
- Sidebars and panels create CSS stacking contexts that clip `position: fixed` children
- Touch context menus rendered as bottom sheets (`fixed bottom-0 left-0 right-0`) would otherwise be confined to their parent's width

### Touch vs pointer dual rendering for context menus
Both `RoomList.svelte` and `SpaceSidebar.svelte` use the same pattern:
```svelte
type ContextMenu = { ..., touch: boolean, x, y };
{#snippet menuContent()} ... {/snippet}
{#if cm.touch}
    <div class="fixed bottom-0 left-0 right-0 ... rounded-t-2xl max-h-[70vh]">
        {@render menuContent()}
    </div>
{:else}
    <div use:positionMenu={{x: cm.x, y: cm.y}} class="fixed ...">
        {@render menuContent()}
    </div>
{/if}
```
Touch detection: long-press handlers pass plain `{clientX, clientY}` objects (not `MouseEvent`), and the menu opener does `touch: !(e instanceof MouseEvent)`.

### `positionMenu` action for desktop menus
A Svelte action that:
1. Hides node, measures actual width/height in `requestAnimationFrame`
2. Clamps `left` to viewport (with 4px padding)
3. Flips menu upward if it would overflow bottom
4. Sets `maxHeight` to remaining viewport space if too tall
5. Reveals once positioned

Defined inline in `RoomList.svelte` and `SpaceSidebar.svelte` (small enough to duplicate; could be promoted to `src/lib/utils/` if a third menu appears).

### Context menus inside dropdowns
`QuickActions.svelte` modal must outlive the parent dropdown closing. Solution: the dropdown panel is **always mounted** with a `hidden` CSS toggle (not `{#if}`), so QuickActions and its `<Portal>`-mounted modal are never destroyed. The `{#if}` pattern destroys child component state.

### `onaction?: () => void` callback prop
Inner action components (like `QuickActions`) accept an `onaction` callback that the parent uses to close menus/dropdowns after an inner button is clicked. Decouples the inner component from the parent's open-state plumbing.

### Mobile drawer
`src/routes/app/+page.svelte` implements a left-edge swipe drawer for the SpaceSidebar+RoomList combo on mobile. `drawerTranslate` is animated between `0` (open) and `-DRAWER_WIDTH` (closed). Touch events drive it with direction detection (cancels if vertical scroll dominates) and progress threshold (15%/85%) on release.

## Push notifications

### Web
The browser Notification API is invoked from sync events (foreground only).

### Android (Capacitor + FCM)
1. `src/lib/push.ts` `initPush(client)` — called in `app/+page.svelte` `onMount`. No-ops on `Capacitor.isNativePlatform() === false`, so web build is unaffected.
2. Requests notification permission, registers with FCM, gets the device token.
3. Calls `client.setPusher({ kind: "http", app_id: "moe.crafty.matrix", pushkey: fcmToken, data: { url: PUSH_GATEWAY_URL, format: "event_id_only" } })` to register a Matrix pusher with the homeserver pointing at the gateway.
4. The homeserver POSTs to the gateway (`POST /_matrix/push/v1/notify`) when the user has a pending notification.
5. The gateway (`push-gateway/server.js`) forwards via `firebase-admin` to FCM, which delivers to the device.
6. On notification tap, `pushNotificationActionPerformed` reads `room_id` from data and calls `setActiveRoom`.
7. `unregisterPush` is called on logout.

`PUSH_GATEWAY_URL` and `APP_ID` in `src/lib/push.ts` must match the deployed gateway. Setup details are in `ANDROID_PUSH_SETUP.md`.

## Service worker for media auth
Matrix media URLs (`mxc://`) require an `Authorization: Bearer <token>` header. Browsers can't add headers to `<img src>` requests. The service worker (`initServiceWorker`, `updateServiceWorkerAuth` in `client.ts`) intercepts media fetches and injects the auth header. Token is updated on login/logout.

## Routing
- `/` → login form (`src/routes/+page.svelte`). Shows DEFAULT_HOMESERVER. On success, navigates to `/app`.
- `/app` → the main UI (`src/routes/app/+page.svelte`). Bootstraps SDK, registers all subscribers, sets up state, renders three-pane layout. On `auth.isAuthenticated === false`, redirects back to `/`.

## Local persistence
- `localStorage["matrix_session"]` — auth session
- `localStorage["matrix_last_space"]` — last active space ID
- `localStorage["matrix_last_room_by_space"]` — `{ [spaceId]: roomId, "__home__": roomId }`
- `localStorage["notifSoundEnabled"]` — sound toggle for notifications
- All space layout (folders, ordering) persisted via Matrix **account data** (`m.space_layout`), so it syncs across devices
- Favourite GIFs persisted via account data (`m.favourite_gifs`)

## Build & deploy
- `npm run dev` — Vite dev server
- `npm run build` — outputs static `build/`. Deploy as static files anywhere.
- `npm run check` — svelte-check + tsc
- `npm run lint` — prettier + eslint
- Android: standard Capacitor flow — `npx cap sync android`, then build via Android Studio. `capacitor.config.ts` points `webDir` at `build/`.
- Push gateway is a separate Node service (`push-gateway/`) that needs a Firebase service account credential and to be deployed reachable from the homeserver.

## Things to know when continuing development

1. **Don't import `matrix-js-sdk` outside `client.ts`.** Add a wrapper export instead. Components import `Room` and `MatrixEvent` types directly from `matrix-js-sdk` but never the client.
2. **Subscribe to SDK events via the `on*` helpers in `client.ts`** — they all return an unsubscribe function. Always clean up in component teardown / `onMount`'s return.
3. **When SDK objects mutate in place (e.g. unread counts), bump a tick** to force Svelte re-derivation. The pattern is `void roomsState.unreadTick` inside a `$derived`.
4. **Server-default push rules (IDs starting with `.`)** cannot be created via `addPushRule` (HTTP 400) and don't always exist — `setDefaultPushRuleLevel` handles this by silently updating local state if the server rejects.
5. **Context menu / popup placement on desktop**: use the `positionMenu` action for any new menu. Don't use `min(x, calc(100vw - Nrem))` with hard-coded widths.
6. **Any new modal/popup that could be inside a dynamic-mounted parent should use `<Portal>`.**
7. **Mobile vs desktop branching**: prefer the dual-snippet pattern (`{#snippet menuContent()}`) so the markup isn't duplicated.
8. **Svelte 5 only — no Svelte 4 stores.** All state is via `$state`. No `writable`/`readable` from `svelte/store`.
9. **The repo name is misleading** — there is no Vue code anywhere.
