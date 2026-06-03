# Android Push Notifications (Sygnal + FCM)

Push uses Firebase Cloud Messaging delivered through **Sygnal**, the standard
Matrix push gateway (<https://github.com/matrix-org/sygnal>). The app registers
an HTTP pusher with your homeserver pointing at Sygnal; Sygnal forwards
notifications to the device via FCM.

```
App (FCM token) ──registers pusher──▶ Homeserver
Homeserver ──POST /_matrix/push/v1/notify──▶ Sygnal ──▶ FCM ──▶ Android device
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

- Foreground notifications are handled in `src/lib/push.ts`; background ones are
  shown by the OS.
- `unregisterPush` removes the pusher on logout.
- Web/desktop notifications don't use FCM/Sygnal at all — they use the in-app
  Notification API while the client is running.
