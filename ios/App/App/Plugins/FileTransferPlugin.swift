import Foundation
import Capacitor

// Port of android/app/src/main/java/moe/crafty/matrix/FileTransferPlugin.java.
// Contract: src/lib/matrix/fileTransferSink.ts (open, write, finish, abort,
// keepRunning, letStop).
//
// A received file is written to Documents/Downloads/ as "<name>.part" (visible
// in the Files app while it arrives), then renamed to a unique final name on
// finish. Abort deletes the .part file. Writes are positional and all file work
// runs on one serial queue.
//
// The Android binary block channel (window.zamFileBlocks) is not ported. The
// page falls back to base64 writes when that channel is absent, which is the
// case on iOS.
@objc(FileTransferPlugin)
public class FileTransferPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FileTransferPlugin"
    public let jsName = "FileTransfer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "abort", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepRunning", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "letStop", returnType: CAPPluginReturnPromise),
    ]

    private static let storageFull = "STORAGE_FULL"
    /// Space left over, so a transfer can't fill the device to the last byte.
    private static let spareBytes: Int64 = 64 * 1024 * 1024
    private static let backgroundName = "moe.crafty.matrix.file-transfer"

    /// One open transfer. Only touched on `workQueue`.
    private final class Target {
        let handle: FileHandle
        let name: String
        let part: URL
        private var closed = false

        init(handle: FileHandle, name: String, part: URL) {
            self.handle = handle
            self.name = name
            self.part = part
        }

        func close() {
            if closed { return }
            closed = true
            try? handle.close()
        }
    }

    /// Serial queue. The file handles and the id table are used only here.
    private let workQueue = DispatchQueue(label: "moe.crafty.matrix.file-transfer")
    private var targets: [String: Target] = [:]

    /// Background-time bookkeeping. Main thread only.
    private var holds = 0
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    // MARK: - Plugin methods

    @objc func open(_ call: CAPPluginCall) {
        let name = FileTransferPlugin.sanitize(call.getString("filename") ?? "file")
        let size = Int64(call.getInt("size") ?? 0)
        workQueue.async {
            do {
                let directory = try FileTransferPlugin.downloadsDirectory()
                let available = try FileTransferPlugin.availableBytes(in: directory)
                if available < size + FileTransferPlugin.spareBytes {
                    FileTransferPlugin.rejectOnMain(call, "not enough space", FileTransferPlugin.storageFull)
                    return
                }
                let part = FileTransferPlugin.uniqueURL(in: directory, name: name + ".part")
                guard FileManager.default.createFile(atPath: part.path, contents: nil) else {
                    throw FileTransferError.cannotCreate
                }
                let handle = try FileHandle(forWritingTo: part)
                let id = UUID().uuidString
                self.targets[id] = Target(handle: handle, name: name, part: part)
                FileTransferPlugin.resolveOnMain(call, ["id": id])
            } catch {
                FileTransferPlugin.rejectOnMain(call, "open failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let encoded = call.getString("data"),
              let position = call.getInt("position"),
              position >= 0,
              let bytes = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters) else {
            call.reject("bad write")
            return
        }
        workQueue.async {
            guard let target = self.targets[id] else {
                FileTransferPlugin.rejectOnMain(call, "bad write")
                return
            }
            do {
                try FileTransferPlugin.writeAt(target.handle, bytes, UInt64(position))
                FileTransferPlugin.resolveOnMain(call)
            } catch {
                let code: String? = FileTransferPlugin.isOutOfSpace(error) ? FileTransferPlugin.storageFull : nil
                FileTransferPlugin.rejectOnMain(call, "write failed: \(error.localizedDescription)", code)
            }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        workQueue.async {
            guard let target = self.targets.removeValue(forKey: id) else {
                FileTransferPlugin.rejectOnMain(call, "unknown transfer")
                return
            }
            do {
                try target.handle.synchronize()
                target.close()
                let directory = target.part.deletingLastPathComponent()
                // The final name is chosen now, so a name taken while the file
                // arrived gets a " (1)" suffix rather than being overwritten.
                let destination = FileTransferPlugin.uniqueURL(in: directory, name: target.name)
                try FileManager.default.moveItem(at: target.part, to: destination)
                FileTransferPlugin.resolveOnMain(call)
            } catch {
                FileTransferPlugin.discard(target)
                FileTransferPlugin.rejectOnMain(call, "finish failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func abort(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        workQueue.async {
            if let target = self.targets.removeValue(forKey: id) {
                FileTransferPlugin.discard(target)
            }
            FileTransferPlugin.resolveOnMain(call)
        }
    }

    /// Asks iOS for background time so a transfer keeps going briefly when the
    /// app leaves the screen. Calls nest: each keepRunning needs a letStop.
    @objc func keepRunning(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.backgroundTask == .invalid {
                self.beginBackgroundTime()
            }
            self.holds += 1
            call.resolve()
        }
    }

    @objc func letStop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.holds > 0 { self.holds -= 1 }
            if self.holds == 0 { self.endBackgroundTime() }
            call.resolve()
        }
    }

    // MARK: - Background time (main thread)

    private func beginBackgroundTime() {
        // The system can end background time early. The handler ends our task
        // so iOS does not kill the app for holding it. Holds still balance.
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: FileTransferPlugin.backgroundName) { [weak self] in
            DispatchQueue.main.async {
                self?.endBackgroundTime()
            }
        }
    }

    private func endBackgroundTime() {
        guard backgroundTask != .invalid else { return }
        let identifier = backgroundTask
        backgroundTask = .invalid
        UIApplication.shared.endBackgroundTask(identifier)
    }

    // MARK: - Helpers

    private static func resolveOnMain(_ call: CAPPluginCall, _ data: [String: Any] = [:]) {
        DispatchQueue.main.async {
            call.resolve(data)
        }
    }

    private static func rejectOnMain(_ call: CAPPluginCall, _ message: String, _ code: String? = nil) {
        DispatchQueue.main.async {
            call.reject(message, code)
        }
    }

    /// Documents/Downloads, created if missing. Visible in the Files app.
    static func downloadsDirectory() throws -> URL {
        let documents = try FileManager.default.url(for: .documentDirectory,
                                                    in: .userDomainMask,
                                                    appropriateFor: nil,
                                                    create: true)
        let directory = documents.appendingPathComponent("Downloads", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    /// Bytes free for "important" use on the volume holding `directory`.
    static func availableBytes(in directory: URL) throws -> Int64 {
        let values = try directory.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        return values.volumeAvailableCapacityForImportantUsage ?? Int64.max
    }

    /// Positional write: seek, then write. Both throw on failure.
    private static func writeAt(_ handle: FileHandle, _ data: Data, _ position: UInt64) throws {
        try handle.seek(toOffset: position)
        try handle.write(contentsOf: data)
    }

    private static func discard(_ target: Target) {
        target.close()
        try? FileManager.default.removeItem(at: target.part)
    }

    /// `name`, or "name (1).ext", "name (2).ext", ... when taken.
    static func uniqueURL(in directory: URL, name: String) -> URL {
        let fm = FileManager.default
        let first = directory.appendingPathComponent(name)
        if !fm.fileExists(atPath: first.path) { return first }

        var base = name
        var ext = ""
        if let dot = name.lastIndex(of: "."), dot != name.startIndex {
            base = String(name[..<dot])
            ext = String(name[dot...])
        }
        var index = 1
        while true {
            let candidate = directory.appendingPathComponent("\(base) (\(index))\(ext)")
            if !fm.fileExists(atPath: candidate.path) { return candidate }
            index += 1
        }
    }

    /// Filename only: no path separators or control characters. Mirrors
    /// sanitize() in MediaSaverPlugin.java and FileTransferPlugin.java.
    static func sanitize(_ raw: String) -> String {
        let forbidden = "\\/:*?\"<>|"
        var out = ""
        for ch in raw {
            let isControl = ch.unicodeScalars.contains { $0.properties.generalCategory == .control }
            if isControl || forbidden.contains(ch) {
                out.append("_")
            } else {
                out.append(ch)
            }
        }
        var trimmed = out.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty || trimmed == "." || trimmed == ".." { return "file" }
        if trimmed.count > 200 { trimmed = String(trimmed.suffix(200)) }
        return trimmed
    }

    /// True for ENOSPC and for Cocoa's "out of space" write error, including
    /// when either is wrapped as an underlying error.
    static func isOutOfSpace(_ error: Error) -> Bool {
        let ns = error as NSError
        if ns.domain == NSPOSIXErrorDomain && ns.code == Int(ENOSPC) {
            return true
        }
        if ns.domain == NSCocoaErrorDomain && ns.code == CocoaError.Code.fileWriteOutOfSpace.rawValue {
            return true
        }
        if let underlying = ns.userInfo[NSUnderlyingErrorKey] as? NSError {
            return isOutOfSpace(underlying)
        }
        return false
    }
}

private enum FileTransferError: Error {
    case cannotCreate
}
