// Shared by the app (which writes) and the notification service extension
// (which reads, and caches keys it fetched from key backup).
//
// The app's real crypto store lives in WebKit's IndexedDB, which the extension
// cannot open, and the extension cannot run the crypto WASM. So the web layer
// mirrors copies of its Megolm room keys (session-export format) and the key
// backup's decryption key into the App Group (PushKeysPlugin), and the
// extension decrypts pushed events with them (Megolm.swift). These are copies:
// nothing here can change the crypto store itself.
//
// Layout: <group>/RoomKeys/<sha256(userId)>/<sha256(roomId \n sessionId)>.json
// and backup.json beside the keys. Files are written atomically with
// complete-until-first-unlock protection, like the rest of the App Group.
import Foundation
import CryptoKit

enum RoomKeyStore {
    struct Key {
        let roomId: String
        let sessionId: String
        /// Session export, unpadded base64.
        let sessionKey: String
        let senderKey: String?
    }

    struct BackupKey {
        let version: String
        /// Raw 32-byte Curve25519 private key.
        let privateKey: Data
    }

    private static let folder = "RoomKeys"
    private static let backupFile = "backup.json"
    private static let fm = FileManager.default

    private static var root: URL? {
        AppGroup.container?.appendingPathComponent(folder, isDirectory: true)
    }

    static func accountFolderName(_ userId: String) -> String {
        hex(SHA256.hash(data: Data(userId.utf8)))
    }

    private static func accountDir(_ userId: String) -> URL? {
        root?.appendingPathComponent(accountFolderName(userId), isDirectory: true)
    }

    private static func keyFile(_ userId: String, roomId: String, sessionId: String) -> URL? {
        let name = hex(SHA256.hash(data: Data((roomId + "\n" + sessionId).utf8))) + ".json"
        return accountDir(userId)?.appendingPathComponent(name)
    }

    // MARK: - Keys

    /// Stores `key` unless a copy that starts at the same or an earlier
    /// message index is already there (an earlier start decrypts more).
    /// Returns true when it wrote.
    @discardableResult
    static func store(_ key: Key, userId: String) -> Bool {
        guard let url = keyFile(userId, roomId: key.roomId, sessionId: key.sessionId),
              let newIndex = firstIndex(key.sessionKey) else { return false }
        if let existing = read(url), let oldIndex = firstIndex(existing.sessionKey), oldIndex <= newIndex {
            return false
        }
        var obj: [String: Any] = [
            "room_id": key.roomId,
            "session_id": key.sessionId,
            "session_key": key.sessionKey,
        ]
        if let sender = key.senderKey { obj["sender_key"] = sender }
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return false }
        return write(data, to: url)
    }

    static func key(userId: String, roomId: String, sessionId: String) -> Key? {
        guard let url = keyFile(userId, roomId: roomId, sessionId: sessionId) else { return nil }
        return read(url)
    }

    static func count(userId: String) -> Int {
        guard let dir = accountDir(userId),
              let names = try? fm.contentsOfDirectory(atPath: dir.path) else { return 0 }
        return names.filter { $0.hasSuffix(".json") && $0 != backupFile }.count
    }

    // MARK: - Backup key

    static func storeBackupKey(_ key: BackupKey, userId: String) {
        guard let url = accountDir(userId)?.appendingPathComponent(backupFile) else { return }
        let obj: [String: Any] = ["version": key.version, "key": key.privateKey.base64EncodedString()]
        guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
        write(data, to: url)
    }

    static func removeBackupKey(userId: String) {
        guard let url = accountDir(userId)?.appendingPathComponent(backupFile) else { return }
        try? fm.removeItem(at: url)
    }

    static func backupKey(userId: String) -> BackupKey? {
        guard let url = accountDir(userId)?.appendingPathComponent(backupFile),
              let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let version = obj["version"] as? String,
              let text = obj["key"] as? String,
              let raw = Data(base64Encoded: text), raw.count == 32 else { return nil }
        return BackupKey(version: version, privateKey: raw)
    }

    // MARK: - Cleanup

    static func clear(userId: String) {
        guard let dir = accountDir(userId) else { return }
        try? fm.removeItem(at: dir)
    }

    /// Deletes every account folder except those of `keep` (signed-in user ids).
    static func removeAccounts(except keep: Set<String>) {
        guard let root = root,
              let names = try? fm.contentsOfDirectory(atPath: root.path) else { return }
        let wanted = Set(keep.map(accountFolderName))
        for name in names where !wanted.contains(name) {
            try? fm.removeItem(at: root.appendingPathComponent(name, isDirectory: true))
        }
    }

    // MARK: - Helpers

    @discardableResult
    private static func write(_ data: Data, to url: URL) -> Bool {
        do {
            try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true,
                                   attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            return true
        } catch {
            return false
        }
    }

    private static func read(_ url: URL) -> Key? {
        guard let data = try? Data(contentsOf: url),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let roomId = obj["room_id"] as? String,
              let sessionId = obj["session_id"] as? String,
              let sessionKey = obj["session_key"] as? String else { return nil }
        return Key(roomId: roomId, sessionId: sessionId, sessionKey: sessionKey,
                   senderKey: obj["sender_key"] as? String)
    }

    /// The message index a session export starts at.
    static func firstIndex(_ sessionKey: String) -> UInt32? {
        var s = sessionKey.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        guard let raw = Data(base64Encoded: s), raw.count == 165, raw[0] == 0x01 else { return nil }
        let b = [UInt8](raw)
        return UInt32(b[1]) << 24 | UInt32(b[2]) << 16 | UInt32(b[3]) << 8 | UInt32(b[4])
    }

    private static func hex<D: Sequence>(_ digest: D) -> String where D.Element == UInt8 {
        digest.map { String(format: "%02x", $0) }.joined()
    }
}
