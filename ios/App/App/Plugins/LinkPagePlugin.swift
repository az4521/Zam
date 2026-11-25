import Foundation
import Capacitor

// Port of android/app/src/main/java/moe/crafty/matrix/LinkPagePlugin.java.
// Contract: src/lib/linkPageFetch.ts. Every failure resolves { kind: "none" };
// the method never rejects.
@objc(LinkPagePlugin)
public class LinkPagePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LinkPagePlugin"
    public let jsName = "LinkPage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fetch", returnType: CAPPluginReturnPromise),
    ]

    @objc func fetch(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let mode = call.getString("mode"),
              mode == "page" || mode == "image" else {
            call.resolve(LinkPageFetcher.noneResult())
            return
        }
        let fetcher = LinkPageFetcher(urlString: urlString, page: mode == "page") { result in
            DispatchQueue.main.async {
                call.resolve(result)
            }
        }
        fetcher.start()
    }
}

/// One fetch: a private ephemeral session, its own redirect handling, and a
/// hard deadline. Completes exactly once (see `finish`).
final class LinkPageFetcher: NSObject, URLSessionDataDelegate {
    static let userAgent = "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots) WhatsApp/2.23.20.0"
    static let pageAccept = "text/html,application/xhtml+xml;q=0.9,image/*;q=0.8,*/*;q=0.5"
    static let imageAccept = "image/*"
    static let maxHTMLBytes = 1024 * 1024
    static let maxImageBytes = 8 * 1024 * 1024
    static let maxRedirects = 5
    static let deadlineSeconds: Double = 8

    static func noneResult() -> [String: Any] {
        return ["kind": "none"]
    }

    private enum Kind {
        case html(String?)
        case image(String)
    }

    private let startURLString: String
    private let page: Bool
    private let completion: ([String: Any]) -> Void

    private let lock = NSLock()
    // Guarded by lock.
    private var selfRetain: LinkPageFetcher?
    private var session: URLSession?
    private var deadlineWork: DispatchWorkItem?
    private var finished = false

    // Touched only on the session's delegate queue (serial).
    private var kind: Kind?
    private var responseURL: URL?
    private var byteLimit = 0
    private var buffer = Data()
    private var redirects = 0

    init(urlString: String, page: Bool, completion: @escaping ([String: Any]) -> Void) {
        self.startURLString = urlString
        self.page = page
        self.completion = completion
        super.init()
    }

    func start() {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 5
        config.timeoutIntervalForResource = LinkPageFetcher.deadlineSeconds
        ProxyPlugin.configure(config)

        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        let newSession = URLSession(configuration: config, delegate: self, delegateQueue: queue)

        let work = DispatchWorkItem { [weak self] in
            self?.finish(nil)
        }

        lock.lock()
        selfRetain = self
        session = newSession
        deadlineWork = work
        lock.unlock()

        DispatchQueue.global(qos: .utility).asyncAfter(
            deadline: .now() + LinkPageFetcher.deadlineSeconds,
            execute: work
        )
        // The first hop's DNS check blocks, so it stays off the caller's thread.
        DispatchQueue.global(qos: .utility).async { [weak self] in
            self?.begin()
        }
    }

    private func begin() {
        guard let url = URL(string: startURLString),
              LinkPageNetwork.isAllowedTarget(url) else {
            finish(nil)
            return
        }
        lock.lock()
        defer { lock.unlock() }
        guard !finished, let activeSession = session else { return }
        let task = activeSession.dataTask(with: makeRequest(url))
        task.resume()
    }

    private func makeRequest(_ url: URL) -> URLRequest {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5)
        request.httpShouldHandleCookies = false
        request.setValue(LinkPageFetcher.userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue(page ? LinkPageFetcher.pageAccept : LinkPageFetcher.imageAccept,
                         forHTTPHeaderField: "Accept")
        return request
    }

    /// Delivers the result once; later calls (deadline, cancel, late callbacks) are ignored.
    private func finish(_ result: [String: Any]?) {
        lock.lock()
        if finished {
            lock.unlock()
            return
        }
        finished = true
        let activeSession = session
        session = nil
        let work = deadlineWork
        deadlineWork = nil
        let keepAlive = selfRetain
        selfRetain = nil
        lock.unlock()

        work?.cancel()
        activeSession?.invalidateAndCancel()
        completion(result ?? LinkPageFetcher.noneResult())
        withExtendedLifetime(keepAlive) {}
    }

    /// Builds the success object from what has been received so far.
    private func succeed() {
        guard let currentKind = kind else {
            finish(nil)
            return
        }
        let finalURL = responseURL?.absoluteString ?? startURLString
        switch currentKind {
        case .image(let contentType):
            finish([
                "kind": "image",
                "finalUrl": finalURL,
                "contentType": contentType,
                "base64": buffer.base64EncodedString(),
            ])
        case .html(let encoding):
            let html = LinkPageNetwork.decodeHTML(buffer, encoding: encoding)
            finish([
                "kind": "html",
                "finalUrl": finalURL,
                "html": html,
            ])
        }
    }

    // MARK: URLSessionTaskDelegate / URLSessionDataDelegate

    func urlSession(_ session: URLSession,
                    task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        redirects += 1
        let isRedirectCode = [301, 302, 303, 307, 308].contains(response.statusCode)
        guard isRedirectCode,
              redirects <= LinkPageFetcher.maxRedirects,
              let next = request.url,
              LinkPageNetwork.isAllowedTarget(next) else {
            completionHandler(nil)
            finish(nil)
            return
        }
        var hop = request
        hop.httpShouldHandleCookies = false
        hop.setValue(nil, forHTTPHeaderField: "Cookie")
        hop.setValue(LinkPageFetcher.userAgent, forHTTPHeaderField: "User-Agent")
        hop.setValue(page ? LinkPageFetcher.pageAccept : LinkPageFetcher.imageAccept,
                     forHTTPHeaderField: "Accept")
        completionHandler(hop)
    }

    func urlSession(_ session: URLSession,
                    dataTask: URLSessionDataTask,
                    didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode) else {
            completionHandler(.cancel)
            finish(nil)
            return
        }
        // mimeType has the parameters stripped, like mimeOf() in the Java code.
        let ctype = (http.mimeType ?? "").lowercased()
        responseURL = http.url

        if ctype.hasPrefix("image/") && ctype != "image/svg+xml" {
            kind = .image(ctype)
            byteLimit = LinkPageFetcher.maxImageBytes
            completionHandler(.allow)
            return
        }
        if page && (ctype == "text/html" || ctype == "application/xhtml+xml") {
            kind = .html(http.textEncodingName)
            byteLimit = LinkPageFetcher.maxHTMLBytes
            completionHandler(.allow)
            return
        }
        completionHandler(.cancel)
        finish(nil)
    }

    func urlSession(_ session: URLSession,
                    dataTask: URLSessionDataTask,
                    didReceive data: Data) {
        guard let currentKind = kind else { return }
        let room = byteLimit - buffer.count
        if data.count <= room {
            buffer.append(data)
            return
        }
        switch currentKind {
        case .image:
            // Over the image cap: fail, as the Java code does.
            finish(nil)
        case .html:
            // Over the HTML cap: keep the first bytes and succeed, as the Java code does.
            buffer.append(contentsOf: data.prefix(max(room, 0)))
            succeed()
        }
    }

    func urlSession(_ session: URLSession,
                    task: URLSessionTask,
                    didCompleteWithError error: Error?) {
        if error != nil {
            finish(nil)
            return
        }
        succeed()
    }
}

/// Target checks and charset handling shared by the fetcher.
enum LinkPageNetwork {
    /// Scheme, userinfo and DNS checks for one hop, before connecting. Every
    /// resolved address must be public.
    static func isAllowedTarget(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
            return false
        }
        if url.user != nil || url.password != nil { return false }
        guard var host = url.host, !host.isEmpty else { return false }
        if host.hasPrefix("[") && host.hasSuffix("]") {
            host = String(host.dropFirst().dropLast())
        }

        var hints = addrinfo()
        hints.ai_family = AF_UNSPEC
        hints.ai_socktype = SOCK_STREAM
        var resolved: UnsafeMutablePointer<addrinfo>? = nil
        let rc = getaddrinfo(host, nil, &hints, &resolved)
        guard rc == 0, let first = resolved else { return false }
        defer { freeaddrinfo(first) }

        var sawAny = false
        var cursor: UnsafeMutablePointer<addrinfo>? = first
        while let ai = cursor {
            guard let sa = ai.pointee.ai_addr else { return false }
            if !isPublicSockaddr(UnsafePointer(sa)) { return false }
            sawAny = true
            cursor = ai.pointee.ai_next
        }
        return sawAny
    }

    static func isPublicSockaddr(_ sa: UnsafePointer<sockaddr>) -> Bool {
        switch Int32(sa.pointee.sa_family) {
        case AF_INET:
            let sin = UnsafeRawPointer(sa).load(as: sockaddr_in.self)
            let bytes = withUnsafeBytes(of: sin.sin_addr.s_addr) { Array($0) }
            return isPublicIPv4(bytes)
        case AF_INET6:
            let sin6 = UnsafeRawPointer(sa).load(as: sockaddr_in6.self)
            let bytes = withUnsafeBytes(of: sin6.sin6_addr) { Array($0) }
            return isPublicIPv6(bytes)
        default:
            return false
        }
    }

    /// Network-order bytes a.b.c.d. Mirrors isPublicIpv4 in the Java code, plus
    /// the multicast and reserved ranges (224/4 and up).
    static func isPublicIPv4(_ b: [UInt8]) -> Bool {
        guard b.count == 4 else { return false }
        let a = Int(b[0])
        let c = Int(b[1])
        let d = Int(b[2])
        if a == 0 { return false }                            // 0.0.0.0/8
        if a == 10 { return false }                           // 10.0.0.0/8
        if a == 127 { return false }                          // loopback
        if a == 100 && (c & 0xC0) == 64 { return false }      // 100.64.0.0/10 CGNAT
        if a == 169 && c == 254 { return false }              // link-local
        if a == 172 && (c & 0xF0) == 16 { return false }      // 172.16.0.0/12
        if a == 192 && c == 168 { return false }              // 192.168.0.0/16
        if a == 192 && c == 0 && (d == 0 || d == 2) { return false } // 192.0.0.0/24, 192.0.2.0/24
        if a == 198 && (c == 18 || c == 19) { return false }  // 198.18.0.0/15
        if a == 198 && c == 51 && d == 100 { return false }   // 198.51.100.0/24
        if a == 203 && c == 0 && d == 113 { return false }    // 203.0.113.0/24
        if a >= 224 { return false }                          // multicast, reserved, broadcast
        return true
    }

    /// 16 network-order bytes. IPv4-mapped, IPv4-compatible and NAT64 forms are
    /// judged by their embedded IPv4 address.
    static func isPublicIPv6(_ b: [UInt8]) -> Bool {
        guard b.count == 16 else { return false }
        let leadingZeros = b[0..<10].allSatisfy { $0 == 0 }
        if leadingZeros && b[10] == 0xff && b[11] == 0xff {
            return isPublicIPv4(Array(b[12..<16]))            // ::ffff:a.b.c.d
        }
        if leadingZeros && b[10] == 0 && b[11] == 0 {
            return isPublicIPv4(Array(b[12..<16]))            // ::a.b.c.d, also :: and ::1
        }
        let nat64Zeros = b[4..<12].allSatisfy { $0 == 0 }
        if b[0] == 0x00 && b[1] == 0x64 && b[2] == 0xff && b[3] == 0x9b && nat64Zeros {
            return isPublicIPv4(Array(b[12..<16]))            // 64:ff9b::/96
        }
        if (b[0] & 0xfe) == 0xfc { return false }             // fc00::/7 unique local
        if b[0] == 0xfe && (b[1] & 0xc0) == 0x80 { return false } // fe80::/10 link-local
        if b[0] == 0xfe && (b[1] & 0xc0) == 0xc0 { return false } // fec0::/10 site-local
        if b[0] == 0xff { return false }                      // ff00::/8 multicast
        if b[0] == 0x20 && b[1] == 0x01 && b[2] == 0x0d && b[3] == 0xb8 {
            return false                                      // 2001:db8::/32 documentation
        }
        return true
    }

    /// Decodes with the response's charset, then UTF-8, then ISO-8859-1.
    static func decodeHTML(_ data: Data, encoding: String?) -> String {
        if let name = encoding, !name.isEmpty {
            let cfEncoding = CFStringConvertIANACharSetNameToEncoding(name as CFString)
            if cfEncoding != kCFStringEncodingInvalidId {
                let nsEncoding = CFStringConvertEncodingToNSStringEncoding(cfEncoding)
                if let text = String(data: data, encoding: String.Encoding(rawValue: nsEncoding)) {
                    return text
                }
            }
        }
        if let text = String(data: data, encoding: .utf8) {
            return text
        }
        return String(data: data, encoding: .isoLatin1) ?? ""
    }
}
