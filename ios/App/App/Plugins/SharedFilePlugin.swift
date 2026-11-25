import Foundation
import Capacitor

// Port of android/app/src/main/java/moe/crafty/matrix/SharedFilePlugin.java.
// Contract: src/lib/utils/nativeSharedFile.ts. The share extension copies
// incoming items into tmp/SharedIncoming; the web layer deletes each one after
// reading it. Only paths inside that folder are honoured.
@objc(SharedFilePlugin)
public class SharedFilePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SharedFilePlugin"
    public let jsName = "SharedFile"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise),
    ]

    /// tmp/SharedIncoming, created on access.
    public static var stagingDir: URL {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("SharedIncoming", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Deletes staged files older than `olderThan` (leftovers from a share that
    /// was never read).
    public static func sweepStale(olderThan: TimeInterval = 24 * 3600) {
        let fm = FileManager.default
        let dir = stagingDir
        guard let items = try? fm.contentsOfDirectory(
            at: dir,
            includingPropertiesForKeys: [.contentModificationDateKey],
            options: [.skipsHiddenFiles]
        ) else {
            return
        }
        let cutoff = Date().addingTimeInterval(-olderThan)
        for item in items {
            let modified = (try? item.resourceValues(forKeys: [.contentModificationDateKey]))?
                .contentModificationDate ?? Date.distantPast
            if modified < cutoff {
                try? fm.removeItem(at: item)
            }
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), !path.isEmpty else {
            call.reject("missing path", "MISSING_PATH")
            return
        }
        let root = SharedFilePlugin.stagingDir.resolvingSymlinksInPath().standardizedFileURL.path + "/"
        let target = SharedFilePlugin.fileURL(from: path).resolvingSymlinksInPath().standardizedFileURL.path
        guard target.hasPrefix(root) else {
            call.resolve(["removed": false])
            return
        }
        let removed = (try? FileManager.default.removeItem(atPath: target)) != nil
        call.resolve(["removed": removed])
    }

    /// Accepts a plain path or a file:// URL string.
    private static func fileURL(from path: String) -> URL {
        if path.hasPrefix("file://"), let url = URL(string: path) {
            return url
        }
        return URL(fileURLWithPath: path)
    }
}
