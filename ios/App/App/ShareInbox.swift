import Foundation
import UIKit
import WebKit

/// Picks up items the share extension staged in the App Group
/// (AppGroup.shareInbox/<id>/payload.json + files) and hands them to the web
/// layer through window.__matrixShare, the same bridge Android's
/// MainActivity.handleShareIntent uses. Files are moved into the app's own
/// tmp/SharedIncoming so SharedFile.release and Capacitor.convertFileSrc work
/// on them exactly as on Android.
final class ShareInbox {
    static let shared = ShareInbox()

    private weak var controller: ZamViewController?
    private let queue = DispatchQueue(label: "moe.crafty.matrix.share-inbox")
    private var observer: NSObjectProtocol?

    func attach(to controller: ZamViewController) {
        self.controller = controller
        if observer == nil {
            observer = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in self?.drain() }
        }
        drain()
    }

    func drain() {
        queue.async { [weak self] in
            guard let self = self, let inbox = AppGroup.shareInbox else { return }
            let fm = FileManager.default
            guard let entries = try? fm.contentsOfDirectory(
                at: inbox,
                includingPropertiesForKeys: [.creationDateKey],
                options: [.skipsHiddenFiles]
            ) else { return }
            let sorted = entries.sorted { a, b in
                let da = (try? a.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
                let db = (try? b.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .distantPast
                return da < db
            }
            for dir in sorted {
                if let json = self.consume(dir) {
                    self.deliver(json)
                }
                try? fm.removeItem(at: dir)
            }
        }
    }

    /// Builds the Android-shaped payload ({text, subject, files:[{name,
    /// mimeType, size, path}]}) from one staged share, or nil if unusable.
    private func consume(_ dir: URL) -> String? {
        let fm = FileManager.default
        let payloadURL = dir.appendingPathComponent("payload.json")
        guard let data = try? Data(contentsOf: payloadURL),
              let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }

        // Ignore stale shares (the user never opened the app afterwards).
        if let created = raw["createdAt"] as? Double,
           Date().timeIntervalSince1970 * 1000 - created > 24 * 3600 * 1000 {
            return nil
        }

        var out: [String: Any] = [:]
        if let text = raw["text"] as? String, !text.isEmpty { out["text"] = text }
        if let subject = raw["subject"] as? String, !subject.isEmpty { out["subject"] = subject }

        var files: [[String: Any]] = []
        let staging = SharedFilePlugin.stagingDir
        for f in (raw["files"] as? [[String: Any]]) ?? [] {
            guard let fileName = f["file"] as? String,
                  !fileName.contains("/"), fileName != "..", fileName != "."
            else { continue }
            let src = dir.appendingPathComponent(fileName)
            guard fm.fileExists(atPath: src.path) else { continue }
            let destDir = staging.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try fm.createDirectory(at: destDir, withIntermediateDirectories: true)
                let dest = destDir.appendingPathComponent(fileName)
                try fm.moveItem(at: src, to: dest)
                let size = (try? fm.attributesOfItem(atPath: dest.path)[.size] as? NSNumber)?.int64Value ?? 0
                files.append([
                    "name": (f["name"] as? String) ?? fileName,
                    "mimeType": (f["mimeType"] as? String) ?? "application/octet-stream",
                    "size": size,
                    "path": dest.path,
                ])
            } catch {
                try? fm.removeItem(at: destDir)
            }
        }
        if !files.isEmpty { out["files"] = files }
        if out.isEmpty { return nil }
        guard let json = try? JSONSerialization.data(withJSONObject: out),
              let text = String(data: json, encoding: .utf8)
        else { return nil }
        return text
    }

    private func deliver(_ json: String) {
        // JSON-encode the JSON string itself so it lands as a JS string literal.
        guard let literalData = try? JSONSerialization.data(
                withJSONObject: [json], options: []),
              let literalArray = String(data: literalData, encoding: .utf8)
        else { return }
        let literal = String(literalArray.dropFirst().dropLast())
        DispatchQueue.main.async { [weak self] in
            self?.deliverWhenReady(literal, attempt: 0)
        }
    }

    /// On a cold start the web app has not defined the hook yet: poll for it
    /// (every 500 ms, up to 3 minutes, like MainActivity's hook wait).
    private func deliverWhenReady(_ literal: String, attempt: Int) {
        guard attempt < 360, let webView = controller?.webView else { return }
        webView.evaluateJavaScript(
            "typeof window.__matrixShare === 'function'"
        ) { [weak self] result, _ in
            if (result as? Bool) == true {
                webView.evaluateJavaScript(
                    "window.__matrixShare(\(literal))",
                    completionHandler: nil
                )
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self?.deliverWhenReady(literal, attempt: attempt + 1)
                }
            }
        }
    }
}
