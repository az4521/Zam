// Share Extension. Stages the shared text, URLs and files into the App Group
// ShareInbox/<UUID>/ folder with a payload.json describing them; the app reads
// that folder when the user opens Zam (see src/lib/utils/sharePayload.ts).
// Mirrors MainActivity.handleShareIntent and SharedIncomingFiles.java.
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {

    private static let maxFileBytes: Int = 25 * 1024 * 1024

    private let label = UILabel()
    private let doneButton = UIButton(type: .system)
    private var started = false

    // MARK: - View

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.systemBackground

        label.text = "Open Zam to finish sharing"
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = UIFont.preferredFont(forTextStyle: .body)
        label.translatesAutoresizingMaskIntoConstraints = false

        doneButton.setTitle("Done", for: .normal)
        doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
        doneButton.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(label)
        view.addSubview(doneButton)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
            doneButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            doneButton.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 16),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !started else { return }
        started = true
        stageItems()
    }

    @objc private func doneTapped() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    // MARK: - Staging

    private func stageItems() {
        guard let inbox = AppGroup.shareInbox else {
            label.text = "Zam could not reach its shared storage."
            return
        }
        let folder = inbox.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        } catch {
            label.text = "Zam could not prepare the shared items."
            return
        }

        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        let subject = items.compactMap { $0.attributedTitle?.string }.first
        let providers = items.flatMap { $0.attachments ?? [] }

        let collector = StageCollector()
        let group = DispatchGroup()
        for (index, provider) in providers.enumerated() {
            group.enter()
            ShareViewController.handle(provider, index: index, folder: folder, collector: collector) {
                group.leave()
            }
        }
        group.notify(queue: .main) { [weak self] in
            self?.finishStaging(folder: folder, subject: subject, collector: collector)
        }
    }

    /// Stages one provider. `done` is called exactly once, after its callback work.
    private static func handle(_ provider: NSItemProvider, index: Int, folder: URL,
                               collector: StageCollector, done: @escaping () -> Void) {
        if provider.hasItemConformingToTypeIdentifier("public.file-url") {
            provider.loadItem(forTypeIdentifier: "public.file-url", options: nil) { item, _ in
                if let url = item as? URL {
                    stage(source: url, name: url.lastPathComponent, index: index,
                          folder: folder, collector: collector)
                } else {
                    collector.skip()
                }
                done()
            }
            return
        }

        if provider.hasItemConformingToTypeIdentifier("public.url") {
            provider.loadItem(forTypeIdentifier: "public.url", options: nil) { item, _ in
                if let url = item as? URL, !url.isFileURL {
                    collector.setText(index, url.absoluteString)
                } else if let s = item as? String {
                    collector.setText(index, s)
                }
                done()
            }
            return
        }

        if provider.hasItemConformingToTypeIdentifier("public.plain-text") {
            provider.loadItem(forTypeIdentifier: "public.plain-text", options: nil) { item, _ in
                if let s = item as? String {
                    collector.setText(index, s)
                } else if let data = item as? Data, let s = String(data: data, encoding: .utf8) {
                    collector.setText(index, s)
                }
                done()
            }
            return
        }

        let fileType = ["public.image", "public.movie", "public.data"].first { type in
            provider.hasItemConformingToTypeIdentifier(type)
        }
        guard let type = fileType else {
            done()
            return
        }
        provider.loadFileRepresentation(forTypeIdentifier: type) { url, _ in
            if let url = url {
                // The representation URL is temporary: copy it inside the callback.
                var name = provider.suggestedName ?? url.lastPathComponent
                if (name as NSString).pathExtension.isEmpty, !url.pathExtension.isEmpty {
                    name += "." + url.pathExtension
                }
                stage(source: url, name: name, index: index, folder: folder, collector: collector)
            } else {
                collector.skip()
            }
            done()
        }
    }

    /// Copies one file into the staging folder, skipping files over the cap.
    private static func stage(source: URL, name: String, index: Int, folder: URL,
                              collector: StageCollector) {
        let scoped = source.startAccessingSecurityScopedResource()
        defer {
            if scoped {
                source.stopAccessingSecurityScopedResource()
            }
        }
        let size = (try? source.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
        if size > maxFileBytes {
            collector.skip()
            return
        }
        let clean = sanitize(name)
        let dest = uniqueDestination(folder, clean)
        do {
            try FileManager.default.copyItem(at: source, to: dest)
        } catch {
            collector.skip()
            return
        }
        let mime = mimeType(forExtension: dest.pathExtension)
        collector.addFile(index, StagedFile(name: clean, mimeType: mime,
                                            size: Int64(size), file: dest.lastPathComponent))
    }

    private static func sanitize(_ name: String) -> String {
        let replaced = name
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        if replaced.isEmpty || replaced == "." || replaced == ".." {
            return "shared-file"
        }
        return replaced
    }

    private static func uniqueDestination(_ folder: URL, _ name: String) -> URL {
        var dest = folder.appendingPathComponent(name)
        let base = (name as NSString).deletingPathExtension
        let ext = (name as NSString).pathExtension
        var n = 1
        while FileManager.default.fileExists(atPath: dest.path) {
            let candidate = ext.isEmpty ? "\(base)-\(n)" : "\(base)-\(n).\(ext)"
            dest = folder.appendingPathComponent(candidate)
            n += 1
        }
        return dest
    }

    private static func mimeType(forExtension ext: String) -> String {
        if !ext.isEmpty, let type = UTType(filenameExtension: ext), let mime = type.preferredMIMEType {
            return mime
        }
        return "application/octet-stream"
    }

    private func finishStaging(folder: URL, subject: String?, collector: StageCollector) {
        let texts = collector.textList()
        let files = collector.fileList()
        let skipped = collector.skippedCount()

        var payload: [String: Any] = [:]
        if texts.isEmpty {
            payload["text"] = NSNull()
        } else {
            payload["text"] = texts.joined(separator: "\n")
        }
        if let subject = subject {
            payload["subject"] = subject
        } else {
            payload["subject"] = NSNull()
        }
        payload["files"] = files.map { file -> [String: Any] in
            [
                "name": file.name,
                "mimeType": file.mimeType,
                "size": file.size,
                "file": file.file,
            ]
        }
        payload["createdAt"] = Int64(Date().timeIntervalSince1970 * 1000)

        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            try data.write(to: folder.appendingPathComponent("payload.json"))
        } catch {
            label.text = "Zam could not save the shared items."
            return
        }

        var message = "Open Zam to finish sharing"
        if skipped > 0 {
            message += "\n\(skipped) item(s) were skipped (files over 25 MB or unreadable)."
        }
        label.text = message
    }
}

/// A file copied into the staging folder.
private struct StagedFile {
    let name: String
    let mimeType: String
    let size: Int64
    let file: String
}

/// Collects per-provider results from callbacks that run on arbitrary queues.
private final class StageCollector {
    private let lock = NSLock()
    private var texts: [Int: String] = [:]
    private var files: [Int: StagedFile] = [:]
    private var skipped = 0

    func setText(_ index: Int, _ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        lock.lock()
        texts[index] = text
        lock.unlock()
    }

    func addFile(_ index: Int, _ file: StagedFile) {
        lock.lock()
        files[index] = file
        lock.unlock()
    }

    func skip() {
        lock.lock()
        skipped += 1
        lock.unlock()
    }

    func textList() -> [String] {
        lock.lock()
        defer { lock.unlock() }
        return texts.keys.sorted().compactMap { texts[$0] }
    }

    func fileList() -> [StagedFile] {
        lock.lock()
        defer { lock.unlock() }
        return files.keys.sorted().compactMap { files[$0] }
    }

    func skippedCount() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return skipped
    }
}
