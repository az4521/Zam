import Foundation
import Capacitor

// iOS only, no Android counterpart (Android's push service decrypts with the
// crypto store itself, HeadlessDecryptor.java). Contract: src/lib/iosPushKeys.ts.
//
// Receives copies of Megolm room keys and the key backup's decryption key from
// the web layer and writes them to the App Group (RoomKeyStore), where the
// notification service extension reads them to decrypt pushed events.
@objc(PushKeysPlugin)
public class PushKeysPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PushKeysPlugin"
    public let jsName = "PushKeys"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "store", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBackupKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    private static let queue = DispatchQueue(label: "moe.crafty.matrix.pushkeys", qos: .utility)

    /// { userId, keys: [{ room_id, session_id, session_key, sender_key? }] }
    /// -> { written }
    @objc func store(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty,
              let keys = call.getArray("keys") as? [[String: Any]] else {
            call.reject("missing userId or keys")
            return
        }
        PushKeysPlugin.queue.async {
            var written = 0
            for raw in keys {
                guard let roomId = raw["room_id"] as? String,
                      let sessionId = raw["session_id"] as? String,
                      let sessionKey = raw["session_key"] as? String else { continue }
                let key = RoomKeyStore.Key(roomId: roomId, sessionId: sessionId, sessionKey: sessionKey,
                                           senderKey: raw["sender_key"] as? String)
                if RoomKeyStore.store(key, userId: userId) { written += 1 }
            }
            call.resolve(["written": written])
        }
    }

    /// { userId, version?, key? (base64, 32 bytes) }; no version or key removes it.
    @objc func setBackupKey(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("missing userId")
            return
        }
        let version = call.getString("version")
        let key = call.getString("key").flatMap { Data(base64Encoded: $0) }
        PushKeysPlugin.queue.async {
            if let version = version, !version.isEmpty, let key = key, key.count == 32 {
                RoomKeyStore.storeBackupKey(.init(version: version, privateKey: key), userId: userId)
            } else {
                RoomKeyStore.removeBackupKey(userId: userId)
            }
            call.resolve()
        }
    }

    /// { userId } -> { keys, backup } for the debug page and tests.
    @objc func status(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId"), !userId.isEmpty else {
            call.reject("missing userId")
            return
        }
        PushKeysPlugin.queue.async {
            call.resolve([
                "keys": RoomKeyStore.count(userId: userId),
                "backup": RoomKeyStore.backupKey(userId: userId) != nil,
            ])
        }
    }

    /// Drops the mirrored keys of accounts that are no longer signed in.
    /// Called by AppDelegate whenever the mirrored account list changes.
    static func sweep(signedIn userIds: Set<String>) {
        queue.async {
            RoomKeyStore.removeAccounts(except: userIds)
        }
    }
}
