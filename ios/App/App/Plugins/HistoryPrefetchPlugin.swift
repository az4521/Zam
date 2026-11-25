import Foundation
import UIKit
import BackgroundTasks
import Capacitor

// Port of android/app/src/main/java/moe/crafty/matrix/HistoryPrefetchPlugin.java
// and HistoryPrefetchWorker.java. Contract: src/lib/matrix/historyPrefetch.ts
// and src/lib/utils/historyPrefetchPlan.ts.
//
// The plugin is the page's entry point. HistoryPrefetchWorker runs the fetch
// passes: one kicked off by setPlan, and one per BGAppRefreshTask. Native
// fetches raw, still-encrypted /messages pages into app-private storage. The
// search-index crawler takes them from there. Native never decrypts anything.
//
// The access token is written to app-private storage so the worker can run
// without the app open. It is never logged or echoed back.
@objc(HistoryPrefetchPlugin)
public class HistoryPrefetchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HistoryPrefetchPlugin"
    public let jsName = "HistoryPrefetch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setPlan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    private static let defaultPageSize = 100
    private static let minPageSize = 10
    private static let maxPageSize = 500

    /// Replace the account's plan. Args: accountKey, baseUrl, accessToken,
    /// filter (JSON string), pageSize, rooms: [{ roomId, from }]. Rooms with a
    /// null `from` are skipped.
    @objc func setPlan(_ call: CAPPluginCall) {
        let accountKey = call.getString("accountKey") ?? ""
        let baseUrl = call.getString("baseUrl") ?? ""
        let accessToken = call.getString("accessToken") ?? ""
        guard !accountKey.isEmpty, !accessToken.isEmpty,
              baseUrl.hasPrefix("https://") || baseUrl.hasPrefix("http://") else {
            call.reject("history prefetch: bad plan")
            return
        }
        let pageSize = clampInt(call.getInt("pageSize") ?? HistoryPrefetchPlugin.defaultPageSize,
                                HistoryPrefetchPlugin.minPageSize,
                                HistoryPrefetchPlugin.maxPageSize)

        var rooms: [HistoryPrefetchStore.RoomStart] = []
        let raw = (call.getValue("rooms") as? [Any]) ?? []
        for item in raw {
            if rooms.count >= HistoryPrefetchStore.maxRoomsPerPlan { break }
            guard let object = item as? [String: Any] else { continue }
            let roomId = (object["roomId"] as? String) ?? ""
            let from = object["from"] as? String
            rooms.append(HistoryPrefetchStore.RoomStart(roomId: roomId, from: from))
        }
        let roomStarts = rooms

        let plan = HistoryPrefetchStore.PlanRecord(accountKey: accountKey,
                                                   baseUrl: stripTrailingSlash(baseUrl),
                                                   accessToken: accessToken,
                                                   filter: call.getString("filter") ?? "",
                                                   pageSize: pageSize)
        HistoryPrefetchStore.queue.async {
            do {
                try HistoryPrefetchStore.setPlan(plan, rooms: roomStarts)
            } catch {
                DispatchQueue.main.async {
                    call.reject("history prefetch: could not save the plan")
                }
                return
            }
            HistoryPrefetchWorker.schedule()
            HistoryPrefetchWorker.kick()
            DispatchQueue.main.async {
                call.resolve()
            }
        }
    }

    /// Take the prefetched page for a room whose `from` equals the given
    /// token. Resolves { found: false } when there is none. A found page
    /// resolves { found: true, chunk: <JSON array text>, end, fetchedAt }, and
    /// is deleted from storage once read.
    @objc func takePage(_ call: CAPPluginCall) {
        let accountKey = call.getString("accountKey") ?? ""
        let roomId = call.getString("roomId") ?? ""
        let from = call.getString("from") ?? ""
        guard !accountKey.isEmpty, !roomId.isEmpty, !from.isEmpty else {
            call.resolve(["found": false])
            return
        }
        HistoryPrefetchStore.queue.async {
            let page: [String: Any]?
            do {
                page = try HistoryPrefetchStore.takePage(accountKey: accountKey, roomId: roomId, from: from)
            } catch {
                DispatchQueue.main.async {
                    call.reject("history prefetch: could not read the page")
                }
                return
            }
            guard let stored = page else {
                DispatchQueue.main.async {
                    call.resolve(["found": false])
                }
                return
            }
            let chunk = (stored["chunk"] as? [Any]) ?? []
            let chunkText: String
            if let data = try? JSONSerialization.data(withJSONObject: chunk),
               let text = String(data: data, encoding: .utf8) {
                chunkText = text
            } else {
                chunkText = "[]"
            }
            let end: Any = (stored["end"] as? String).map { $0 as Any } ?? NSNull()
            let fetchedAt = (stored["fetchedAt"] as? NSNumber)?.int64Value ?? 0
            let result: [String: Any] = [
                "found": true,
                "chunk": chunkText,
                "end": end,
                "fetchedAt": NSNumber(value: fetchedAt),
            ]
            DispatchQueue.main.async {
                call.resolve(result)
            }
        }
    }

    /// Delete the account's plan and pages. The scheduled work is cancelled
    /// once no plan is left.
    @objc func clear(_ call: CAPPluginCall) {
        let accountKey = call.getString("accountKey") ?? ""
        guard !accountKey.isEmpty else {
            call.resolve()
            return
        }
        HistoryPrefetchStore.queue.async {
            let remaining = HistoryPrefetchStore.clear(accountKey: accountKey)
            if !remaining { HistoryPrefetchWorker.cancelSchedule() }
            DispatchQueue.main.async {
                call.resolve()
            }
        }
    }

    /// { pages, bytes, rooms, lastRunAt, lastError, lastResult } for one account.
    @objc func status(_ call: CAPPluginCall) {
        let accountKey = call.getString("accountKey") ?? ""
        HistoryPrefetchStore.queue.async {
            let report = HistoryPrefetchStore.status(accountKey: accountKey)
            DispatchQueue.main.async {
                call.resolve(report)
            }
        }
    }
}

// MARK: - Worker

/// A running fetch pass: cancelled by the system's expiration or by a stop.
/// Holds the request in flight so cancel() can end it.
final class PrefetchRun {
    private let lock = NSLock()
    private var cancelled = false
    private var task: URLSessionTask?

    var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return cancelled
    }

    func cancel() {
        lock.lock()
        cancelled = true
        let current = task
        lock.unlock()
        current?.cancel()
    }

    /// Sets the request in flight (nil when none). Cancels it at once if the run is already cancelled.
    func attach(_ newTask: URLSessionTask?) {
        lock.lock()
        task = newTask
        let stop = cancelled
        lock.unlock()
        if stop { newTask?.cancel() }
    }
}

/// A UIKit background task, begun and ended on the main thread.
final class BackgroundHold {
    private var identifier: UIBackgroundTaskIdentifier = .invalid
    private let onExpire: () -> Void

    init(onExpire: @escaping () -> Void) {
        self.onExpire = onExpire
    }

    func begin(name: String) {
        guard identifier == .invalid else { return }
        identifier = UIApplication.shared.beginBackgroundTask(withName: name) {
            self.onExpire()
            self.end()
        }
    }

    func end() {
        guard identifier != .invalid else { return }
        let current = identifier
        identifier = .invalid
        UIApplication.shared.endBackgroundTask(current)
    }
}

/// Runs prefetch passes. Port of HistoryPrefetchWorker.java: round-robin over
/// the saved plans' rooms, paced requests, and a budget per pass (8 minutes,
/// 300 pages, or 150 MB stored across accounts).
enum HistoryPrefetchWorker {
    /// Must match Info.plist BGTaskSchedulerPermittedIdentifiers.
    static let taskIdentifier = "moe.crafty.matrix.history-prefetch"

    private static let scheduleDelay: TimeInterval = 2 * 60 * 60
    private static let budgetSeconds: TimeInterval = 8 * 60
    private static let maxPages = 300
    private static let paceMs: Int64 = 500
    private static let retryDefaultMs: Int64 = 5000
    private static let retryCapMs: Int64 = 30000
    private static let maxRateLimitRetries = 3
    private static let readTimeout: TimeInterval = 60
    private static let maxBody = 16 * 1024 * 1024

    /// The pass in progress, if any. Touched only on HistoryPrefetchStore.queue.
    private static var activePass: PrefetchRun?

    private typealias Plan = HistoryPrefetchStore.PlanRecord

    /// One page to fetch for one room.
    private struct Job {
        let plan: Plan
        let roomId: String
        let roomDir: URL
        let gen: String
        var rateLimited = 0
    }

    /// A finished request. `body` is nil when it is over maxBody.
    private struct Fetch {
        let code: Int
        let body: Data?
    }

    private enum PrefetchError: Error {
        case badURL
        case noResponse
    }

    /// Filled in by the URLSession completion handler, read after the semaphore.
    private final class ReplyBox {
        var data: Data?
        var response: URLResponse?
        var error: Error?
    }

    /// Refuses redirects so the bearer token never goes to another host.
    private final class NoRedirectDelegate: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession,
                        task: URLSessionTask,
                        willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest,
                        completionHandler: @escaping (URLRequest?) -> Void) {
            completionHandler(nil)
        }
    }

    // MARK: - Scheduling

    /// Registers the BGAppRefreshTask handler. Must run before the app
    /// finishes launching (AppDelegate calls it).
    public static func registerBackgroundTask() {
        _ = BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            handleRefresh(refresh)
        }
    }

    /// Asks the system for the next pass about two hours out, mirroring the
    /// Android periodic work. Submitting again replaces the pending request.
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: scheduleDelay)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            NSLog("[historyPrefetch] schedule failed: \(error.localizedDescription)")
        }
    }

    /// Cancels the pending pass once no plan is left.
    static func cancelSchedule() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: taskIdentifier)
    }

    private static func handleRefresh(_ task: BGAppRefreshTask) {
        // Reschedule first, so the next pass is queued even if this one is cut short.
        schedule()
        let run = PrefetchRun()
        task.expirationHandler = {
            run.cancel()
        }
        DispatchQueue.global(qos: .utility).async {
            let completed = runPassIfIdle(run)
            task.setTaskCompleted(success: completed)
        }
    }

    /// One immediate pass, so a fresh plan does not wait two hours. Background
    /// time is held for the pass.
    static func kick() {
        let run = PrefetchRun()
        let hold = BackgroundHold(onExpire: { run.cancel() })
        DispatchQueue.main.async {
            hold.begin(name: "moe.crafty.matrix.history-prefetch.kick")
            DispatchQueue.global(qos: .utility).async {
                _ = runPassIfIdle(run)
                DispatchQueue.main.async {
                    hold.end()
                }
            }
        }
    }

    // MARK: - Passes

    /// Runs one pass unless another is already running. Returns false only
    /// when the pass was cut short by the system.
    private static func runPassIfIdle(_ run: PrefetchRun) -> Bool {
        let claimed: Bool = HistoryPrefetchStore.queue.sync { () -> Bool in
            if activePass != nil { return false }
            activePass = run
            return true
        }
        guard claimed else { return true }
        let completed = runPass(run)
        HistoryPrefetchStore.queue.sync {
            if activePass === run { activePass = nil }
        }
        return completed
    }

    /// Mirrors HistoryPrefetchWorker.runOnce.
    private static func runPass(_ run: PrefetchRun) -> Bool {
        let started = Date()
        let plans = onStore({ HistoryPrefetchStore.loadPlans() }).filter { !$0.tokenInvalid }
        if plans.isEmpty { return true }

        // Plans with a base URL we cannot use are recorded and skipped.
        var usable: [Plan] = []
        for plan in plans {
            guard let url = URL(string: plan.baseUrl),
                  let scheme = url.scheme?.lowercased(),
                  scheme == "https" || scheme == "http" else {
                _ = try? onStore { try HistoryPrefetchStore.recordRun(accountKey: plan.accountKey, result: "bad-plan", error: nil) }
                continue
            }
            usable.append(plan)
        }

        // Round-robin: the first room of every plan, then the second, and so on.
        var perPlan: [[Job]] = []
        for plan in usable {
            let acct = HistoryPrefetchStore.accountDir(plan.accountKey)
            var jobs: [Job] = []
            for roomId in plan.rooms {
                let rd = HistoryPrefetchStore.roomDir(acct, roomId)
                guard let chain = onStore({ HistoryPrefetchStore.loadChain(rd) }), !chain.done else { continue }
                jobs.append(Job(plan: plan, roomId: roomId, roomDir: rd, gen: chain.gen))
            }
            perPlan.append(jobs)
        }
        var queue: [Job] = []
        var round = 0
        while true {
            var any = false
            for jobs in perPlan where round < jobs.count {
                queue.append(jobs[round])
                any = true
            }
            if !any { break }
            round += 1
        }

        let session = makeSession()
        defer { session.invalidateAndCancel() }

        var bytes = onStore({ HistoryPrefetchStore.totalBytes() })
        var pages = 0
        var requests = 0
        var result = "done"
        var lastError: String? = nil
        var invalid = Set<String>()

        while !queue.isEmpty {
            if run.isCancelled {
                result = "stopped"
                break
            }
            if Date().timeIntervalSince(started) >= budgetSeconds {
                result = "budget-time"
                break
            }
            if pages >= maxPages {
                result = "budget-pages"
                break
            }
            if bytes >= HistoryPrefetchStore.storageCapBytes {
                result = "storage-cap"
                break
            }
            var job = queue.removeFirst()
            if invalid.contains(job.plan.accountKey) { continue }

            if requests > 0 && !sleepUnlessCancelled(ms: paceMs, run: run) {
                result = "stopped"
                break
            }
            requests += 1

            // Re-read under the queue: setPlan may have replaced the token or the chain.
            let currentPlan = onStore({ HistoryPrefetchStore.loadPlan(accountKey: job.plan.accountKey) })
            let currentChain = onStore({ HistoryPrefetchStore.loadChain(job.roomDir) })
            guard let plan = currentPlan, !plan.tokenInvalid,
                  let latest = currentChain, latest.gen == job.gen, !latest.done else {
                continue
            }
            let token = latest.tail

            let fetch: Fetch
            do {
                fetch = try fetchPage(plan, roomId: job.roomId, from: token, session: session, run: run)
            } catch {
                if run.isCancelled {
                    result = "stopped"
                } else {
                    result = "network-error"
                    lastError = error.localizedDescription
                }
                break
            }

            guard let body = fetch.body else {
                result = "page-too-large"
                break
            }

            if fetch.code == 200 {
                guard let json = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] else {
                    result = "bad-response"
                    lastError = "HTTP 200 with a body that is not JSON"
                    break
                }
                let chunk = (json["chunk"] as? [Any]) ?? []
                let end = json["end"] as? String
                let commit: HistoryPrefetchStore.Commit
                do {
                    commit = try onStore({
                        try HistoryPrefetchStore.commitPage(roomDir: job.roomDir,
                                                            gen: job.gen,
                                                            from: token,
                                                            end: end,
                                                            chunk: chunk,
                                                            fetchedAt: HistoryPrefetchStore.nowMs())
                    })
                } catch {
                    result = "store-error"
                    lastError = error.localizedDescription
                    break
                }
                // The chain was replaced while fetching: drop the page.
                if !commit.stored { continue }
                pages += 1
                bytes += commit.bytes
                // Only the token decides: an empty chunk mid-history is not the end.
                if !commit.done { queue.append(job) }
            } else if fetch.code == 429 {
                job.rateLimited += 1
                if job.rateLimited > maxRateLimitRetries {
                    result = "rate-limited"
                    break
                }
                if !sleepUnlessCancelled(ms: retryAfterMs(body), run: run) {
                    result = "stopped"
                    break
                }
                queue.insert(job, at: 0)
            } else if fetch.code == 401 || (fetch.code == 403 && errcode(body) == "M_UNKNOWN_TOKEN") {
                invalid.insert(job.plan.accountKey)
                _ = try? onStore { try HistoryPrefetchStore.markTokenInvalid(accountKey: job.plan.accountKey, result: "token-invalid") }
            } else if fetch.code == 403 || fetch.code == 404 {
                // Not joined, left, or gone: this room has nothing more to give.
                _ = try? onStore { try HistoryPrefetchStore.finishRoom(job.roomDir, gen: job.gen) }
            } else {
                let code = errcode(body)
                result = "http-error"
                lastError = "HTTP \(fetch.code)" + (code.map { " \($0)" } ?? "")
                break
            }
        }

        for plan in usable {
            let outcome = invalid.contains(plan.accountKey) ? "token-invalid" : result
            _ = try? onStore { try HistoryPrefetchStore.recordRun(accountKey: plan.accountKey, result: outcome, error: lastError) }
        }
        return !run.isCancelled
    }

    /// Runs `body` on the store queue. Calls are synchronous, so they never nest.
    private static func onStore<T>(_ body: () throws -> T) rethrows -> T {
        return try HistoryPrefetchStore.locked(body)
    }

    private static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = readTimeout
        config.httpShouldSetCookies = false
        config.urlCache = nil
        ProxyPlugin.configure(config)
        return URLSession(configuration: config, delegate: NoRedirectDelegate(), delegateQueue: nil)
    }

    /// GET one page with the access token. Blocks the calling (background)
    /// thread until the request finishes or the run is cancelled.
    private static func fetchPage(_ plan: Plan,
                                  roomId: String,
                                  from: String,
                                  session: URLSession,
                                  run: PrefetchRun) throws -> Fetch {
        guard let url = messagesUrl(baseUrl: plan.baseUrl,
                                    roomId: roomId,
                                    from: from,
                                    limit: plan.pageSize,
                                    filter: plan.filter) else {
            throw PrefetchError.badURL
        }
        var request = URLRequest(url: url)
        request.timeoutInterval = readTimeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(plan.accessToken)", forHTTPHeaderField: "Authorization")

        let reply = ReplyBox()
        let finished = DispatchSemaphore(value: 0)
        let task = session.dataTask(with: request) { data, response, error in
            reply.data = data
            reply.response = response
            reply.error = error
            finished.signal()
        }
        run.attach(task)
        task.resume()
        finished.wait()
        run.attach(nil)

        if let error = reply.error { throw error }
        guard let http = reply.response as? HTTPURLResponse else { throw PrefetchError.noResponse }
        let data = reply.data ?? Data()
        return Fetch(code: http.statusCode, body: data.count > maxBody ? nil : data)
    }

    /// Same path, query and parameter order as the Android worker.
    static func messagesUrl(baseUrl: String, roomId: String, from: String, limit: Int, filter: String) -> URL? {
        let base = stripTrailingSlash(baseUrl)
        var text = "\(base)/_matrix/client/v3/rooms/\(encode(roomId))/messages?dir=b&limit=\(limit)&from=\(encode(from))"
        if !filter.isEmpty {
            text += "&filter=\(encode(filter))"
        }
        return URL(string: text)
    }

    /// Percent-encodes everything except ASCII letters, digits and "-._*",
    /// as Java's URLEncoder does (with spaces as %20).
    private static let unreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._*")

    private static func encode(_ value: String) -> String {
        return value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
    }

    private static func jsonObject(_ data: Data?) -> [String: Any]? {
        guard let data = data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static func errcode(_ body: Data?) -> String? {
        return jsonObject(body)?["errcode"] as? String
    }

    /// The server's retry_after_ms, clamped to 0...30 s. Five seconds when absent.
    private static func retryAfterMs(_ body: Data?) -> Int64 {
        guard let value = jsonObject(body)?["retry_after_ms"] as? NSNumber else {
            return retryDefaultMs
        }
        return max(0, min(value.int64Value, retryCapMs))
    }

    /// Sleeps for `ms`, returning false early if the run was cancelled.
    private static func sleepUnlessCancelled(ms: Int64, run: PrefetchRun) -> Bool {
        let end = Date().addingTimeInterval(Double(ms) / 1000)
        while true {
            if run.isCancelled { return false }
            let left = end.timeIntervalSinceNow
            if left <= 0 { return true }
            Thread.sleep(forTimeInterval: min(0.1, left))
        }
    }
}

// MARK: - Helpers

fileprivate func clampInt(_ value: Int, _ low: Int, _ high: Int) -> Int {
    return max(low, min(high, value))
}

fileprivate func stripTrailingSlash(_ text: String) -> String {
    return text.hasSuffix("/") ? String(text.dropLast()) : text
}
