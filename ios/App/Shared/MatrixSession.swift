// Shared by the app, the notification service extension and the share
// extension (each target compiles its own copy of this file). It must not
// reference anything that only exists in one extension target.
//
// Session records are mirrored into the App Group defaults by the web layer
// (src/lib/nativeSession.ts). Parsing mirrors MatrixMessagingService.java
// (parseSessionRecord, readSessionRecord, resolveSession, accountIdOf).
import Foundation

enum MatrixSession {
    struct Record {
        let homeserverUrl: String
        let accessToken: String
        let userId: String
        let deviceId: String?
    }

    static let recordKey = "matrix_session_record"
    static let accountsKey = "matrix_session_accounts"

    private static let recordVersion: Double = 1
    private static let session = URLSession(configuration: .ephemeral)

    // MARK: - Resolution

    /// The session for a user id. Null-or-empty means "the account the push did
    /// not name": only the active record, and only when it is the sole account.
    static func resolve(userId: String?) -> Record? {
        guard let id = userId, !id.isEmpty else {
            return accountCount() > 1 ? nil : activeRecord()
        }
        if let active = activeRecord(), active.userId == id {
            return active
        }
        guard let entry = accountsMap()?[id] as? String,
              let record = parseRecord(entry),
              record.userId == id else {
            return nil
        }
        return record
    }

    /// Resolve from the push's data fields. A push tag (zam_tag) wins over the
    /// legacy plain user id (zam_account). A tag no account holds resolves to
    /// nil, never to another account.
    static func resolve(tag: String?, legacyAccount: String?) -> Record? {
        if let tag = tag, !tag.isEmpty {
            guard let userId = userIdForTag(tag) else { return nil }
            return resolve(userId: userId)
        }
        if let legacy = legacyAccount, !legacy.isEmpty {
            return resolve(userId: legacy)
        }
        return resolve(userId: nil)
    }

    static func accountCount() -> Int {
        accountsMap()?.count ?? 0
    }

    // MARK: - Requests

    /// One authenticated JSON request. Returns the body on a 2xx response,
    /// nil on any other status, timeout or transport error.
    static func request(_ method: String, _ url: URL, token: String, body: Data?, timeout: TimeInterval) async -> Data? {
        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body = body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else {
                return nil
            }
            return data
        } catch {
            return nil
        }
    }

    /// Percent-encoding for a single path segment or query value, like the
    /// Java enc() helper (unreserved characters only).
    static func enc(_ s: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    /// A JSON object from raw bytes, or nil.
    static func jsonObject(_ data: Data?) -> [String: Any]? {
        guard let data = data else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    // MARK: - Storage reads

    private static func activeRecord() -> Record? {
        parseRecord(AppGroup.defaults.string(forKey: recordKey))
    }

    private static func accountsMap() -> [String: Any]? {
        objectFromString(AppGroup.defaults.string(forKey: accountsKey))
    }

    private static func userIdForTag(_ tag: String) -> String? {
        guard let map = accountsMap() else { return nil }
        for (userId, entry) in map {
            guard let raw = entry as? String,
                  let obj = objectFromString(raw) else {
                continue
            }
            if (obj["pushTag"] as? String) == tag {
                return userId
            }
        }
        return nil
    }

    // MARK: - Parsing (mirror of parseSessionRecord in MatrixMessagingService.java)

    private static func parseRecord(_ raw: String?) -> Record? {
        guard let obj = objectFromString(raw) else { return nil }
        guard let version = obj["v"] as? NSNumber, version.doubleValue == recordVersion else {
            return nil
        }
        guard let hs = validHomeserver(obj["homeserverUrl"]),
              let token = nonBlank(obj["accessToken"]),
              let user = validUserId(obj["userId"]) else {
            return nil
        }
        // deviceId is optional; a wrong type means a corrupt record, not a partial one.
        let rawDevice = obj["deviceId"]
        var device: String? = nil
        if let s = rawDevice as? String {
            device = nonBlank(s)
        } else if rawDevice != nil, !(rawDevice is NSNull) {
            return nil
        }
        return Record(homeserverUrl: stripTrailingSlashes(hs),
                      accessToken: token,
                      userId: user,
                      deviceId: device)
    }

    private static func objectFromString(_ raw: String?) -> [String: Any]? {
        guard let raw = raw, let data = raw.data(using: .utf8) else { return nil }
        return jsonObject(data)
    }

    private static func nonBlank(_ value: Any?) -> String? {
        guard let s = value as? String,
              !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return s
    }

    /// Mirror of validHomeserverUrl(): http or https, a host must follow the
    /// scheme. The trimmed value is kept.
    private static func validHomeserver(_ value: Any?) -> String? {
        guard let raw = nonBlank(value) else { return nil }
        let url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = url.lowercased()
        let prefixLength: Int
        if lower.hasPrefix("https://") {
            prefixLength = 8
        } else if lower.hasPrefix("http://") {
            prefixLength = 7
        } else {
            return nil
        }
        let rest = url.dropFirst(prefixLength)
        guard let first = rest.first, !"/?#".contains(first) else {
            return nil
        }
        return url
    }

    private static func validUserId(_ value: Any?) -> String? {
        guard let id = nonBlank(value), id.hasPrefix("@"), id.count >= 2 else {
            return nil
        }
        return id
    }

    private static func stripTrailingSlashes(_ value: String) -> String {
        var s = value
        while s.hasSuffix("/") {
            s.removeLast()
        }
        return s
    }
}
