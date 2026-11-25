// Shared by the app, the notification service extension and the share
// extension (each target compiles its own copy of this file).
import Foundation

enum AppGroup {
    /// Default App Group id. AltStore/SideStore re-sign the app under the
    /// installer's team and rewrite group ids; they publish the rewritten ids
    /// in Info.plist under ALTAppGroups, so prefer that when present.
    static let defaultId = "group.moe.crafty.matrix"

    static let id: String = {
        if let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String],
           let first = groups.first {
            return first
        }
        // In an extension Bundle.main is the .appex; the app bundle sits two
        // levels up (App.app/PlugIns/X.appex).
        let appURL = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent()
        if appURL.pathExtension == "app",
           let app = Bundle(url: appURL),
           let groups = app.object(forInfoDictionaryKey: "ALTAppGroups") as? [String],
           let first = groups.first {
            return first
        }
        return defaultId
    }()

    static var defaults: UserDefaults {
        UserDefaults(suiteName: id) ?? .standard
    }

    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }

    /// Keys the web layer writes through @capacitor/preferences
    /// (UserDefaults.standard, prefixed "CapacitorStorage.") that the
    /// extensions need. The app mirrors them into the group defaults under the
    /// same names, without the prefix (AppDelegate.mirrorSharedPreferences).
    static let mirroredKeys = [
        "matrix_session_record",
        "matrix_session_accounts",
        "matrix_hide_notification_body",
        "matrix_ring_enabled",
        "matrix_receipt_privacy",
    ]

    /// Folder the share extension stages incoming items into.
    static var shareInbox: URL? {
        container?.appendingPathComponent("ShareInbox", isDirectory: true)
    }
}

/// Rolling text log of push decisions, written by the notification service
/// extension and read by DebugTools.getPushLog (mirrors PushLog.java).
enum PushLog {
    private static let maxBytes = 64 * 1024
    private static let queue = DispatchQueue(label: "moe.crafty.matrix.pushlog")

    private static var url: URL? {
        AppGroup.container?.appendingPathComponent("push-log.txt")
    }

    static func append(_ line: String) {
        queue.sync {
            guard let url = url else { return }
            let stamp = ISO8601DateFormatter().string(from: Date())
            let entry = "\(stamp) \(line)\n"
            var text = (try? String(contentsOf: url, encoding: .utf8)) ?? ""
            text += entry
            if text.utf8.count > maxBytes {
                let data = Data(text.utf8)
                let tail = data.suffix(maxBytes / 2)
                text = String(decoding: tail, as: UTF8.self)
                if let nl = text.firstIndex(of: "\n") {
                    text = String(text[text.index(after: nl)...])
                }
            }
            try? text.write(to: url, atomically: true, encoding: .utf8)
        }
    }

    static func read() -> String {
        queue.sync {
            guard let url = url else { return "" }
            return (try? String(contentsOf: url, encoding: .utf8)) ?? ""
        }
    }
}
