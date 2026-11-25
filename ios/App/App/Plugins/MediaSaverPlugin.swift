import Foundation
import Capacitor
import Photos

// Port of android/app/src/main/java/moe/crafty/matrix/MediaSaverPlugin.java.
// Contract: src/lib/utils/saveFile.ts.
//
// image/* and video/* go to the photo library (add-only permission). If that is
// denied, or PhotoKit refuses the file, or the type is anything else, the file
// goes into Documents/Downloads, which the Files app shows under Zam.
@objc(MediaSaverPlugin)
public class MediaSaverPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MediaSaverPlugin"
    public let jsName = "MediaSaver"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
    ]

    static let photosLocation = "Photos"
    static let filesLocation = "Files \u{203A} Zam \u{203A} Downloads"

    @objc func save(_ call: CAPPluginCall) {
        guard let encoded = call.getString("data") else {
            call.reject("missing data")
            return
        }
        guard let bytes = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters) else {
            call.reject("invalid base64 data", "BAD_DATA")
            return
        }
        let name = MediaSaverPlugin.sanitize(call.getString("filename") ?? "file")
        let mime = MediaSaverPlugin.bareMime(call.getString("mimeType"))
        let isVideo = mime.hasPrefix("video/")
        let isPhotoType = isVideo || mime.hasPrefix("image/")

        DispatchQueue.global(qos: .userInitiated).async {
            if isPhotoType {
                MediaSaverPlugin.saveToPhotos(bytes: bytes, name: name, isVideo: isVideo) { result in
                    MediaSaverPlugin.deliver(call, result)
                }
            } else {
                MediaSaverPlugin.deliver(call, MediaSaverPlugin.saveToDownloads(bytes: bytes, name: name))
            }
        }
    }

    // MARK: Delivery

    private static func deliver(_ call: CAPPluginCall, _ result: Result<String, Error>) {
        DispatchQueue.main.async {
            switch result {
            case .success(let location):
                call.resolve(["location": location])
            case .failure(let error):
                if MediaSaverPlugin.isOutOfSpace(error) {
                    call.reject("Not enough storage space", "STORAGE_FULL")
                } else {
                    call.reject("save failed: \(error.localizedDescription)", "SAVE_FAILED")
                }
            }
        }
    }

    // MARK: Photo library

    private static func saveToPhotos(bytes: Data,
                                     name: String,
                                     isVideo: Bool,
                                     completion: @escaping (Result<String, Error>) -> Void) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                completion(MediaSaverPlugin.saveToDownloads(bytes: bytes, name: name))
                return
            }
            if isVideo {
                // Video must be a file on disk for PhotoKit.
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString + "-" + name)
                do {
                    try bytes.write(to: tempURL)
                } catch {
                    completion(.failure(error))
                    return
                }
                PHPhotoLibrary.shared().performChanges({
                    let request = PHAssetCreationRequest.forAsset()
                    let options = PHAssetResourceCreationOptions()
                    options.originalFilename = name
                    request.addResource(with: .video, fileURL: tempURL, options: options)
                }, completionHandler: { success, error in
                    try? FileManager.default.removeItem(at: tempURL)
                    MediaSaverPlugin.finishPhotoChange(success: success,
                                                       error: error,
                                                       bytes: bytes,
                                                       name: name,
                                                       completion: completion)
                })
            } else {
                PHPhotoLibrary.shared().performChanges({
                    let request = PHAssetCreationRequest.forAsset()
                    let options = PHAssetResourceCreationOptions()
                    options.originalFilename = name
                    request.addResource(with: .photo, data: bytes, options: options)
                }, completionHandler: { success, error in
                    MediaSaverPlugin.finishPhotoChange(success: success,
                                                       error: error,
                                                       bytes: bytes,
                                                       name: name,
                                                       completion: completion)
                })
            }
        }
    }

    private static func finishPhotoChange(success: Bool,
                                          error: Error?,
                                          bytes: Data,
                                          name: String,
                                          completion: @escaping (Result<String, Error>) -> Void) {
        if success {
            completion(.success(photosLocation))
            return
        }
        if let error = error, isOutOfSpace(error) {
            completion(.failure(error))
            return
        }
        // PhotoKit refuses some formats (SVG, BMP, ...): keep the file in Files instead.
        completion(saveToDownloads(bytes: bytes, name: name))
    }

    // MARK: Files fallback

    private static func saveToDownloads(bytes: Data, name: String) -> Result<String, Error> {
        do {
            let documents = try FileManager.default.url(for: .documentDirectory,
                                                        in: .userDomainMask,
                                                        appropriateFor: nil,
                                                        create: true)
            let dir = documents.appendingPathComponent("Downloads", isDirectory: true)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let target = uniqueURL(in: dir, name: name)
            try bytes.write(to: target, options: .withoutOverwriting)
            return .success(filesLocation)
        } catch {
            return .failure(error)
        }
    }

    /// `name`, or "name (1).ext", "name (2).ext", ... when taken.
    static func uniqueURL(in dir: URL, name: String) -> URL {
        let fm = FileManager.default
        let first = dir.appendingPathComponent(name)
        if !fm.fileExists(atPath: first.path) { return first }

        var base = name
        var ext = ""
        if let dot = name.lastIndex(of: "."), dot != name.startIndex {
            base = String(name[..<dot])
            ext = String(name[dot...])
        }
        var index = 1
        while true {
            let candidate = dir.appendingPathComponent("\(base) (\(index))\(ext)")
            if !fm.fileExists(atPath: candidate.path) { return candidate }
            index += 1
        }
    }

    // MARK: Helpers

    /// Filename only: no path separators or control characters. Mirrors sanitize()
    /// in the Java code.
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

    /// Lowercased media type without parameters, or application/octet-stream.
    static func bareMime(_ raw: String?) -> String {
        let head = (raw ?? "").components(separatedBy: ";").first ?? ""
        let trimmed = head.trimmingCharacters(in: .whitespaces).lowercased()
        return trimmed.isEmpty ? "application/octet-stream" : trimmed
    }

    static func isOutOfSpace(_ error: Error) -> Bool {
        let ns = error as NSError
        if ns.domain == NSCocoaErrorDomain && ns.code == CocoaError.Code.fileWriteOutOfSpace.rawValue {
            return true
        }
        if let underlying = ns.userInfo[NSUnderlyingErrorKey] as? NSError {
            return isOutOfSpace(underlying)
        }
        return false
    }
}
