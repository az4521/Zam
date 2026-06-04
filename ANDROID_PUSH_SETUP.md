# Push Notifications (Sygnal)

Both platforms register a Matrix pusher with the homeserver pointing at
**Sygnal** (<https://github.com/matrix-org/sygnal>), which fans out to the right
transport. There are two independent paths with two different `app_id`s, served
by the same Sygnal:

- **Android app** (`moe.crafty.matrix`) → Sygnal **`gcm`/`fcm_v1`** app → FCM.
  Needs a Firebase project + `google-services.json`.
- **PWA / browser** (`moe.crafty.matrix.webpush`) → Sygnal **`webpush`** app →
  the browser's own Web Push service. **No Firebase / FCM** — uses a VAPID
  keypair and the standard Web Push API. See "PWA / Web Push" below.

```
Android: App (FCM token)  ─registers pusher─▶ Homeserver ─▶ Sygnal(gcm)     ─▶ FCM           ─▶ device
PWA:     PushManager sub  ─registers pusher─▶ Homeserver ─▶ Sygnal(webpush) ─▶ browser push  ─▶ service worker
```

## 1. Firebase project

1. Create a project at <https://console.firebase.google.com/>.
2. Add an **Android app** with package name `moe.crafty.matrix`.
3. Download **`google-services.json`** → place at `android/app/google-services.json`.
   (The Gradle build only enables FCM when this file is present; without it the
   app still runs, just without push.)
4. Project Settings → Service Accounts → **Generate new private key** — you'll
   give this to Sygnal.

## 2. Deploy Sygnal

Follow the Sygnal docs. A minimal `sygnal.yaml` app entry for this client:

```yaml
apps:
  moe.crafty.matrix:
    type: gcm
    # FCM v1 with a service account (recommended):
    api_version: v1
    project_id: your-firebase-project-id
    service_account_file: /path/to/service-account.json
```

Run Sygnal behind HTTPS so the homeserver can reach it, e.g.
`https://sygnal.example.com/_matrix/push/v1/notify`.

## 3. Point the app at Sygnal

Set the gateway URL at build time (preferred):

```bash
VITE_PUSH_GATEWAY_URL="https://sygnal.example.com/_matrix/push/v1/notify" npm run build
```

In CI it's read from the repository **variable** `PUSH_GATEWAY_URL`
(Settings → Secrets and variables → Actions → Variables). If unset, the app
builds with push disabled.

Alternatively, edit the fallback in `src/lib/push.ts`.

## 4. Build & install

```bash
npm run build
npx cap sync android      # copies web assets, wires the FCM plugin + google-services.json
npx cap open android      # then Run from Android Studio
```

For CI builds to include push you must also provide `google-services.json` to
the workflow (e.g. base64 in a secret, decoded before `npx cap sync`).

## 5. Verify

1. Launch the app, log in, **grant the notification permission**.
2. Confirm an HTTP pusher was registered with the homeserver pointing at your
   Sygnal URL.
3. Background the app and send a message from another account → notification
   appears. Tapping it opens the room.

## Notes

- Foreground notifications are handled in `src/lib/push.ts`.
- **Background/killed notifications** are displayed by a native service,
  `MatrixMessagingService` (`android/app/src/main/java/moe/crafty/matrix/`).
  Sygnal sends *data-only* FCM messages, and the Capacitor push plugin only
  shows a notification when the message contains a `notification` block — so
  without this service, backgrounded pushes arrive but are never displayed.
- **Notification enrichment:** Sygnal's `event_id_only` pushes carry only IDs,
  so the service calls the homeserver to fetch the message body, sender display
  name, room name, and room avatar (shown as the large icon). It uses the
  session (homeserver URL + access token) that the web layer mirrors into
  native storage via `src/lib/nativeSession.ts` (`@capacitor/preferences` →
  SharedPreferences `CapacitorStorage`). If the session is missing or a request
  fails, it falls back to a generic "New message" notification.
- Tapping a notification deep-links to the room via `window.__matrixOpenRoom`
  (wired in `+page.svelte` / `MainActivity.java`).
- `unregisterPush` removes the pusher on logout.
- Web/desktop notifications don't use FCM/Sygnal at all — they use the in-app
  Notification API while the client is running.

### After changing native push code

`MatrixMessagingService.java`, `MainActivity.java`, the manifest, and the app
`build.gradle` are committed native files. After pulling changes rebuild the
APK (Android Studio or the release workflow). No `npx cap sync` is needed for
edits under `android/`.

---

# PWA / Web Push (no FCM)

The installable web app gets notifications via the W3C Web Push API + Sygnal's
`webpush` pushkin. No Firebase, no `google-services.json` — just a VAPID keypair.

## 1. Generate a VAPID keypair

```bash
npx web-push generate-vapid-keys
```

Keep the **private** key for Sygnal; the **public** key goes to the app build.

## 2. Add a `webpush` app to Sygnal

```yaml
apps:
  moe.crafty.matrix.webpush:
    type: webpush
    vapid_private_key: "<private key>"
    vapid_contact_email: you@example.com
```

(Add this alongside the `moe.crafty.matrix` gcm app — both can coexist.)

## 3. Build the app with the public key

Set `VITE_VAPID_PUBLIC_KEY` (and `VITE_PUSH_GATEWAY_URL`) at build time:

```bash
VITE_VAPID_PUBLIC_KEY="<public key>" \
VITE_PUSH_GATEWAY_URL="https://sygnal.example.com/_matrix/push/v1/notify" \
npm run build
```

In CI these come from repository **variables** `VAPID_PUBLIC_KEY` and
`PUSH_GATEWAY_URL`. If `VITE_VAPID_PUBLIC_KEY` is unset, web push is simply
disabled (the app still works).

## 4. Use it

1. Open the deployed site over **HTTPS**, install it as a PWA (or just use it in
   the browser), log in, and **grant the notification permission**.
2. The app subscribes via `PushManager` and registers a `webpush` pusher.
3. Background the tab / app and send a message from another account → the
   service worker shows the notification (enriched with sender, message text,
   room name and avatar — it fetches these from the homeserver using the auth
   already stored in the SW). Tapping it focuses the app and opens the room.

### How it works (code)

- `src/lib/webPush.ts` — permission, `PushManager` subscription, and pusher
  registration (`app_id` `moe.crafty.matrix.webpush`, pushkey = endpoint,
  p256dh/auth keys in `data`).
- `static/sw.js` — `push` and `notificationclick` handlers, with the same
  homeserver-enrichment as the Android service.
- Requires HTTPS and a registered service worker (already used for media auth).
- iOS Safari supports web push only for apps **added to the Home Screen**
  (iOS 16.4+).
