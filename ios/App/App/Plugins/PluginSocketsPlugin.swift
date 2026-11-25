import Foundation
import Network
import Darwin
import WebKit
import Capacitor

// Port of android/app/src/main/java/moe/crafty/matrix/PluginSocketsPlugin.java.
// Contract: src/lib/plugins/pluginSockets.ts (tcp, udp, write, send, close,
// closePlugin; "socketEvent" notifications with data / message / close).
//
// TCP uses Network.framework (NWConnection). UDP uses a POSIX datagram socket
// (AF_INET6, dual stack), because an unconnected socket that can send to any
// host:port and receive from any peer is not something NWListener offers.
//
// All socket state lives on `socketQueue`. Plugin calls are queued onto it and
// their results and events are delivered on the main queue, in order.

private let maxSocketsPerPlugin = 64
private let connectTimeoutSeconds: Double = 15
private let tcpReadChunk = 16 * 1024
private let udpBufferSize = 64 * 1024

/// One socket, pending or open. Only touched on `socketQueue`.
private final class SocketEntry {
    let id: Int
    let pluginId: String
    let isTCP: Bool
    /// TCP: connected. UDP: bound.
    var ready = false
    var closed = false
    /// The call waiting for connect / bind to settle, if any.
    var pendingCall: CAPPluginCall?
    var connection: NWConnection?
    var fd: Int32 = -1
    var readSource: DispatchSourceRead?
    var rx = [UInt8](repeating: 0, count: udpBufferSize)

    init(id: Int, pluginId: String, isTCP: Bool) {
        self.id = id
        self.pluginId = pluginId
        self.isTCP = isTCP
    }
}

private struct SocketFailure: Error {
    let message: String
}

// File scope on purpose: inside the plugin, `close` and `send` name the
// CAPPlugin methods, so the POSIX calls live out here.
private func sysClose(_ fd: Int32) {
    _ = Darwin.close(fd)
}

private func errnoText(_ code: Int32) -> String {
    return String(cString: strerror(code))
}

private func cText(_ buf: [CChar]) -> String {
    return buf.withUnsafeBufferPointer { String(cString: $0.baseAddress!) }
}

private func networkErrorText(_ error: NWError) -> String {
    switch error {
    case .posix(let code):
        return errnoText(code.rawValue)
    case .dns(let code):
        return "DNS error \(code)"
    case .tls(let status):
        return "TLS error \(status)"
    default:
        return "\(error)"
    }
}

private func messageOf(_ error: Error) -> String {
    if let failure = error as? SocketFailure { return failure.message }
    return String(describing: error)
}

private func isAlnumByte(_ c: UInt8) -> Bool {
    return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)
}

/// Same rule as the Java side: ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$
private func isValidPluginId(_ s: String) -> Bool {
    let bytes = Array(s.utf8)
    if bytes.isEmpty || bytes.count > 128 { return false }
    for (i, c) in bytes.enumerated() {
        if i == 0 {
            if !isAlnumByte(c) { return false }
        } else if !(isAlnumByte(c) || c == 0x2E || c == 0x5F || c == 0x2D) {
            return false
        }
    }
    return true
}

/// Same rule as the Java side: ^[A-Za-z0-9.:-]{1,253}$
private func isValidHost(_ s: String) -> Bool {
    let bytes = Array(s.utf8)
    if bytes.isEmpty || bytes.count > 253 { return false }
    for c in bytes {
        if isAlnumByte(c) || c == 0x2E || c == 0x3A || c == 0x2D { continue }
        return false
    }
    return true
}

private func isValidPort(_ port: Int, allowZero: Bool) -> Bool {
    return port >= (allowZero ? 0 : 1) && port <= 65535
}

/// An IPv6 socket address for `ai`. IPv4 results become IPv4-mapped
/// (::ffff:a.b.c.d) so one dual-stack socket can talk to both families.
private func ipv6SockAddr(_ ai: addrinfo, port: UInt16) -> sockaddr_in6? {
    guard let sa = ai.ai_addr else { return nil }
    var out = sockaddr_in6()
    out.sin6_len = UInt8(MemoryLayout<sockaddr_in6>.size)
    out.sin6_family = sa_family_t(AF_INET6)
    out.sin6_port = port.bigEndian
    if ai.ai_family == AF_INET {
        let v4 = UnsafeRawPointer(sa).load(as: sockaddr_in.self)
        var raw = [UInt8](repeating: 0, count: 16)
        raw[10] = 0xFF
        raw[11] = 0xFF
        withUnsafeBytes(of: v4.sin_addr.s_addr) { bytes in
            for i in 0..<4 { raw[12 + i] = bytes[i] }
        }
        withUnsafeMutableBytes(of: &out.sin6_addr) { dst in
            for i in 0..<16 { dst[i] = raw[i] }
        }
    } else if ai.ai_family == AF_INET6 {
        let v6 = UnsafeRawPointer(sa).load(as: sockaddr_in6.self)
        out.sin6_addr = v6.sin6_addr
        out.sin6_scope_id = v6.sin6_scope_id
    } else {
        return nil
    }
    return out
}

/// The first usable result of getaddrinfo for `host`, as a sockaddr_in6.
private func resolveIPv6(_ host: String, port: Int) throws -> sockaddr_in6 {
    var hints = addrinfo()
    hints.ai_family = AF_UNSPEC
    hints.ai_socktype = SOCK_DGRAM
    var res: UnsafeMutablePointer<addrinfo>? = nil
    let rc = getaddrinfo(host, String(port), &hints, &res)
    if rc != 0 {
        throw SocketFailure(message: String(cString: gai_strerror(rc)))
    }
    guard let head = res else {
        throw SocketFailure(message: "Unable to resolve host")
    }
    defer { freeaddrinfo(head) }
    var cur: UnsafeMutablePointer<addrinfo>? = head
    while let node = cur {
        if let addr = ipv6SockAddr(node.pointee, port: UInt16(truncatingIfNeeded: port)) {
            return addr
        }
        cur = node.pointee.ai_next
    }
    throw SocketFailure(message: "Unable to resolve host")
}

/// A bound dual-stack UDP socket. Returns the fd and the local port.
private func bindUDP(host: String, port: Int) throws -> (fd: Int32, port: Int) {
    var addr = try resolveIPv6(host, port: port)
    let fd = socket(AF_INET6, SOCK_DGRAM, IPPROTO_UDP)
    if fd < 0 {
        throw SocketFailure(message: errnoText(errno))
    }
    var v6only: Int32 = 0
    _ = setsockopt(fd, IPPROTO_IPV6, IPV6_V6ONLY, &v6only, socklen_t(MemoryLayout<Int32>.size))
    let bindRC: Int32 = withUnsafePointer(to: &addr) { p -> Int32 in
        p.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int32 in
            bind(fd, sa, socklen_t(MemoryLayout<sockaddr_in6>.size))
        }
    }
    if bindRC != 0 {
        let code = errno
        sysClose(fd)
        throw SocketFailure(message: errnoText(code))
    }
    var bound = sockaddr_in6()
    var len = socklen_t(MemoryLayout<sockaddr_in6>.size)
    let nameRC: Int32 = withUnsafeMutablePointer(to: &bound) { p -> Int32 in
        p.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int32 in
            getsockname(fd, sa, &len)
        }
    }
    let localPort = nameRC == 0 ? Int(UInt16(bigEndian: bound.sin6_port)) : port
    return (fd, localPort)
}

/// One datagram to host:port over an already open socket.
private func sendUDP(fd: Int32, host: String, port: Int, data: Data) throws {
    var dest = try resolveIPv6(host, port: port)
    let sent: Int = data.withUnsafeBytes { raw -> Int in
        withUnsafePointer(to: &dest) { p -> Int in
            p.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int in
                sendto(fd, raw.baseAddress, raw.count, 0, sa, socklen_t(MemoryLayout<sockaddr_in6>.size))
            }
        }
    }
    if sent < 0 {
        throw SocketFailure(message: errnoText(errno))
    }
}

@objc(PluginSocketsPlugin)
public class PluginSocketsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PluginSocketsPlugin"
    public let jsName = "PluginSockets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "tcp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "udp", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closePlugin", returnType: CAPPluginReturnPromise),
    ]

    /// Serial queue. Every SocketEntry and the id table are used only here.
    private let socketQueue = DispatchQueue(label: "moe.crafty.matrix.PluginSockets")
    private var sockets: [Int: SocketEntry] = [:]
    private var nextId = 1
    /// Main thread only.
    private var pageObservation: NSKeyValueObservation?

    // MARK: - Lifecycle

    override public func load() {
        // A new page knows nothing of the sockets the old one opened. Android
        // closes them in onPageStarted. WKWebView has no page-start callback
        // that a plugin can hook, so this watches isLoading and closes every
        // socket whenever a load starts.
        guard let webView = bridge?.webView else { return }
        pageObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] _, change in
            if change.newValue == true {
                self?.closeAll()
            }
        }
    }

    // MARK: - Plugin methods

    @objc func tcp(_ call: CAPPluginCall) {
        let pluginId = call.getString("pluginId")
        let host = call.getString("host")
        let port = call.getInt("port") ?? -1
        if pluginId == nil || !isValidPluginId(pluginId ?? "") {
            call.reject("bad plugin id")
            return
        }
        guard let target = host, isValidHost(target) else {
            call.reject("bad host")
            return
        }
        guard isValidPort(port, allowZero: false) else {
            call.reject("bad port")
            return
        }
        let owner = pluginId ?? ""
        socketQueue.async {
            self.openTCP(call, pluginId: owner, host: target, port: port)
        }
    }

    @objc func udp(_ call: CAPPluginCall) {
        let pluginId = call.getString("pluginId")
        let localHost = call.getString("localHost") ?? "127.0.0.1"
        let localPort = call.getInt("localPort") ?? 0
        if pluginId == nil || !isValidPluginId(pluginId ?? "") {
            call.reject("bad plugin id")
            return
        }
        guard isValidHost(localHost) else {
            call.reject("bad host")
            return
        }
        guard isValidPort(localPort, allowZero: true) else {
            call.reject("bad port")
            return
        }
        let owner = pluginId ?? ""
        socketQueue.async {
            self.openUDP(call, pluginId: owner, host: localHost, port: localPort)
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        let id = call.getInt("id") ?? -1
        let encoded = call.getString("data")
        socketQueue.async {
            guard let e = self.openEntry(id, isTCP: true) else {
                self.rejectCall(call, "socket is closed")
                return
            }
            guard let text = encoded else {
                self.rejectCall(call, "bad data")
                return
            }
            guard let bytes = Data(base64Encoded: text) else {
                self.rejectCall(call, "bad data")
                return
            }
            if bytes.isEmpty {
                self.resolveCall(call)
                return
            }
            guard let conn = e.connection else {
                self.rejectCall(call, "socket is closed")
                return
            }
            conn.send(content: bytes, completion: .contentProcessed { error in
                if let error = error {
                    self.rejectCall(call, networkErrorText(error))
                } else {
                    self.resolveCall(call)
                }
            })
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        let id = call.getInt("id") ?? -1
        let host = call.getString("host")
        let port = call.getInt("port") ?? -1
        let encoded = call.getString("data")
        socketQueue.async {
            guard let e = self.openEntry(id, isTCP: false) else {
                self.rejectCall(call, "socket is closed")
                return
            }
            guard let target = host, isValidHost(target), isValidPort(port, allowZero: false) else {
                self.rejectCall(call, "bad address")
                return
            }
            guard let text = encoded else {
                self.rejectCall(call, "bad data")
                return
            }
            guard let bytes = Data(base64Encoded: text) else {
                self.rejectCall(call, "bad data")
                return
            }
            do {
                try sendUDP(fd: e.fd, host: target, port: port, data: bytes)
                self.resolveCall(call)
            } catch {
                self.rejectCall(call, messageOf(error))
            }
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        let id = call.getInt("id") ?? -1
        socketQueue.async {
            // Silent: the page dropped the socket already.
            if let e = self.sockets[id] {
                self.finish(e, notify: false, error: nil)
            }
            self.resolveCall(call)
        }
    }

    @objc func closePlugin(_ call: CAPPluginCall) {
        let pluginId = call.getString("pluginId")
        socketQueue.async {
            if let pid = pluginId {
                for e in Array(self.sockets.values) where e.pluginId == pid {
                    self.finish(e, notify: false, error: nil)
                }
            }
            self.resolveCall(call)
        }
    }

    // MARK: - Socket work (socketQueue only)

    private func register(pluginId: String, isTCP: Bool) -> SocketEntry? {
        let count = sockets.values.filter { $0.pluginId == pluginId }.count
        if count >= maxSocketsPerPlugin { return nil }
        let e = SocketEntry(id: nextId, pluginId: pluginId, isTCP: isTCP)
        nextId += 1
        sockets[e.id] = e
        return e
    }

    /// An open socket of the given kind, or nil (closed, unknown, pending, or the other kind).
    private func openEntry(_ id: Int, isTCP: Bool) -> SocketEntry? {
        guard let e = sockets[id] else { return nil }
        if !e.ready || e.closed || e.isTCP != isTCP { return nil }
        return e
    }

    private func openTCP(_ call: CAPPluginCall, pluginId: String, host: String, port: Int) {
        guard let nwPort = NWEndpoint.Port(rawValue: UInt16(truncatingIfNeeded: port)) else {
            rejectCall(call, "bad port")
            return
        }
        guard let e = register(pluginId: pluginId, isTCP: true) else {
            rejectCall(call, "too many sockets")
            return
        }
        let params = NWParameters.tcp
        if let tcpOptions = params.defaultProtocolStack.transportProtocol as? NWProtocolTCP.Options {
            tcpOptions.noDelay = true
        }
        let conn = NWConnection(host: NWEndpoint.Host(host), port: nwPort, using: params)
        e.connection = conn
        e.pendingCall = call
        conn.stateUpdateHandler = { [weak self, weak e] state in
            guard let self = self, let e = e else { return }
            self.onTCPState(e, state)
        }
        conn.start(queue: socketQueue)
        // Covers both a plain hang and a .waiting state that never recovers.
        socketQueue.asyncAfter(deadline: .now() + connectTimeoutSeconds) { [weak self, weak e] in
            guard let self = self, let e = e, !e.ready, !e.closed else { return }
            self.finish(e, notify: false, error: nil, pendingReason: "connect timed out")
        }
    }

    private func onTCPState(_ e: SocketEntry, _ state: NWConnection.State) {
        if e.closed { return }
        switch state {
        case .ready:
            if e.ready { return }
            e.ready = true
            if let call = e.pendingCall {
                e.pendingCall = nil
                resolveCall(call, ["id": e.id])
            }
            receiveTCP(e)
        case .failed(let error):
            let text = networkErrorText(error)
            if e.ready {
                finish(e, notify: true, error: text)
            } else {
                finish(e, notify: false, error: nil, pendingReason: text)
            }
        default:
            // .setup, .preparing, .waiting: the connect timer decides.
            break
        }
    }

    private func receiveTCP(_ e: SocketEntry) {
        guard let conn = e.connection, !e.closed else { return }
        conn.receive(minimumIncompleteLength: 1, maximumLength: tcpReadChunk) { [weak self, weak e] content, _, isComplete, error in
            guard let self = self, let e = e, !e.closed else { return }
            if let bytes = content, !bytes.isEmpty {
                self.emit(["id": e.id, "type": "data", "data": bytes.base64EncodedString()])
            }
            if let error = error {
                self.finish(e, notify: true, error: networkErrorText(error))
                return
            }
            if isComplete {
                // The peer closed cleanly.
                self.finish(e, notify: true, error: nil)
                return
            }
            self.receiveTCP(e)
        }
    }

    private func openUDP(_ call: CAPPluginCall, pluginId: String, host: String, port: Int) {
        guard let e = register(pluginId: pluginId, isTCP: false) else {
            rejectCall(call, "too many sockets")
            return
        }
        e.pendingCall = call
        do {
            let bound = try bindUDP(host: host, port: port)
            e.fd = bound.fd
            e.ready = true
            if let waiting = e.pendingCall {
                e.pendingCall = nil
                resolveCall(waiting, ["id": e.id, "localPort": bound.port])
            }
            startUDP(e)
        } catch {
            finish(e, notify: false, error: nil, pendingReason: messageOf(error))
        }
    }

    private func startUDP(_ e: SocketEntry) {
        let source = DispatchSource.makeReadSource(fileDescriptor: e.fd, queue: socketQueue)
        source.setEventHandler { [weak self, weak e] in
            guard let self = self, let e = e else { return }
            self.drainUDP(e)
        }
        e.readSource = source
        source.resume()
    }

    /// Reads one datagram and posts it as a "message" event.
    private func drainUDP(_ e: SocketEntry) {
        if e.closed || e.fd < 0 { return }
        let fd = e.fd
        var from = sockaddr_storage()
        var fromLen = socklen_t(MemoryLayout<sockaddr_storage>.size)
        let received: Int = e.rx.withUnsafeMutableBytes { buf -> Int in
            withUnsafeMutablePointer(to: &from) { p -> Int in
                p.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int in
                    recvfrom(fd, buf.baseAddress, buf.count, 0, sa, &fromLen)
                }
            }
        }
        if received < 0 {
            let code = errno
            if code == EINTR || code == EAGAIN { return }
            finish(e, notify: true, error: errnoText(code))
            return
        }
        let hostCap = socklen_t(NI_MAXHOST)
        let servCap = socklen_t(NI_MAXSERV)
        var hostBuf = [CChar](repeating: 0, count: Int(hostCap))
        var servBuf = [CChar](repeating: 0, count: Int(servCap))
        let nameRC: Int32 = withUnsafePointer(to: &from) { p -> Int32 in
            p.withMemoryRebound(to: sockaddr.self, capacity: 1) { sa -> Int32 in
                getnameinfo(sa, fromLen, &hostBuf, hostCap, &servBuf, servCap, NI_NUMERICHOST | NI_NUMERICSERV)
            }
        }
        if nameRC != 0 { return }
        var host = cText(hostBuf)
        // Show IPv4 senders as plain IPv4, not ::ffff: mapped.
        if host.hasPrefix("::ffff:") && host.contains(".") {
            host = String(host.dropFirst(7))
        }
        let port = Int(cText(servBuf)) ?? 0
        let payload = Data(e.rx.prefix(received)).base64EncodedString()
        emit(["id": e.id, "type": "message", "host": host, "port": port, "data": payload])
    }

    /// The one place a socket goes away. Idempotent. Emits one "close" when
    /// `notify` is set (remote or I/O failure); a user close is silent.
    private func finish(_ e: SocketEntry, notify: Bool, error: String?, pendingReason: String = "socket is closed") {
        if e.closed { return }
        teardown(e)
        if let call = e.pendingCall {
            e.pendingCall = nil
            rejectCall(call, pendingReason)
        }
        if notify {
            var payload: [String: Any] = ["id": e.id, "type": "close"]
            if let error = error {
                payload["error"] = error
            } else {
                payload["error"] = NSNull()
            }
            emit(payload)
        }
    }

    private func teardown(_ e: SocketEntry) {
        e.closed = true
        e.ready = false
        sockets.removeValue(forKey: e.id)
        if let conn = e.connection {
            conn.stateUpdateHandler = nil
            conn.cancel()
            e.connection = nil
        }
        if let source = e.readSource {
            // Close the fd only after the source has stopped reading it.
            let fd = e.fd
            source.setCancelHandler { sysClose(fd) }
            source.cancel()
            e.readSource = nil
        } else if e.fd >= 0 {
            sysClose(e.fd)
        }
        e.fd = -1
    }

    private func closeAll() {
        socketQueue.async {
            for e in Array(self.sockets.values) {
                self.finish(e, notify: false, error: nil)
            }
        }
    }

    // MARK: - Delivery (results and events go to the main queue, in order)

    private func resolveCall(_ call: CAPPluginCall, _ data: [String: Any] = [:]) {
        DispatchQueue.main.async {
            call.resolve(data)
        }
    }

    private func rejectCall(_ call: CAPPluginCall, _ message: String) {
        DispatchQueue.main.async {
            call.reject(message)
        }
    }

    private func emit(_ payload: [String: Any]) {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners("socketEvent", data: payload)
        }
    }
}
