import Foundation
import Network
import CFNetwork
import WebKit
import Capacitor

// Port of android/app/src/main/java/moe/crafty/matrix/ProxyPlugin.java and the
// WebView half of ZamProxy.java. Contract: src/lib/proxyBridge.ts, and
// DesktopProxyPrefs / DesktopProxyInfo in src/app.d.ts.
//
// WebKit only takes proxies through WKWebsiteDataStore.proxyConfigurations
// (iOS 17+). Below 17 the plugin still stores the prefs but reports
// supported: false and an error for any mode other than "system".
//
// Native code calls ProxyPlugin.applySaved(to:) once the web view exists, so a
// saved setting is in force before the first page loads.

private let proxyPrefsKey = "zam_proxy_prefs"

/// Same normalisation as ZamProxy.Prefs on Android.
private struct ProxyPrefs: Codable {
    var mode: String
    var rules: String
    var bypass: String

    init(mode: String?, rules: String?, bypass: String?) {
        let m = mode ?? "system"
        self.mode = (m == "direct" || m == "manual") ? m : "system"
        self.rules = cleanText(rules, limit: 1000)
        self.bypass = cleanText(bypass, limit: 4000)
    }
}

private enum ProxyHop {
    case direct
    case server(socks: Bool, host: String, port: UInt16)
}

private struct ProxyRuleError: Error {
    let message: String
}

private func cleanText(_ value: String?, limit: Int) -> String {
    guard let value = value else { return "" }
    let flat = value
        .replacingOccurrences(of: "\r", with: " ")
        .replacingOccurrences(of: "\n", with: " ")
    let trimmed = flat.trimmingCharacters(in: .whitespacesAndNewlines)
    return String(trimmed.prefix(limit))
}

private func errorText(_ error: Error) -> String {
    if let rule = error as? ProxyRuleError { return rule.message }
    return String(describing: error)
}

/// Chromium-style rules, as Android parses them: "socks5://h:p", "h:p" (HTTP),
/// fallbacks separated by commas or spaces, and "http=..." / "https=..." scopes.
private func parseRules(_ rules: String) throws -> [ProxyHop] {
    var hops: [ProxyHop] = []
    for rawPart in rules.components(separatedBy: ";") {
        var part = rawPart.trimmingCharacters(in: .whitespacesAndNewlines)
        if part.isEmpty { continue }
        // WebKit has no per-scheme proxy, so a scope is checked and then ignored.
        if let eq = part.firstIndex(of: "=") {
            let scheme = part[..<eq].trimmingCharacters(in: .whitespaces).lowercased()
            if !scheme.isEmpty && scheme.allSatisfy({ $0.isLetter }) {
                if scheme != "http" && scheme != "https" {
                    throw ProxyRuleError(message: "Unsupported rule scheme: \(scheme)")
                }
                part = String(part[part.index(after: eq)...])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        let separators = CharacterSet(charactersIn: ", \t\r\n")
        for url in part.components(separatedBy: separators) where !url.isEmpty {
            hops.append(try parseHop(url))
        }
    }
    if hops.isEmpty {
        throw ProxyRuleError(message: "No proxy server given")
    }
    return hops
}

private func parseHop(_ rule: String) throws -> ProxyHop {
    var scheme = "http"
    var rest = rule
    if let range = rule.range(of: "://") {
        scheme = rule[..<range.lowerBound].lowercased()
        rest = String(rule[range.upperBound...])
    }
    if let slash = rest.firstIndex(of: "/") {
        rest = String(rest[..<slash])
    }
    if scheme == "direct" { return .direct }

    let socks: Bool
    switch scheme {
    case "http":
        socks = false
    case "socks", "socks5":
        socks = true
    default:
        // https needs TLS to the proxy, which the iOS API call used here does not set up.
        throw ProxyRuleError(message: "Unsupported proxy scheme: \(scheme)")
    }

    let bad = ProxyRuleError(message: "Bad proxy address: \(rule)")
    var host = rest
    var port = socks ? 1080 : 80
    if rest.hasPrefix("[") {
        guard let close = rest.firstIndex(of: "]") else { throw bad }
        host = String(rest[rest.index(after: rest.startIndex)..<close])
        let after = String(rest[rest.index(after: close)...])
        if !after.isEmpty {
            guard after.hasPrefix(":"), let p = Int(after.dropFirst()) else { throw bad }
            port = p
        }
    } else {
        let pieces = rest.split(separator: ":", omittingEmptySubsequences: false)
        if pieces.count == 2 {
            host = String(pieces[0])
            guard let p = Int(pieces[1]) else { throw bad }
            port = p
        } else if pieces.count != 1 {
            throw bad
        }
    }
    guard !host.isEmpty, port >= 1, port <= 65535 else { throw bad }
    return .server(socks: socks, host: host, port: UInt16(port))
}

/// Bypass list to WebKit's excludedDomains. CIDR ranges and <local> have no
/// equivalent and are dropped.
private func excludedDomains(_ bypass: String) -> [String] {
    var out: [String] = []
    let separators = CharacterSet(charactersIn: ",; \t\r\n")
    for raw in bypass.components(separatedBy: separators) {
        var entry = raw.lowercased()
        if entry.isEmpty || entry == "<local>" { continue }
        if let range = entry.range(of: "://") {
            entry = String(entry[range.upperBound...])
        }
        if entry.contains("/") { continue }
        if entry.hasPrefix("*.") {
            entry = String(entry.dropFirst(2))
        }
        if entry.isEmpty || entry.contains("*") { continue }
        out.append(entry)
    }
    return out
}

/// The proxy list for `prefs`. Empty means WebKit's own handling: system proxy
/// settings in "system", and "direct" (and manual with no rules) go direct.
@available(iOS 17.0, *)
private func proxyConfigurations(for prefs: ProxyPrefs) throws -> [ProxyConfiguration] {
    guard prefs.mode == "manual", !prefs.rules.isEmpty else { return [] }
    var configs: [ProxyConfiguration] = []
    for hop in try parseRules(prefs.rules) {
        switch hop {
        case .direct:
            // A direct rule ends the list: anything after it is never needed.
            return configs
        case let .server(socks, host, port):
            guard let nwPort = NWEndpoint.Port(rawValue: port) else { continue }
            let endpoint = NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: nwPort)
            var config = socks
                ? ProxyConfiguration(socksv5Proxy: endpoint)
                : ProxyConfiguration(httpCONNECTProxy: endpoint)
            config.excludedDomains = excludedDomains(prefs.bypass)
            configs.append(config)
        }
    }
    return configs
}

@objc(ProxyPlugin)
public class ProxyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProxyPlugin"
    public let jsName = "Proxy"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "callTargets", returnType: CAPPluginReturnPromise),
    ]

    /// Main thread only (plugin calls and applySaved both run there).
    private static var prefs: ProxyPrefs = loadSavedPrefs()
    /// Shown as `error` in info(). Nil when the setting is in force.
    private static var lastError: String? = nil

    /// True where WebKit accepts proxy configurations.
    private static var supported: Bool {
        if #available(iOS 17.0, *) {
            return true
        }
        return false
    }

    // MARK: - Native entry point

    /// Apply the saved setting to a web view's data store. Call once the web
    /// view exists, before its first load.
    public static func applySaved(to webView: WKWebView?) {
        do {
            lastError = try push(prefs, to: webView?.configuration.websiteDataStore)
        } catch {
            lastError = errorText(error)
        }
    }

    // MARK: - Plugin methods

    @objc func info(_ call: CAPPluginCall) {
        call.resolve(ProxyPlugin.infoPayload())
    }

    @objc func set(_ call: CAPPluginCall) {
        let next = ProxyPrefs(
            mode: call.getString("mode"),
            rules: call.getString("rules"),
            bypass: call.getString("bypass")
        )
        ProxyPlugin.commit(next, store: bridge?.webView?.configuration.websiteDataStore)
        call.resolve(ProxyPlugin.infoPayload())
    }

    @objc func callTargets(_ call: CAPPluginCall) {
        // iOS has no call bypass, so there is nothing to record.
        call.resolve()
    }

    // MARK: - State

    private static func infoPayload() -> [String: Any] {
        var error: Any = NSNull()
        if let text = lastError {
            error = text
        }
        return [
            "mode": prefs.mode,
            "rules": prefs.rules,
            "bypass": prefs.bypass,
            "pacUrl": "",
            "calls": "default",
            "launchFlags": [String](),
            "callBypassAddresses": [String](),
            "callBypassAvailable": false,
            "error": error,
            "supported": supported,
            "modes": ["system", "direct", "manual"],
            "callModes": ["default"],
        ]
    }

    /// Store `next` and persist it, unless its rules can't be used. Then the
    /// previous setting stays in force and the error is reported.
    private static func commit(_ next: ProxyPrefs, store: WKWebsiteDataStore?) {
        do {
            lastError = try push(next, to: store)
            prefs = next
            persist(next)
        } catch {
            lastError = errorText(error)
        }
    }

    /// Push `p` into the data store. Throws (and leaves the store as it was)
    /// when the rules can't be used. Returns the note to report, or nil.
    private static func push(_ p: ProxyPrefs, to store: WKWebsiteDataStore?) throws -> String? {
        if #available(iOS 17.0, *) {
            let configs = try proxyConfigurations(for: p)
            store?.proxyConfigurations = configs
            return directNote(for: p)
        }
        return p.mode == "system" ? nil : "Proxy needs iOS 17 or later"
    }

    /// "direct" can't override an OS proxy, so say so when one is configured.
    private static func directNote(for p: ProxyPrefs) -> String? {
        guard p.mode == "direct", systemProxyEnabled() else { return nil }
        return "An OS proxy is set. iOS keeps using it, so direct can't bypass it."
    }

    private static func systemProxyEnabled() -> Bool {
        guard let settings = CFNetworkCopySystemProxySettings() as? [String: Any] else {
            return false
        }
        for key in ["HTTPEnable", "HTTPSEnable", "SOCKSEnable", "ProxyAutoConfigEnable"] {
            if let flag = settings[key] as? NSNumber, flag.intValue != 0 {
                return true
            }
        }
        return false
    }

    private static func loadSavedPrefs() -> ProxyPrefs {
        guard let data = UserDefaults.standard.data(forKey: proxyPrefsKey),
              let saved = try? JSONDecoder().decode(ProxyPrefs.self, from: data) else {
            return ProxyPrefs(mode: nil, rules: nil, bypass: nil)
        }
        return ProxyPrefs(mode: saved.mode, rules: saved.rules, bypass: saved.bypass)
    }

    private static func persist(_ p: ProxyPrefs) {
        guard let data = try? JSONEncoder().encode(p) else { return }
        UserDefaults.standard.set(data, forKey: proxyPrefsKey)
    }
}
