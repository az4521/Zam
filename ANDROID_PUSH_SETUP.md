# Push Notifications (Sygnal)

Zam has **four** notification paths. Only two of them involve a push gateway;
mixing them up is the usual source of confusion, so they are listed separately
here.

| path                            | when it fires                     | who displays it                                                                                          | needs Sygnal?                |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Foreground**                  | the app is open and syncing       | `new Notification(...)` from the sync handler in `AppShell.svelte` — for messages and for incoming calls | no                           |
| **Background web / PWA**        | the tab is closed or backgrounded | `static/sw.js` `push` handler                                                                            | **yes** (`webpush` app)      |
| **Background / killed Android** | the app is not running            | `MatrixMessagingService.java`                                                                            | **yes** (`gcm`/`fcm_v1` app) |

The foreground path is guarded on `typeof Notification === "undefined"`, so it is
the web/desktop path in practice — it only fires on Android if that WebView
exposes the Notification API.

The Capacitor plugin's `pushNotificationReceived` listener in `src/lib/push.ts`
only writes to the console — it does **not** display anything. Anything a user
actually sees while the app is open comes from the web layer's sync path, not
from `push.ts`.

The two background paths register a Matrix pusher with the homeserver pointing at
**Sygnal** (<https://github.com/matrix-org/sygnal>), which fans out to the right
transport. They use two different `app_id`s and can be served by the same Sygnal:

- **Android app** (`moe.crafty.matrix`) → Sygnal **`gcm`/`fcm_v1`** app → FCM.
  Needs a Firebase project + `google-services.json`.
- **PWA / browser** (`moe.crafty.matrix.webpush`) → Sygnal **`webpush`** app →
  the browser's own Web Push service. **No Firebase / FCM** — uses a VAPID
  keypair and the standard Web Push API. See "PWA / Web Push" below.

```
Android: App (FCM token)  ─registers pusher─▶ Homeserver ─▶ Sygnal(gcm)     ─▶ FCM           ─▶ device
PWA:     PushManager sub  ─registers pusher─▶ Homeserver ─▶ Sygnal(webpush) ─▶ browser push  ─▶ service worker
```

## ⚠ Effective defaults — read before deploying a fork

Neither gateway setting is "off by default". Both have a fallback baked into the
source:

- `src/lib/push.ts` — `PUSH_GATEWAY_URL` falls back to
  `https://sygnal.crafty.moe/_matrix/push/v1/notify`.
- `src/lib/webPush.ts` — the same gateway fallback, **plus** a committed public
  VAPID key.

So a build with no env vars set will happily register pushers pointing at this
project's Sygnal instance. See "Turning push off" below for what actually
disables it.

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
(Settings → Secrets and variables → Actions → Variables). If unset, the build
falls back to the project gateway (see the warning above) — it does **not**
disable push.

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
   Sygnal URL. **Settings → Debug Info** does this for you (see "Diagnostics").
3. Background the app and send a message from another account → notification
   appears. Tapping it opens the room.

## Turning push off

There is no single "push: off" switch. What each knob actually does:

- **Android/FCM:** `src/lib/push.ts` treats a gateway URL containing
  `sygnal.example.com` as "not configured" and skips the whole FCM stack. So
  building with `VITE_PUSH_GATEWAY_URL="https://sygnal.example.com/..."` is the
  supported way to disable Android push. Not setting the variable at all does
  the opposite of what you'd expect — it selects the project gateway.
- **Web push:** there is currently **no build-time off switch**.
  `webPushConfigured()` is `!!VAPID_PUBLIC_KEY`, and the key has a committed
  fallback, so it is always true. Setting `VITE_VAPID_PUBLIC_KEY=""` falls back
  to the committed key rather than clearing it. To disable it you must edit the
  fallback in `src/lib/webPush.ts` to an empty string.
- **Per user, at runtime:** both paths only ever run after the user grants the
  browser/OS notification permission, and `unregisterPush` / `teardownWebPush`
  delete the pusher on logout. A user who never grants permission never gets a
  pusher registered.

## Diagnostics

**Settings → Debug Info** is the fastest way to answer "is push actually set up?"
without a dev console. It surfaces:

- the gateway URL this build was compiled with, and whether push is considered
  enabled;
- the notification permission state and the FCM token (Android);
- **the pushers the homeserver actually has** for this account (`GET /pushers`),
  with each one's `app_id`, device display name and the gateway `data.url` — this
  is the source of truth for "did we tell the homeserver about our gateway?";
- a **Sygnal `/health` probe** derived from the configured notify endpoint (200
  means Sygnal loaded its app/FCM config);
- web-push state: supported, configured, permission, whether a `PushManager`
  subscription exists, and its endpoint.

## Notes

- **Background/killed Android notifications** are displayed by a native service,
  `MatrixMessagingService` (`android/app/src/main/java/moe/crafty/matrix/`).
  Sygnal sends _data-only_ FCM messages, and the Capacitor push plugin only
  shows a notification when the message contains a `notification` block — so
  without this service, backgrounded pushes arrive but are never displayed.
- **Notification enrichment:** Sygnal's `event_id_only` pushes carry only IDs,
  so both background paths call the homeserver to fetch the message body, sender
  display name, room name, and room avatar. Android uses the session (homeserver
  URL + access token) that the web layer mirrors into native storage via
  `src/lib/nativeSession.ts` (`@capacitor/preferences` → SharedPreferences
  `CapacitorStorage`); the service worker uses the copy the app posts into its
  IndexedDB store. If the session is missing or a request fails, both fall back
  to a generic "New message" notification.
- **Active-session suppression:** both background paths check a shared
  account-data heartbeat (`moe.crafty.matrix.active_session`, mirrored from
  `src/lib/utils/activeSession.ts` into `static/sw.js` and the Java service) and
  stay quiet when another device is actively in use. It fails open — when in
  doubt, it notifies.
- Tapping an Android notification deep-links to the room via
  `window.__matrixOpenRoom` (wired in `MainActivity.java`); the service worker's
  `notificationclick` handler focuses the app and opens the room.
- `unregisterPush` removes the Android pusher on logout; `teardownWebPush`
  removes the web pusher and unsubscribes the `PushManager`.
- **Foreground** notifications on every platform come from the in-app
  Notification API while the client is running, and use no gateway at all.

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
Sygnal wants the private key as a PKCS#8 PEM rather than the base64url string
`web-push` prints — `node scripts/gen-vapid.mjs` does that conversion.

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
`PUSH_GATEWAY_URL`. Leaving `VITE_VAPID_PUBLIC_KEY` unset does **not** disable
web push — it falls back to the public key committed in `src/lib/webPush.ts`.
See "Turning push off" above.

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
  registration. **The wire shape is not the obvious one:** Sygnal's `webpush`
  pushkin treats the **p256dh key as the pushkey**, and reads the subscription
  `endpoint` and `auth` secret out of `data`. So the registered pusher is:

    ```
    app_id  : moe.crafty.matrix.webpush
    pushkey : <subscription p256dh key>          ← not the endpoint
    data    : { url, format: "event_id_only", endpoint, auth, default_payload }
    ```

    (`teardownWebPush` deletes under both the p256dh key _and_ the endpoint, so
    a pusher registered under either shape gets cleaned up on logout.)

- `static/sw.js` — `push` and `notificationclick` handlers, with the same
  homeserver-enrichment as the Android service, plus the "hide message text"
  privacy flag and the active-session suppression described above. The same
  worker also injects the media `Authorization` header for `<img src>` on
  `/_matrix/client/v1/media/` requests.
- Requires HTTPS and a registered service worker (already used for media auth).
- iOS Safari supports web push only for apps **added to the Home Screen**
  (iOS 16.4+).
