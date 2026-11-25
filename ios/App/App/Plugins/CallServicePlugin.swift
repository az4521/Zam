import Foundation
import UIKit
import AVFoundation
import CallKit
import Capacitor

// iOS counterpart of android/app/src/main/java/moe/crafty/matrix/CallServicePlugin.java
// (with TelecomCalls.java). Contract: src/lib/nativeCall.ts.
//
// CallKit owns the system call UI (lock screen, headsets, car). WKWebView owns the
// WebRTC audio, so this plugin never activates or reconfigures the AVAudioSession
// for a call; it only reads the current route and overrides output/input ports.
// All state is touched on the main queue (the CXProvider delegate queue is main).

/// One call the web layer knows about, either ringing (incoming, unanswered) or in progress.
private final class CallRecord {
    let uuid: UUID
    let key: String
    let roomId: String
    let userId: String?
    let isIncoming: Bool
    var answered = false

    init(uuid: UUID, key: String, roomId: String, userId: String?, isIncoming: Bool) {
        self.uuid = uuid
        self.key = key
        self.roomId = roomId
        self.userId = userId
        self.isIncoming = isIncoming
    }

    /// An incoming ring nobody has answered yet: not a call in progress.
    var isRinging: Bool {
        return isIncoming && !answered
    }
}

@objc(CallServicePlugin)
public class CallServicePlugin: CAPPlugin, CAPBridgedPlugin, CXProviderDelegate {
    public let identifier = "CallServicePlugin"
    public let jsName = "CallService"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dismissIncomingCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "silenceIncomingCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reportIncomingCall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseLockScreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getAudioRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canUseFullScreenIntent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openFullScreenIntentSettings", returnType: CAPPluginReturnPromise),
    ]

    private var provider: CXProvider?
    private let callController = CXCallController()
    /// Calls by CallKit UUID, and the UUID of each call by "userId|roomId" key.
    private var callsByUUID: [UUID: CallRecord] = [:]
    private var callsByKey: [String: UUID] = [:]
    private var routeObserver: NSObjectProtocol?

    public override func load() {
        let configuration = CXProviderConfiguration(localizedName: "Zam")
        configuration.supportsVideo = true
        configuration.maximumCallsPerCallGroup = 1
        configuration.supportedHandleTypes = [.generic]
        configuration.includesCallsInRecents = false
        configuration.iconTemplateImageData = nil
        // Created at plugin load, not on first call, so that CallKit actions which
        // launch the app (answer from the lock screen) reach a live delegate.
        let newProvider = CXProvider(configuration: configuration)
        newProvider.setDelegate(self, queue: nil)
        self.provider = newProvider

        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.emitAudioRouteIfActive()
        }
    }

    deinit {
        if let observer = routeObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Plugin methods

    @objc func start(_ call: CAPPluginCall) {
        let roomId = call.getString("roomId") ?? ""
        let title = call.getString("title") ?? ""
        let userId = call.getString("userId")
        onMain {
            guard !roomId.isEmpty, self.provider != nil else {
                call.resolve()
                return
            }
            let key = self.callKey(roomId, userId)
            // Idempotent: a repeated start, or one for an answered ring, changes nothing.
            if self.callsByKey[key] != nil {
                call.resolve()
                return
            }
            // One call at a time. Our own calls that are not ringing are replaced;
            // a ring for another room stays with the system.
            self.endCalls { $0.key != key && !$0.isRinging }

            let uuid = UUID()
            self.register(CallRecord(uuid: uuid, key: key, roomId: roomId, userId: userId, isIncoming: false))
            let handleValue = title.isEmpty ? "Call" : title
            let action = CXStartCallAction(call: uuid, handle: CXHandle(type: .generic, value: handleValue))
            self.callController.request(CXTransaction(action: action)) { [weak self] error in
                guard let error = error else { return }
                self?.onMain {
                    self?.requestFailed(uuid, error)
                }
            }
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        onMain {
            // Our own end: the records go first, so the CXEndCallAction delegate
            // callback finds nothing and emits no hangUp back to the web layer.
            self.endCalls { !$0.isRinging }
            call.resolve()
        }
    }

    @objc func dismissIncomingCall(_ call: CAPPluginCall) {
        let roomId = call.getString("roomId") ?? ""
        let userId = call.getString("userId")
        let declined = call.getBool("declined") ?? false
        onMain {
            if !roomId.isEmpty {
                self.endRinging(
                    roomId: roomId,
                    userId: userId,
                    reason: declined ? .declinedElsewhere : .answeredElsewhere
                )
            }
            call.resolve()
        }
    }

    /// CallKit cannot silence a ring while keeping it for a headset, so this ends the
    /// system ring the same way dismiss does, without emitting an event.
    @objc func silenceIncomingCall(_ call: CAPPluginCall) {
        let roomId = call.getString("roomId") ?? ""
        let userId = call.getString("userId")
        onMain {
            if !roomId.isEmpty {
                self.endRinging(roomId: roomId, userId: userId, reason: .unanswered)
            }
            call.resolve()
        }
    }

    @objc func reportIncomingCall(_ call: CAPPluginCall) {
        let roomId = call.getString("roomId") ?? ""
        let trimmedName = (call.getString("callerName") ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let callerName = trimmedName.isEmpty ? "Someone" : trimmedName
        let userId = call.getString("userId")
        onMain {
            // Always resolve, whatever is skipped: a ring that is not shown must not fail the caller.
            defer { call.resolve() }
            guard !roomId.isEmpty, let provider = self.provider else { return }
            // The in-app card rings while the app is in front (Android skips the same way).
            if UIApplication.shared.applicationState == .active { return }
            if !self.ringEnabled() { return }
            let key = self.callKey(roomId, userId)
            if self.callsByKey[key] != nil { return }

            let uuid = UUID()
            self.register(CallRecord(uuid: uuid, key: key, roomId: roomId, userId: userId, isIncoming: true))
            let update = CXCallUpdate()
            update.remoteHandle = CXHandle(type: .generic, value: callerName)
            update.localizedCallerName = callerName
            update.hasVideo = false
            provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
                guard let error = error else { return }
                self?.onMain {
                    self?.requestFailed(uuid, error)
                }
            }
        }
    }

    @objc func releaseLockScreen(_ call: CAPPluginCall) {
        // Android-only: its lock-screen window flags have no iOS equivalent (CallKit owns the lock screen).
        call.resolve()
    }

    @objc func setAudioRoute(_ call: CAPPluginCall) {
        let route = call.getString("route") ?? ""
        onMain {
            let session = AVAudioSession.sharedInstance()
            do {
                switch route {
                case "speaker":
                    try session.overrideOutputAudioPort(.speaker)
                case "earpiece":
                    try session.overrideOutputAudioPort(.none)
                    try self.preferInput(session, types: [.builtInMic])
                case "bluetooth":
                    try session.overrideOutputAudioPort(.none)
                    try self.preferInput(session, types: [.bluetoothHFP])
                case "wired":
                    try session.overrideOutputAudioPort(.none)
                    try self.preferInput(session, types: [.headsetMic, .usbAudio])
                default:
                    break
                }
            } catch {
                self.log("setAudioRoute(\(route)) failed: \(error.localizedDescription)")
            }
            call.resolve()
        }
    }

    @objc func getAudioRoute(_ call: CAPPluginCall) {
        onMain {
            call.resolve(self.routeInfo())
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        // Android-only: Telecom hold. CallKit owns hold and resumes calls itself.
        call.resolve()
    }

    @objc func canUseFullScreenIntent(_ call: CAPPluginCall) {
        // No full-screen intent permission on iOS: CallKit always takes the lock screen.
        call.resolve(["granted": true])
    }

    @objc func openFullScreenIntentSettings(_ call: CAPPluginCall) {
        // Nothing to configure on iOS (see canUseFullScreenIntent).
        call.resolve()
    }

    // MARK: - CXProviderDelegate

    public func providerDidReset(_ provider: CXProvider) {
        // The system dropped every call. The web layer is not told: there is no
        // single call to attribute this to, and the calls are simply gone.
        log("provider reset")
        callsByUUID.removeAll()
        callsByKey.removeAll()
    }

    public func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        guard callsByUUID[action.callUUID] != nil else {
            action.fail()
            return
        }
        provider.reportOutgoingCall(with: action.callUUID, connectedAt: Date())
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let record = callsByUUID[action.callUUID] else {
            action.fail()
            return
        }
        if !record.answered {
            record.answered = true
            // retainUntilConsumed: the app may have been launched by this answer, and
            // the web layer has to pick it up once it starts listening.
            emit("answer", payload(record), retainUntilConsumed: true)
        }
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        guard let record = callsByUUID[action.callUUID] else {
            // Already removed: ended by stop/dismiss from our side, so no event back.
            action.fulfill()
            return
        }
        unregister(record)
        if record.isRinging {
            emit("decline", payload(record))
        } else {
            emit("hangUp", payload(record))
        }
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetHeldCallAction) {
        if callsByUUID[action.callUUID] != nil {
            emit("hold", ["held": action.isOnHold])
        }
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        if callsByUUID[action.callUUID] != nil {
            emit("systemMute", ["muted": action.isMuted])
        }
        action.fulfill()
    }

    public func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // WKWebView drives the WebRTC audio; do not reconfigure the session here.
        log("audio session activated")
    }

    public func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        log("audio session deactivated")
    }

    // MARK: - Call bookkeeping (main queue only)

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    private func callKey(_ roomId: String, _ userId: String?) -> String {
        return (userId ?? "") + "|" + roomId
    }

    private func register(_ record: CallRecord) {
        callsByUUID[record.uuid] = record
        callsByKey[record.key] = record.uuid
    }

    private func unregister(_ record: CallRecord) {
        callsByUUID[record.uuid] = nil
        if callsByKey[record.key] == record.uuid {
            callsByKey[record.key] = nil
        }
    }

    /// Ends the matching calls on the system side. Records are removed first, so the
    /// CXEndCallAction callbacks that follow emit nothing back to the web layer.
    private func endCalls(_ shouldEnd: (CallRecord) -> Bool) {
        let victims = callsByUUID.values.filter(shouldEnd)
        for record in victims {
            unregister(record)
            callController.request(CXTransaction(action: CXEndCallAction(call: record.uuid))) { _ in }
        }
    }

    /// Ends an unanswered ring for a room without emitting an event. Reports to CallKit
    /// directly, so no delegate callback comes back. Does nothing for answered calls.
    private func endRinging(roomId: String, userId: String?, reason: CXCallEndedReason) {
        let key = callKey(roomId, userId)
        guard let uuid = callsByKey[key],
              let record = callsByUUID[uuid],
              record.isRinging else { return }
        unregister(record)
        provider?.reportCall(with: uuid, endedAt: Date(), reason: reason)
    }

    private func requestFailed(_ uuid: UUID, _ error: Error) {
        log("CallKit request failed: \(error.localizedDescription)")
        if let record = callsByUUID[uuid] {
            unregister(record)
        }
    }

    private func payload(_ record: CallRecord) -> [String: Any] {
        return ["roomId": record.roomId, "userId": jsString(record.userId)]
    }

    private func jsString(_ value: String?) -> Any {
        if let value = value { return value }
        return NSNull()
    }

    private func emit(_ event: String, _ data: [String: Any], retainUntilConsumed: Bool = false) {
        notifyListeners(event, data: data, retainUntilConsumed: retainUntilConsumed)
    }

    /// Same meaning as the Android ringer flag: the web settings switch writes it
    /// through the app group, and "false" means no ring at all.
    private func ringEnabled() -> Bool {
        let value = AppGroup.defaults.object(forKey: "matrix_ring_enabled")
        if let text = value as? String, text == "false" { return false }
        if let flag = value as? Bool, !flag { return false }
        return true
    }

    // MARK: - Audio routes

    private func routeName(_ port: AVAudioSession.Port) -> String? {
        if port == .builtInReceiver { return "earpiece" }
        if port == .builtInSpeaker { return "speaker" }
        if port == .bluetoothA2DP || port == .bluetoothHFP || port == .bluetoothLE { return "bluetooth" }
        if port == .headphones || port == .usbAudio || port == .headsetMic { return "wired" }
        return nil
    }

    private func routeInfo() -> [String: Any] {
        let session = AVAudioSession.sharedInstance()
        var current: String? = nil
        for output in session.currentRoute.outputs {
            if let name = routeName(output.portType) {
                current = name
                break
            }
        }
        var routeValue: Any = NSNull()
        if let name = current {
            routeValue = name
        }

        // The earpiece exists only on iPhone; an iPad has the speaker alone.
        var available: [String] = []
        if UIDevice.current.userInterfaceIdiom == .pad {
            available = ["speaker"]
        } else {
            available = ["earpiece", "speaker"]
        }
        let inputs = session.availableInputs ?? []
        if inputs.contains(where: { $0.portType == .bluetoothHFP }) {
            available.append("bluetooth")
        }
        if inputs.contains(where: { $0.portType == .headsetMic || $0.portType == .usbAudio }) {
            available.append("wired")
        }
        return ["route": routeValue, "available": available]
    }

    /// Prefers the first available input of the given types. Does nothing when none is present.
    private func preferInput(_ session: AVAudioSession, types: [AVAudioSession.Port]) throws {
        let inputs = session.availableInputs ?? []
        guard let input = inputs.first(where: { types.contains($0.portType) }) else { return }
        try session.setPreferredInput(input)
    }

    private func emitAudioRouteIfActive() {
        // Only while a call is in progress, like Android (no route events while ringing).
        guard callsByUUID.values.contains(where: { !$0.isRinging }) else { return }
        notifyListeners("audioRoute", data: routeInfo())
    }

    private func log(_ message: String) {
        print("CallServicePlugin: \(message)")
    }
}
