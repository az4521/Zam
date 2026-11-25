# Zam for iOS

The iOS shell: a Capacitor 8 project that wraps the same static web build as the web, Electron and
Android targets. Native code is limited to what the web layer cannot do itself: APNs notification
handling, the notification service extension, the share extension, CallKit, and the iOS ports of the
Capacitor plugins under `App/App/Plugins/`. Design context is in `ARCHITECTURE.md` ("iOS native").

## Layout

```
ios/App/App.xcodeproj          -- targets: App, NotificationService, ShareExtension
ios/App/App/                   -- the app: AppDelegate, ZamViewController (plugin registration),
                                  NotificationActions, ShareInbox, Plugins/, Info.plist, entitlements
ios/App/NotificationService/   -- UNNotificationServiceExtension (Sygnal event_id_only pushes)
ios/App/ShareExtension/        -- share sheet: stages items into the App Group
ios/App/Shared/                -- AppGroup.swift, MatrixSession.swift, compiled into all three targets
ios/App/CapApp-SPM/            -- Capacitor-generated SPM package (Package.swift); managed by the CLI
ios/App/App/public/            -- web build copied in by `npx cap sync ios` (gitignored)
```

`debug.xcconfig` sets `CAPACITOR_DEBUG = true`. `capacitor-cordova-ios-plugins/` is
generated and empty.

## Build

1. `npm run build` (writes `build/`).
2. `npx cap sync ios` (copies `build/`, regenerates `CapApp-SPM` and the plugin list).
3. Open `ios/App/App.xcodeproj` and run the `App` scheme.

Notes:

- On Windows, `cap sync` writes backslash paths into `ios/App/CapApp-SPM/Package.swift`. The macOS CI
  runs `cap sync` again, so it does not matter for the build, but do not commit the backslash version.
- New Swift files are not picked up automatically. Add each one to its target in Xcode (the App
  target for `App/App/*.swift` and `Plugins/`, both extensions for their own folders, and all three
  for `Shared/`).
- `App.entitlements` sets `aps-environment` to `development`. Check that the store and TestFlight
  builds get the production value from their signing profile before relying on APNs there.

## Entitlements and App Group

- All three targets share the App Group `group.moe.crafty.matrix`. AltStore and SideStore re-sign the
  app under the installer's team and rewrite the group id. They publish the new id in Info.plist as
  `ALTAppGroups`, and `AppGroup.id` reads it from there, so the same code works in both cases.
- `App.entitlements` also requests `com.apple.developer.usernotifications.communication`, which the
  sender avatar uses. There is no notification filtering entitlement, so a suppressed push is
  delivered with empty content instead of being dropped.
- `gen-altstore-source.mjs` reads the Info.plist usage strings and the entitlement keys of all three
  targets, so AltStore sees the same permissions the project declares.

## Web to native storage

The web layer writes through `@capacitor/preferences`, which stores in `UserDefaults.standard` under
the `CapacitorStorage.` prefix. The extensions cannot read that domain, so `AppDelegate`
mirrors the keys in `AppGroup.mirroredKeys` into the App Group defaults on launch and on every
defaults change. The keys are:

- `matrix_session_record`, `matrix_session_accounts` (written by `src/lib/nativeSession.ts`)
- `matrix_hide_notification_body`, `matrix_ring_enabled`, `matrix_receipt_privacy`

`NotificationActions` writes the declined-invites list to `CapacitorStorage.moe.crafty.matrix.declined_invites`
in standard defaults, where `declinedInvites.ts` reads it.

## Plugins

`ZamViewController.capacitorDidLoad` registers:

| Plugin                | File                                                                   | Purpose                                                     |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- |
| LinkPagePlugin        | `Plugins/LinkPagePlugin.swift`                                         | link previews (contract: `linkPageFetch.ts`)                |
| MediaSaverPlugin      | `Plugins/MediaSaverPlugin.swift`                                       | media saving (contract: `utils/saveFile.ts`)                |
| DebugToolsPlugin      | `Plugins/DebugToolsPlugin.swift`                                       | debug toggles, push log (contract: `debugTools.ts`)         |
| SharedFilePlugin      | `Plugins/SharedFilePlugin.swift`                                       | staged shared files, release and sweep                      |
| FileTransferPlugin    | `Plugins/FileTransferPlugin.swift`                                     | file transfer sink (contract: `matrix/fileTransferSink.ts`) |
| HistoryPrefetchPlugin | `Plugins/HistoryPrefetchPlugin.swift` (+ `HistoryPrefetchStore.swift`) | history prefetch, BGTask                                    |
| PluginSocketsPlugin   | `Plugins/PluginSocketsPlugin.swift`                                    | plugin raw sockets                                          |
| ProxyPlugin           | `Plugins/ProxyPlugin.swift`                                            | proxy, iOS 17+                                              |
| CallServicePlugin     | `Plugins/CallServicePlugin.swift`                                      | CallKit                                                     |

Plus `@capacitor/app`, `@capacitor/browser`, `@capacitor/preferences` and `@capacitor/push-notifications`
from the npm packages.

Not on iOS: `ApkUpdater`, `WebBundle`, `UnifiedPush`, `PushDecrypt` and `ScreenShare` (Android only),
and `PluginNative` (native code inside Zam plugins). The web layer gates these by platform through
`src/lib/utils/mobileNative.ts`: `isMobileNative()` for features with a port on both mobile
platforms, `isIos()` for iOS-only branches. Android-only features keep checking for `"android"`.

## Push

- Transport: APNs through `@capacitor/push-notifications`. `src/lib/push.ts` registers a pusher with
  app id `moe.crafty.matrix.ios` and device name `iOS (<deviceId>)`.
- Sygnal needs an `apns` app entry for bundle id `moe.crafty.matrix.ios`, with the APNs key.
- `apnsPayload` in `push.ts` puts `aps.mutable-content = 1`, a placeholder alert and `sound` into
  `default_payload`. iOS only runs the extension for a visible alert with mutable-content, so the
  placeholder is required.
- The extension fetches the event and room through the homeserver with the account named by
  `zam_tag`, applies the same suppression rules as `MatrixMessagingService.java`, and replaces the
  placeholder. Encrypted events show "Encrypted message". The extension cannot decrypt, so in a
  mentions-only encrypted room it suppresses the push instead.
- Decisions are logged to `push-log.txt` in the App Group, read by `DebugToolsPlugin`.
- `MAX_FUTURE_SKEW_MS` and `MAX_GRACE_MS` are mirrored in `NotificationService.swift`. The build guard
  `scripts/check-active-session-sync.mjs` checks them along with `activeSession.ts`, `sw.js` and the
  Java service.

### Notification actions

Categories are registered in `NotificationActions.install()`:

- Message: Reply (text input), Mark as read.
- Invite: Accept, Decline.
- Call: Join, Dismiss.

Mark as read and Decline run natively with the account's access token and do not open the app. Reply,
Accept and Join open the app. Their taps reach `src/lib/utils/iosNotificationAction.ts`, which maps
them to the window hooks (`__matrixReplyFromNotification`, `__matrixInviteFromNotification`,
`__matrixOpenRoom`). A plain tap opens the room. Cold starts wait up to three minutes for the hook.

## Share

`ShareExtension` stages the items into `AppGroup.shareInbox/<uuid>/` with a `payload.json`. The app's
`ShareInbox` drains that folder when it attaches and when the app becomes active. It moves files into
`tmp/SharedIncoming`, builds the same payload shape as Android, and calls `window.__matrixShare`.
Stale shares (over 24 hours old) are discarded.

## Calls

CallKit runs in `CallServicePlugin.swift`. The web layer asks for the system call UI through the plugin.
Incoming calls arrive as time-sensitive notifications, not PushKit VoIP pushes. CallKit rings only while
the app is in the background.

## Proxy

`ProxyPlugin` applies its settings through `WKWebsiteDataStore.proxyConfigurations`, which needs iOS 17.
Below 17 the settings are saved and the plugin reports "Proxy needs iOS 17 or later". The call proxy
bypass that Android has is not implemented on iOS.

## CI and distribution

`.github/workflows/ios.yml` is reusable (`workflow_call`) and runnable by hand on any branch
(`workflow_dispatch`, default version `0.0.0`). It:

1. Builds the web app and runs `npx cap sync ios`.
2. Runs `xcodebuild` for the `App` scheme, Release, `generic/platform=iOS`, with code signing off.
3. Ad-hoc signs the frameworks, both extensions (with their entitlements), then the app.
4. Zips `Payload/App.app` into `Zam-<version>.ipa` and uploads it as the `ios` artifact.

`release.yml` calls it on master pushes with the release version. The IPA is not a release gate: a
failed iOS build leaves the release without an IPA. The `altstore` job writes `altstore/source.json` with
`scripts/gen-altstore-source.mjs` (icon from `altstore/icon.png`, IPA URL on the GitHub release, notes from
the CHANGELOG section). The `pages` job publishes it at `<pages-url>/altstore/source.json`.

Sideloaded IPAs are re-signed under the installer's team, so the project's APNs pushes do not reach them. Push works only in an App Store or TestFlight build signed
with the project's team.

## Testing

There are no iOS unit tests. The TypeScript side (`iosNotificationAction.ts`, `push.ts`, `mobileNative.ts`)
is covered by Vitest where a pure module exists. Everything native needs a device: push delivery and
extension enrichment, notification actions, share, CallKit, and the proxy on iOS 17 or later.
