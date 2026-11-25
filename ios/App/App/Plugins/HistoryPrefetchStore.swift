import Foundation
import CryptoKit

// Port of android/app/src/main/java/moe/crafty/matrix/HistoryPrefetchStore.java.
// On-disk state for HistoryPrefetchPlugin and HistoryPrefetchWorker.
//
// Layout, all under Application Support/HistoryPrefetch/ (excluded from backup):
//   <sha256(accountKey)>/plan.json
//   <sha256(accountKey)>/rooms/<sha256(roomId)>/chain.json
//   <sha256(accountKey)>/rooms/<sha256(roomId)>/p<seq>.json
//
// A room's chain is the run of prefetched pages not yet taken by the page.
// `tail` is the token the next fetch starts from (the last page's `end`).
// `pages[0].from` is where the page's crawler resumes, so setPlan keeps a chain
// only while that token still matches.
//
// Every function here must run on `HistoryPrefetchStore.queue`; use `locked`
// from other threads. Network I/O never runs on the queue: the worker fetches
// first, then commits the page here, and drops it if the chain was replaced
// in the meantime (its `gen` changed).
//
// Native never decrypts anything and never sees keys: pages are the raw JSON
// the homeserver returned.
enum HistoryPrefetchStore {

    /// The one serial queue for every file the prefetch touches.
    static let queue = DispatchQueue(label: "moe.crafty.matrix.history-prefetch.store")

    static let storageCapBytes: Int64 = 150 * 1024 * 1024
    static let maxRoomsPerPlan = 500

    private static let rootName = "HistoryPrefetch"
    private static let planFile = "plan.json"
    private static let chainFile = "chain.json"
    private static let roomsName = "rooms"

    /// Runs `body` on the store queue. Do not call from code already on it.
    static func locked<T>(_ body: () throws -> T) rethrows -> T {
        try queue.sync(execute: body)
    }

    // MARK: - Model

    /// A plan for one account. The access token lives only in app-private storage.
    struct PlanRecord: Codable {
        var accountKey: String
        var baseUrl: String
        var accessToken: String
        var filter: String
        var pageSize: Int
        var savedAt: Int64 = 0
        var tokenInvalid: Bool = false
        var lastRunAt: Int64 = 0
        var lastError: String? = nil
        var lastResult: String? = nil
        var rooms: [String] = []
    }

    /// A page held for a room, in fetch order.
    struct PageRef: Codable {
        var seq: Int64
        var from: String
        var end: String?
        var fetchedAt: Int64
        var bytes: Int64
    }

    /// A room's prefetch chain.
    struct Chain: Codable {
        var roomId: String
        var gen: String
        var startFrom: String
        var tail: String
        var done: Bool
        var nextSeq: Int64
        var pages: [PageRef]

        /// The token the page crawler resumes from.
        func resume() -> String {
            return pages.first?.from ?? tail
        }

        static func fresh(roomId: String, from: String) -> Chain {
            return Chain(roomId: roomId,
                         gen: UUID().uuidString,
                         startFrom: from,
                         tail: from,
                         done: false,
                         nextSeq: 0,
                         pages: [])
        }
    }

    /// One room of a plan as the page sends it. A nil `from` means skip.
    struct RoomStart {
        let roomId: String
        let from: String?
    }

    /// Outcome of committing a fetched page.
    struct Commit {
        /// False when the chain was replaced or moved while the page was fetched.
        var stored = false
        var bytes: Int64 = 0
        var done = false
    }

    enum StoreError: Error {
        case encode
    }

    // MARK: - Paths

    static func root() -> URL {
        let support = (try? FileManager.default.url(for: .applicationSupportDirectory,
                                                    in: .userDomainMask,
                                                    appropriateFor: nil,
                                                    create: true))
            ?? FileManager.default.temporaryDirectory
        return support.appendingPathComponent(rootName, isDirectory: true)
    }

    static func accountDir(_ accountKey: String) -> URL {
        return root().appendingPathComponent(sha256Hex(accountKey), isDirectory: true)
    }

    static func roomDir(_ accountDir: URL, _ roomId: String) -> URL {
        return accountDir
            .appendingPathComponent(roomsName, isDirectory: true)
            .appendingPathComponent(sha256Hex(roomId), isDirectory: true)
    }

    static func sha256Hex(_ text: String) -> String {
        return SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    static func nowMs() -> Int64 {
        return Int64(Date().timeIntervalSince1970 * 1000)
    }

    // MARK: - Plans

    /// Every saved plan, newest setPlan first. Corrupt plans are skipped.
    static func loadPlans() -> [PlanRecord] {
        var out: [PlanRecord] = []
        for dir in childDirectories(root()) {
            if let plan = loadPlan(acct: dir) {
                out.append(plan)
            }
        }
        return out.sorted { $0.savedAt > $1.savedAt }
    }

    static func loadPlan(accountKey: String) -> PlanRecord? {
        return loadPlan(acct: accountDir(accountKey))
    }

    static func loadPlan(acct: URL) -> PlanRecord? {
        guard let data = readData(acct.appendingPathComponent(planFile)) else { return nil }
        return try? JSONDecoder().decode(PlanRecord.self, from: data)
    }

    static func savePlan(_ plan: PlanRecord) throws {
        let data = try JSONEncoder().encode(plan)
        try writeData(data, to: accountDir(plan.accountKey).appendingPathComponent(planFile))
    }

    /// Replace the account's plan. Rooms whose chain already resumes at the
    /// plan's `from` keep their pages. Every other listed room restarts at
    /// `from`, and rooms no longer listed lose their pages.
    static func setPlan(_ incoming: PlanRecord, rooms: [RoomStart]) throws {
        let acct = accountDir(incoming.accountKey)
        let roomsRoot = acct.appendingPathComponent(roomsName, isDirectory: true)
        var keep = Set<String>()
        var planRooms: [String] = []
        for room in rooms {
            if planRooms.count >= maxRoomsPerPlan { break }
            guard let from = room.from, !from.isEmpty, !room.roomId.isEmpty else { continue }
            if planRooms.contains(room.roomId) { continue }
            planRooms.append(room.roomId)
            let rd = roomDir(acct, room.roomId)
            if loadChain(rd)?.resume() != from {
                removeTree(rd)
                try saveChain(rd, Chain.fresh(roomId: room.roomId, from: from))
            }
            keep.insert(rd.lastPathComponent)
        }
        for dir in childDirectories(roomsRoot) where !keep.contains(dir.lastPathComponent) {
            removeTree(dir)
        }

        var next = incoming
        if let old = loadPlan(acct: acct) {
            // A new token starts a fresh run, but the last run's report stays visible.
            next.lastRunAt = old.lastRunAt
            next.lastError = old.lastError
            next.lastResult = old.lastResult
        }
        next.rooms = planRooms
        next.savedAt = nowMs()
        next.tokenInvalid = false
        try savePlan(next)
    }

    /// Delete the account's plan and pages. Returns true when another plan remains.
    static func clear(accountKey: String) -> Bool {
        removeTree(accountDir(accountKey))
        return !loadPlans().isEmpty
    }

    static func markTokenInvalid(accountKey: String, result: String) throws {
        guard var plan = loadPlan(accountKey: accountKey) else { return }
        plan.tokenInvalid = true
        plan.lastRunAt = nowMs()
        plan.lastResult = result
        try savePlan(plan)
    }

    static func recordRun(accountKey: String, result: String, error: String?) throws {
        guard var plan = loadPlan(accountKey: accountKey) else { return }
        plan.lastRunAt = nowMs()
        plan.lastResult = result
        plan.lastError = error
        try savePlan(plan)
    }

    // MARK: - Chains and pages

    static func loadChain(_ roomDir: URL) -> Chain? {
        guard let data = readData(roomDir.appendingPathComponent(chainFile)) else { return nil }
        return try? JSONDecoder().decode(Chain.self, from: data)
    }

    static func saveChain(_ roomDir: URL, _ chain: Chain) throws {
        let data = try JSONEncoder().encode(chain)
        try writeData(data, to: roomDir.appendingPathComponent(chainFile))
    }

    /// Store a fetched page if the chain is still the one it was fetched for
    /// (same gen, same tail). `chunk` is the parsed "chunk" array as received.
    static func commitPage(roomDir rd: URL,
                           gen: String,
                           from: String,
                           end: String?,
                           chunk: [Any],
                           fetchedAt: Int64) throws -> Commit {
        var out = Commit()
        guard var chain = loadChain(rd), chain.gen == gen, chain.tail == from, !chain.done else {
            return out
        }
        let endValue: Any = end.map { $0 as Any } ?? NSNull()
        let page: [String: Any] = [
            "from": from,
            "end": endValue,
            "fetchedAt": NSNumber(value: fetchedAt),
            "chunk": chunk,
        ]
        guard JSONSerialization.isValidJSONObject(page) else {
            throw StoreError.encode
        }
        let bytes = try JSONSerialization.data(withJSONObject: page)
        let ref = PageRef(seq: chain.nextSeq,
                          from: from,
                          end: end,
                          fetchedAt: fetchedAt,
                          bytes: Int64(bytes.count))
        try writeData(bytes, to: rd.appendingPathComponent(pageName(ref.seq)))
        chain.nextSeq += 1
        chain.pages.append(ref)
        chain.tail = end ?? from
        // Stop when there is no end, or the end is the token just used.
        chain.done = end == nil || end == from
        try saveChain(rd, chain)

        out.stored = true
        out.bytes = ref.bytes
        out.done = chain.done
        return out
    }

    /// Mark a room finished so it is not fetched again (not joined, not found).
    static func finishRoom(_ roomDir: URL, gen: String) throws {
        guard var chain = loadChain(roomDir), chain.gen == gen else { return }
        chain.done = true
        try saveChain(roomDir, chain)
    }

    /// Take the page whose `from` equals the token. Drops it and any earlier
    /// pages of that room, since the crawler has passed them. Nil when absent.
    /// The returned dictionary is the stored page: from, end, fetchedAt, chunk.
    static func takePage(accountKey: String, roomId: String, from: String) throws -> [String: Any]? {
        let rd = roomDir(accountDir(accountKey), roomId)
        guard var chain = loadChain(rd) else { return nil }
        guard let idx = chain.pages.firstIndex(where: { $0.from == from }) else { return nil }

        var page: [String: Any]? = nil
        if let data = readData(rd.appendingPathComponent(pageName(chain.pages[idx].seq))) {
            page = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        }
        for i in 0...idx {
            removeFile(rd.appendingPathComponent(pageName(chain.pages[i].seq)))
        }
        chain.pages.removeSubrange(0...idx)
        try saveChain(rd, chain)
        return page
    }

    // MARK: - Worker-facing helpers

    /// Total bytes across all accounts, for the storage cap.
    static func totalBytes() -> Int64 {
        return sizeOf(root())
    }

    /// Pages and bytes held for one account, and the rooms still active.
    /// Keys match what historyPrefetchPlan.ts parses (null where unset).
    static func status(accountKey: String) -> [String: Any] {
        let acct = accountDir(accountKey)
        var pages: Int64 = 0
        var rooms = 0
        for rd in childDirectories(acct.appendingPathComponent(roomsName, isDirectory: true)) {
            guard let chain = loadChain(rd) else { continue }
            pages += Int64(chain.pages.count)
            if !chain.done || !chain.pages.isEmpty { rooms += 1 }
        }

        var lastRunAt: Any = NSNull()
        var lastError: Any = NSNull()
        var lastResult: Any = NSNull()
        if let plan = loadPlan(acct: acct) {
            if plan.lastRunAt != 0 { lastRunAt = NSNumber(value: plan.lastRunAt) }
            if let error = plan.lastError { lastError = error }
            if let result = plan.lastResult { lastResult = result }
        }
        return [
            "pages": NSNumber(value: pages),
            "bytes": NSNumber(value: sizeOf(acct)),
            "rooms": NSNumber(value: rooms),
            "lastRunAt": lastRunAt,
            "lastError": lastError,
            "lastResult": lastResult,
        ]
    }

    // MARK: - Files

    private static func pageName(_ seq: Int64) -> String {
        return "p\(seq).json"
    }

    private static func childDirectories(_ dir: URL) -> [URL] {
        let children = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        return children.filter { url in
            var isDir: ObjCBool = false
            return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDir) && isDir.boolValue
        }
    }

    /// Total size of every regular file under `url`.
    private static func sizeOf(_ url: URL) -> Int64 {
        guard let walker = FileManager.default.enumerator(at: url,
                                                          includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey],
                                                          options: []) else {
            return 0
        }
        var total: Int64 = 0
        for case let file as URL in walker {
            guard let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                  values.isRegularFile == true else { continue }
            total += Int64(values.fileSize ?? 0)
        }
        return total
    }

    static func removeTree(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    private static func removeFile(_ url: URL) {
        try? FileManager.default.removeItem(at: url)
    }

    /// Write atomically (temp file, then rename) so a reader never sees half a
    /// file. Creates the parent directory if needed. Excluded from backup.
    private static func writeData(_ data: Data, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                                withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
        excludeFromBackup(url)
        excludeFromBackup(root())
    }

    private static func readData(_ url: URL) -> Data? {
        return try? Data(contentsOf: url)
    }

    private static func excludeFromBackup(_ url: URL) {
        var target = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? target.setResourceValues(values)
    }
}
