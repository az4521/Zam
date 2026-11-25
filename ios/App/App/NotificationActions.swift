import Foundation
import UserNotifications
import Capacitor

/// Notification categories and the actions that run natively, the iOS
/// counterpart of MessageActionReceiver.java. Mark-as-read and invite decline
/// are plain authenticated requests and run without opening the app; reply,
/// accept-invite and join-call need the web client (E2EE, the call stack), so
/// they open the app and reach JS through @capacitor/push-notifications'
/// pushNotificationActionPerformed (actionId + inputValue), see push.ts.
///
/// Capacitor installs its NotificationRouter as the notification-center
/// delegate; this wraps it and forwards everything it doesn't handle.
final class NotificationActions: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationActions()

    static let messageCategory = "zam.message"
    static let inviteCategory = "zam.invite"
    static let callCategory = "zam.call"

    static let reply = "zam.reply"
    static let markRead = "zam.mark_read"
    static let inviteAccept = "zam.invite_accept"
    static let inviteDecline = "zam.invite_decline"
    static let callJoin = "zam.call_join"
    static let callDecline = "zam.call_decline"

    // Strong: the router lives as long as the bridge anyway.
    private var next: UNUserNotificationCenterDelegate?

    static func install() {
        let center = UNUserNotificationCenter.current()
        if center.delegate !== shared {
            shared.next = center.delegate
            center.delegate = shared
        }
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: messageCategory,
                actions: [
                    UNTextInputNotificationAction(
                        identifier: reply,
                        title: "Reply",
                        options: [.foreground],
                        textInputButtonTitle: "Send",
                        textInputPlaceholder: "Message"
                    ),
                    UNNotificationAction(identifier: markRead, title: "Mark as read", options: []),
                ],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: inviteCategory,
                actions: [
                    UNNotificationAction(identifier: inviteAccept, title: "Accept", options: [.foreground]),
                    UNNotificationAction(identifier: inviteDecline, title: "Decline", options: [.destructive]),
                ],
                intentIdentifiers: [],
                options: []
            ),
            UNNotificationCategory(
                identifier: callCategory,
                actions: [
                    UNNotificationAction(identifier: callJoin, title: "Join", options: [.foreground]),
                    UNNotificationAction(identifier: callDecline, title: "Dismiss", options: [.destructive]),
                ],
                intentIdentifiers: [],
                options: []
            ),
        ])
    }

    // MARK: UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Like Android: no banner for the account already open in front.
        let info = notification.request.content.userInfo
        if let userId = info["user_id"] as? String,
           userId == Self.activeUserId() {
            completionHandler([])
            return
        }
        if let next = next,
           next.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:))) {
            next.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([.banner, .list, .sound, .badge])
        }
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let info = response.notification.request.content.userInfo
        let roomId = info["room_id"] as? String
        let userId = info["user_id"] as? String
        let eventId = info["event_id"] as? String
        let threadId = response.notification.request.content.threadIdentifier

        switch response.actionIdentifier {
        case Self.markRead:
            Self.removeDelivered(threadId: threadId)
            Task {
                await Self.markRead(roomId: roomId, userId: userId, eventId: eventId)
                completionHandler()
            }
            return
        case Self.inviteDecline:
            Self.removeDelivered(threadId: threadId)
            Task {
                await Self.declineInvite(roomId: roomId, userId: userId)
                completionHandler()
            }
            return
        case Self.callDecline:
            Self.removeDelivered(threadId: threadId)
            completionHandler()
            return
        default:
            break
        }
        if let next = next,
           next.responds(to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:))) {
            next.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
        } else {
            completionHandler()
        }
    }

    // MARK: native actions

    private static func removeDelivered(threadId: String) {
        guard !threadId.isEmpty else { return }
        let center = UNUserNotificationCenter.current()
        center.getDeliveredNotifications { list in
            let ids = list
                .filter { $0.request.content.threadIdentifier == threadId }
                .map { $0.request.identifier }
            center.removeDeliveredNotifications(withIdentifiers: ids)
        }
    }

    /// The account the app has open (matrix_session_record), if any.
    private static func activeUserId() -> String? {
        guard let raw = AppGroup.defaults.string(forKey: "matrix_session_record"),
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return obj["userId"] as? String
    }

    private static func markRead(roomId: String?, userId: String?, eventId: String?) async {
        guard let roomId = roomId, let userId = userId,
              let session = MatrixSession.resolve(userId: userId),
              session.userId == userId
        else { return }
        let base = session.homeserverUrl + "/_matrix/client/v3/rooms/" + MatrixSession.enc(roomId)

        var target = eventId ?? ""
        if target.isEmpty {
            guard let url = URL(string: base + "/messages?dir=b&limit=1"),
                  let data = await MatrixSession.request("GET", url, token: session.accessToken, body: nil, timeout: 8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let chunk = obj["chunk"] as? [[String: Any]],
                  let first = chunk.first?["event_id"] as? String
            else { return }
            target = first
        }
        let receipt = receiptsPrivate(userId: userId, roomId: roomId) ? "m.read.private" : "m.read"
        guard let url = URL(string: base + "/read_markers"),
              let body = try? JSONSerialization.data(withJSONObject: ["m.fully_read": target, receipt: target])
        else { return }
        _ = await MatrixSession.request("POST", url, token: session.accessToken, body: body, timeout: 8)
        PushLog.append("room \(String(roomId.prefix(8))) marked read from notification")
    }

    /// Port of MessageActionReceiver.receiptsPrivate: private unless the
    /// stored setting for this account says otherwise.
    private static func receiptsPrivate(userId: String, roomId: String) -> Bool {
        guard let raw = AppGroup.defaults.string(forKey: "matrix_receipt_privacy"),
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              (obj["userId"] as? String) == userId
        else { return true }
        if let rooms = obj["rooms"] as? [String: Any], let roomPriv = rooms[roomId] as? Bool {
            return roomPriv
        }
        return (obj["private"] as? Bool) ?? true
    }

    private static func declineInvite(roomId: String?, userId: String?) async {
        guard let roomId = roomId, let userId = userId,
              let session = MatrixSession.resolve(userId: userId),
              session.userId == userId,
              let url = URL(string: session.homeserverUrl + "/_matrix/client/v3/rooms/"
                  + MatrixSession.enc(roomId) + "/leave")
        else { return }
        let ok = await MatrixSession.request(
            "POST", url, token: session.accessToken, body: Data("{}".utf8), timeout: 8
        ) != nil
        PushLog.append("invite to room \(String(roomId.prefix(8)))" + (ok ? " declined" : " decline failed"))
        if ok { recordDecline(userId: userId, roomId: roomId) }
    }

    /// Same list MessageActionReceiver.recordDecline keeps; the web layer
    /// (declinedInvites.ts) reads it through @capacitor/preferences, which
    /// stores under UserDefaults.standard with the "CapacitorStorage." prefix.
    private static func recordDecline(userId: String, roomId: String) {
        let key = "CapacitorStorage.moe.crafty.matrix.declined_invites"
        let defaults = UserDefaults.standard
        var list: [[String: Any]] = []
        if let raw = defaults.string(forKey: key),
           let data = raw.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            list = arr
        }
        list = list.suffix(49).filter {
            !(($0["roomId"] as? String) == roomId && ($0["userId"] as? String) == userId)
        }
        list.append([
            "userId": userId,
            "roomId": roomId,
            "ts": Int64(Date().timeIntervalSince1970 * 1000),
        ])
        if let data = try? JSONSerialization.data(withJSONObject: list),
           let text = String(data: data, encoding: .utf8) {
            defaults.set(text, forKey: key)
        }
    }
}
