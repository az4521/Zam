// Notification Service Extension. Turns a Sygnal event_id_only push into a
// notification: fetches the event and room through the homeserver, applies the
// same suppression rules as MatrixMessagingService.java, and attaches the
// sender's avatar (as a Communication notification) and unencrypted images.
// Encrypted events are decrypted with the room keys the app mirrors into the
// App Group (RoomKeyStore, Megolm.swift), falling back to server-side key
// backup; when neither has the key they show "Encrypted message".
import UserNotifications
import Intents
import Foundation

@objc(NotificationService)
final class NotificationService: UNNotificationServiceExtension {

    // Mirror of MAX_FUTURE_SKEW_MS / MAX_GRACE_MS in src/lib/utils/activeSession.ts,
    // MatrixMessagingService.java and static/sw.js. Keep all copies in step.
    static let MAX_FUTURE_SKEW_MS: Double = 300000
    static let MAX_GRACE_MS: Double = 7200000

    private static let activeSessionKey = "moe.crafty.matrix.active_session"
    private static let mentionsRulePrefix = "moe.crafty.matrix.e2ee_mentions."
    private static let budgetSeconds: Double = 20
    private static let retryDelayNanos: UInt64 = 1_500_000_000
    private static let maxMediaBytes = 10 * 1024 * 1024
    private static let fallbackTitle = "New message"
    private static let fallbackBody = "You have a new message"
    private static let encryptedBody = "Encrypted message"

    private let lock = NSLock()
    private var handler: ((UNNotificationContent) -> Void)?
    private var best: UNNotificationContent?
    private var finished = false
    private var budget: DispatchWorkItem?

    // MARK: - Lifecycle

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        // Generic content first, so a deadline hit before enrichment still
        // delivers something sensible.
        let placeholder = UNMutableNotificationContent()
        placeholder.title = Self.fallbackTitle
        placeholder.body = Self.fallbackBody
        placeholder.sound = .default
        if let room = Self.text(request.content.userInfo["room_id"]) {
            placeholder.userInfo = ["room_id": room]
        }

        lock.lock()
        handler = contentHandler
        best = placeholder
        lock.unlock()

        let item = DispatchWorkItem { [weak self] in
            self?.finish()
        }
        lock.lock()
        budget = item
        lock.unlock()
        DispatchQueue.global().asyncAfter(deadline: .now() + Self.budgetSeconds, execute: item)

        Task { [weak self] in
            await self?.process(request)
            self?.finish()
        }
    }

    override func serviceExtensionTimeWillExpire() {
        PushLog.append("push: extension time ran out, delivering the best content so far")
        finish()
    }

    /// Delivers the best content once; later calls are no-ops.
    private func finish() {
        lock.lock()
        if finished {
            lock.unlock()
            return
        }
        finished = true
        let deliver = handler
        let content: UNNotificationContent = best ?? UNMutableNotificationContent()
        let pending = budget
        handler = nil
        best = nil
        budget = nil
        lock.unlock()
        pending?.cancel()
        deliver?(content)
    }

    private func setBest(_ content: UNNotificationContent) {
        lock.lock()
        if !finished {
            best = content
        }
        lock.unlock()
    }

    // MARK: - Decision flow

    private struct Message {
        var title: String = "New message"
        var subtitle: String? = nil
        var body: String = "You have a new message"
        var roomName: String? = nil
        var isDM = false
        var mention = false
        var senderId: String? = nil
        var senderName: String? = nil
        var senderAvatar: Data? = nil
        var imageData: Data? = nil
    }

    private enum Outcome {
        case suppress(String)
        case invite(String, String)
        case call(Message)
        case message(Message)
    }

    private struct Invite {
        var inviterId = ""
        var inviterName = ""
        var inviterAvatar = ""
        var roomName = ""
        var roomAvatar = ""
        var isSpace = false
        var isDirect = false
    }

    private func process(_ request: UNNotificationRequest) async {
        let info = request.content.userInfo
        let roomId = Self.text(info["room_id"])
        let eventId = Self.text(info["event_id"])
        let tag = Self.text(info["zam_tag"])
        let legacy = Self.text(info["zam_account"])
        let unread: Int? = Self.intValue(info["unread_count"])
            ?? Self.intValue((info["counts"] as? [String: Any])?["unread"])
        let lp = "push room \(Self.short(roomId)) event \(Self.short(eventId)): "
        let unreadText = unread.map { String($0) } ?? "none"
        PushLog.append(lp + "start, unread " + unreadText + ", "
            + (tag != nil || legacy != nil ? "names an account" : "no account named"))

        let session = MatrixSession.resolve(tag: tag, legacyAccount: legacy)

        // Clear pushes: the room (or every room of the account) was read elsewhere.
        if unread == 0 {
            if let room = roomId {
                let removed = await removeDelivered(roomId: room, userId: session?.userId)
                PushLog.append(lp + "clear push (room read), \(removed) notification(s) removed")
            } else if let s = session {
                let removed = await removeDelivered(roomId: nil, userId: s.userId)
                PushLog.append(lp + "clear push (all rooms read), \(removed) message notification(s) removed")
            }
            setBest(UNMutableNotificationContent())
            return
        }

        // A push naming no room is a badge refresh, never a message.
        guard let room = roomId else {
            let removed = await removeReadRooms(session)
            PushLog.append(lp + "badge push (unread \(unreadText)), \(removed) read room notification(s) removed")
            setBest(UNMutableNotificationContent())
            return
        }

        if session == nil {
            PushLog.append(lp + "no signed-in session matches; generic notification")
        }

        if let s = session, await staysQuiet(s) {
            PushLog.append(lp + "skipped: another device is active")
            setBest(UNMutableNotificationContent())
            return
        }

        if let s = session {
            var readState = await isRoomReadElsewhere(s, room: room)
            if readState == nil {
                try? await Task.sleep(nanoseconds: Self.retryDelayNanos)
                readState = await isRoomReadElsewhere(s, room: room)
                if readState == nil {
                    PushLog.append(lp + "read check failed twice, notifying")
                }
            }
            if readState == true {
                PushLog.append(lp + "skipped: room already read (server count 0)")
                setBest(UNMutableNotificationContent())
                return
            }
        }

        let hideBody = Self.setting("matrix_hide_notification_body") == "true"
        let ringEnabled = Self.setting("matrix_ring_enabled") != "false"

        let outcome = await enrich(session, roomId: room, eventId: eventId,
                                   hideBody: hideBody, ringEnabled: ringEnabled, log: lp)

        switch outcome {
        case .suppress(let why):
            PushLog.append(lp + "skipped: " + why)
            setBest(UNMutableNotificationContent())

        case .invite(let title, let text):
            let c = UNMutableNotificationContent()
            c.title = title
            c.body = text
            c.sound = .default
            Self.decorate(c, category: "zam.invite", roomId: room, eventId: nil,
                          userId: session?.userId, unread: unread, timeSensitive: false)
            setBest(c)
            PushLog.append(lp + "posted invite")

        case .call(let m):
            let c = UNMutableNotificationContent()
            c.title = m.title
            c.body = m.body
            c.sound = .default
            Self.decorate(c, category: "zam.call", roomId: room, eventId: eventId,
                          userId: session?.userId, unread: unread, timeSensitive: true)
            setBest(c)
            PushLog.append(lp + "posted call")

        case .message(let m):
            if let s = session {
                let again = await isRoomReadElsewhere(s, room: room)
                if again == true {
                    PushLog.append(lp + "skipped: room read during enrichment")
                    setBest(UNMutableNotificationContent())
                    return
                }
            }
            let c = UNMutableNotificationContent()
            c.title = m.title
            if let sub = m.subtitle {
                c.subtitle = sub
            }
            c.body = m.body
            c.sound = .default
            if let image = m.imageData,
               let url = Self.writeTemp(image),
               let attachment = try? UNNotificationAttachment(identifier: "image", url: url, options: nil) {
                c.attachments = [attachment]
            }
            var final: UNMutableNotificationContent = c
            if #available(iOS 15.0, *), let s = session,
               let communication = Self.communication(c, m, roomId: room, userId: s.userId) {
                final = communication
            }
            Self.decorate(final, category: "zam.message", roomId: room, eventId: eventId,
                          userId: session?.userId, unread: unread, timeSensitive: m.mention)
            setBest(final)
            PushLog.append(lp + "posted message")
        }
    }

    // MARK: - Enrichment

    private func enrich(_ session: MatrixSession.Record?, roomId: String, eventId: String?,
                        hideBody: Bool, ringEnabled: Bool, log lp: String) async -> Outcome {
        var msg = Message()
        guard let s = session else { return .message(msg) }

        if let name = await roomName(s, roomId) {
            msg.title = name
            msg.roomName = name
        }
        guard let eventId = eventId else { return .message(msg) }

        var event = await fetchEvent(s, roomId, eventId)
        if event == nil {
            try? await Task.sleep(nanoseconds: Self.retryDelayNanos)
            event = await fetchEvent(s, roomId, eventId)
            PushLog.append(lp + "event fetch retry " + (event != nil ? "succeeded" : "failed"))
        }

        // An invite: the invitee usually cannot read the event, but the room's
        // stripped state says who invited us.
        let ownInvite = event.map { Self.isOwnInvite($0, userId: s.userId) } ?? false
        if event == nil || ownInvite, let invite = await fetchInvite(s, roomId) {
            PushLog.append(lp + "invite"
                + (invite.isSpace ? " to a space" : (invite.isDirect ? " to a DM" : "")))
            let text = Self.inviteText(invite)
            return .invite(text.title, text.text)
        }

        guard var ev = event else { return .message(msg) }

        // Read before decryption replaces the content: a thread relation
        // stays outside the encryption.
        let threadReply = Self.isThreadReply((ev["content"] as? [String: Any]) ?? [:])
        var decrypted = false
        if (ev["type"] as? String) == "m.room.encrypted",
           let clear = await decrypt(s, roomId: roomId, event: ev, log: lp) {
            ev["type"] = clear.type
            ev["content"] = clear.content
            decrypted = true
        }

        let sender = Self.text(ev["sender"]) ?? ""
        let type = (ev["type"] as? String) ?? ""
        let content = (ev["content"] as? [String: Any]) ?? [:]

        if type == "com.zam.call.kick" {
            return .suppress("moderator disconnect command")
        }

        let encrypted = type == "m.room.encrypted"
        // A mentions-only room gets every encrypted message pushed (via the
        // e2ee_mentions override), so notify only for a real mention.
        if encrypted || decrypted, await mentionsRuleEnabled(s, roomId) {
            if encrypted {
                return .suppress("undecryptable message in a mentions-only room")
            }
            var ownName: String? = nil
            if (content["m.mentions"] as? [String: Any]) == nil {
                ownName = await ownDisplayName(s, roomId, s.userId)
            }
            if !Self.isMention(content, userId: s.userId, displayName: ownName) {
                return .suppress("not a mention in a mentions-only room")
            }
        }

        var rawName = sender
        if !sender.isEmpty, let fetched = await userName(s, roomId, sender) {
            rawName = fetched
        }
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        let dm = await isDirect(s, roomId)
        msg.isDM = dm
        msg.senderId = sender
        msg.senderName = name.isEmpty ? sender : name
        if dm, !name.isEmpty {
            msg.title = name
        }
        if !dm, !name.isEmpty {
            msg.subtitle = name
        }
        if threadReply {
            msg.title += " \u{203A} Thread"
        }

        let isRtc = type == "org.matrix.msc4075.rtc.notification"
        let isCallType = isRtc
            || type == "org.matrix.msc4075.call.notify"
            || type == "m.call.notify"
        if isCallType {
            var wantsRing: Bool
            if isRtc {
                wantsRing = (content["notification_type"] as? String) == "ring"
                if wantsRing,
                   let sentTs = Self.number(content["sender_ts"]),
                   let lifetime = Self.number(content["lifetime"]) {
                    let ends = sentTs + min(lifetime, 120000)
                    if Self.nowMs() > ends {
                        wantsRing = false
                    }
                }
            } else {
                wantsRing = ((content["notify_type"] as? String) ?? "ring") == "ring"
            }
            // Only a DM rings like a phone call; a room call is a plain message.
            if wantsRing && dm {
                if ringEnabled {
                    var c = msg
                    c.isDM = true
                    c.title = name.isEmpty ? "Incoming call" : name
                    c.body = "Incoming call"
                    return .call(c)
                }
                msg.body = name.isEmpty ? "Incoming call" : "\(name) is calling"
            } else {
                msg.body = (dm || name.isEmpty) ? "A call started" : "\(name) started a call"
            }
            return .message(msg)
        }

        let body = (content["body"] as? String) ?? ""
        let msgtype = (content["msgtype"] as? String) ?? ""
        let isImage = !encrypted
            && (type == "m.sticker" || (type == "m.room.message" && msgtype == "m.image"))
        var preview = hideBody ? "" : body.trimmingCharacters(in: .whitespacesAndNewlines)
        if encrypted {
            preview = Self.encryptedBody
        }
        if isImage && !hideBody {
            if content["file"] == nil {
                msg.imageData = await unencryptedImage(s, content)
            }
            // The body of an image is its file name unless a caption was given.
            let fileName = (content["filename"] as? String) ?? ""
            let caption = !fileName.isEmpty && fileName != preview
            if !caption {
                preview = ""
            }
        }
        if preview.isEmpty {
            msg.body = (isImage && !hideBody) ? "Sent an image" : "Sent a message"
        } else {
            msg.body = preview
        }

        if !encrypted && !body.isEmpty {
            var ownName: String? = nil
            if (content["m.mentions"] as? [String: Any]) == nil {
                ownName = await ownDisplayName(s, roomId, s.userId)
            }
            msg.mention = Self.isMention(content, userId: s.userId, displayName: ownName)
        }

        if !sender.isEmpty, let senderMxc = await userAvatar(s, roomId, sender) {
            msg.senderAvatar = await thumbnail(s, senderMxc, size: 96, method: "crop")
        }
        return .message(msg)
    }

    // MARK: - Decryption

    /// Decrypts an m.megolm.v1.aes-sha2 event with the mirrored room key, or
    /// with the key from server-side key backup when the mirror has none (or
    /// only one that starts after this message). Nil when neither works.
    private func decrypt(_ s: MatrixSession.Record, roomId: String, event: [String: Any],
                         log lp: String) async -> (type: String, content: [String: Any])? {
        guard let wrapped = event["content"] as? [String: Any],
              (wrapped["algorithm"] as? String) == "m.megolm.v1.aes-sha2",
              let sessionId = wrapped["session_id"] as? String,
              let ciphertext = wrapped["ciphertext"] as? String else {
            PushLog.append(lp + "decrypt: unsupported algorithm")
            return nil
        }
        let index = Megolm.messageIndex(ciphertext: ciphertext)
        func usable(_ key: RoomKeyStore.Key?) -> RoomKeyStore.Key? {
            guard let key = key, let first = RoomKeyStore.firstIndex(key.sessionKey) else { return nil }
            if let index = index, index < first { return nil }
            return key
        }
        var source = "mirror"
        var key = usable(RoomKeyStore.key(userId: s.userId, roomId: roomId, sessionId: sessionId))
        if key == nil {
            key = usable(await backedUpKey(s, roomId: roomId, sessionId: sessionId, log: lp))
            source = "backup"
        }
        guard let found = key else {
            PushLog.append(lp + "decrypt: no key")
            return nil
        }
        do {
            let session = try Megolm.Session(exportedKey: found.sessionKey)
            let plain = try Megolm.decrypt(ciphertext: ciphertext, session: session)
            guard (plain["room_id"] as? String) == roomId,
                  let type = plain["type"] as? String,
                  let content = plain["content"] as? [String: Any] else {
                PushLog.append(lp + "decrypt: plaintext does not match the room")
                return nil
            }
            PushLog.append(lp + "decrypted (key from " + source + ")")
            return (type, content)
        } catch let error as Megolm.DecryptError {
            PushLog.append(lp + "decrypt failed: " + error.reason)
            return nil
        } catch {
            PushLog.append(lp + "decrypt failed")
            return nil
        }
    }

    /// One session from server-side key backup, decrypted with the backup key
    /// the app mirrored. Cached in the mirror for the next push.
    private func backedUpKey(_ s: MatrixSession.Record, roomId: String, sessionId: String,
                             log lp: String) async -> RoomKeyStore.Key? {
        guard let backup = RoomKeyStore.backupKey(userId: s.userId) else { return nil }
        let path = "/_matrix/client/v3/room_keys/keys/" + MatrixSession.enc(roomId) + "/"
            + MatrixSession.enc(sessionId) + "?version=" + MatrixSession.enc(backup.version)
        guard let obj = await getJSON(s, path),
              let data = obj["session_data"] as? [String: Any] else {
            PushLog.append(lp + "decrypt: key not in backup")
            return nil
        }
        guard let plain = try? Megolm.decryptBackup(sessionData: data, privateKey: backup.privateKey),
              let sessionKey = plain["session_key"] as? String else {
            PushLog.append(lp + "decrypt: backup data unreadable")
            return nil
        }
        let key = RoomKeyStore.Key(roomId: roomId, sessionId: sessionId, sessionKey: sessionKey,
                                   senderKey: plain["sender_key"] as? String)
        RoomKeyStore.store(key, userId: s.userId)
        return key
    }

    // MARK: - Homeserver queries

    private func getJSON(_ s: MatrixSession.Record, _ path: String) async -> [String: Any]? {
        guard let url = URL(string: s.homeserverUrl + path),
              let data = await MatrixSession.request("GET", url, token: s.accessToken,
                                                     body: nil, timeout: 6) else {
            return nil
        }
        return MatrixSession.jsonObject(data)
    }

    private func mediaGet(_ s: MatrixSession.Record, _ path: String) async -> Data? {
        guard let url = URL(string: s.homeserverUrl + path),
              let data = await MatrixSession.request("GET", url, token: s.accessToken,
                                                     body: nil, timeout: 6),
              !data.isEmpty, data.count <= Self.maxMediaBytes else {
            return nil
        }
        return data
    }

    private func roomName(_ s: MatrixSession.Record, _ roomId: String) async -> String? {
        let path = "/_matrix/client/v3/rooms/\(MatrixSession.enc(roomId))/state/m.room.name/"
        guard let obj = await getJSON(s, path), let name = obj["name"] as? String, !name.isEmpty else {
            return nil
        }
        return name
    }

    private func fetchEvent(_ s: MatrixSession.Record, _ roomId: String, _ eventId: String) async -> [String: Any]? {
        await getJSON(s, "/_matrix/client/v3/rooms/\(MatrixSession.enc(roomId))/event/\(MatrixSession.enc(eventId))")
    }

    private func memberState(_ s: MatrixSession.Record, _ roomId: String, _ userId: String) async -> [String: Any]? {
        await getJSON(s, "/_matrix/client/v3/rooms/\(MatrixSession.enc(roomId))/state/m.room.member/\(MatrixSession.enc(userId))")
    }

    /// A user's name in the room, else their global display name.
    private func userName(_ s: MatrixSession.Record, _ roomId: String, _ userId: String) async -> String? {
        if let member = await memberState(s, roomId, userId),
           let name = member["displayname"] as? String, !name.isEmpty {
            return name
        }
        if let profile = await getJSON(s, "/_matrix/client/v3/profile/\(MatrixSession.enc(userId))/displayname"),
           let name = profile["displayname"] as? String, !name.isEmpty {
            return name
        }
        return nil
    }

    /// A user's avatar mxc URI: per-room member state first, then the profile.
    private func userAvatar(_ s: MatrixSession.Record, _ roomId: String, _ userId: String) async -> String? {
        if let member = await memberState(s, roomId, userId),
           let mxc = member["avatar_url"] as? String, mxc.hasPrefix("mxc://") {
            return mxc
        }
        if let profile = await getJSON(s, "/_matrix/client/v3/profile/\(MatrixSession.enc(userId))/avatar_url"),
           let mxc = profile["avatar_url"] as? String, mxc.hasPrefix("mxc://") {
            return mxc
        }
        return nil
    }

    private func ownDisplayName(_ s: MatrixSession.Record, _ roomId: String, _ userId: String) async -> String? {
        guard let member = await memberState(s, roomId, userId) else { return nil }
        return member["displayname"] as? String
    }

    /// Whether the account's m.direct data lists this room (falls back to a
    /// member count when m.direct cannot be read).
    private func isDirect(_ s: MatrixSession.Record, _ roomId: String) async -> Bool {
        if let direct = await getJSON(s, "/_matrix/client/v3/user/\(MatrixSession.enc(s.userId))/account_data/m.direct") {
            var rooms: [String] = []
            for value in direct.values {
                if let list = value as? [String] {
                    rooms.append(contentsOf: list)
                }
            }
            return rooms.contains(roomId)
        }
        guard let members = await getJSON(s, "/_matrix/client/v3/rooms/\(MatrixSession.enc(roomId))/joined_members"),
              let joined = members["joined"] as? [String: Any] else {
            return false
        }
        return joined.count <= 2
    }

    /// True when the room has an enabled "mentions only" override for encrypted events.
    private func mentionsRuleEnabled(_ s: MatrixSession.Record, _ roomId: String) async -> Bool {
        let path = "/_matrix/client/v3/pushrules/global/override/" + MatrixSession.enc(Self.mentionsRulePrefix + roomId)
        guard let obj = await getJSON(s, path) else { return false }
        return (obj["enabled"] as? Bool) != false
    }

    /// Unread count for these rooms from one simplified sliding sync request.
    private func roomCounts(_ s: MatrixSession.Record, _ rooms: [String]) async -> [String: Int]? {
        var subscriptions: [String: Any] = [:]
        for room in rooms {
            subscriptions[room] = ["timeline_limit": 1, "required_state": [Any]()] as [String: Any]
        }
        let body: [String: Any] = ["conn_id": "zam-push-check", "room_subscriptions": subscriptions]
        guard let payload = try? JSONSerialization.data(withJSONObject: body),
              let url = URL(string: s.homeserverUrl + "/_matrix/client/unstable/org.matrix.simplified_msc3575/sync?timeout=0"),
              let data = await MatrixSession.request("POST", url, token: s.accessToken, body: payload, timeout: 6),
              let obj = MatrixSession.jsonObject(data),
              let roomsObj = obj["rooms"] as? [String: Any] else {
            return nil
        }
        var out: [String: Int] = [:]
        for room in rooms {
            guard let entry = roomsObj[room] as? [String: Any],
                  let notifications = Self.number(entry["notification_count"]),
                  let highlights = Self.number(entry["highlight_count"]) else {
                continue
            }
            out[room] = Int(max(notifications, highlights))
        }
        return out
    }

    /// Whether the room reads as 0 unread on the server. Nil when the request failed.
    private func isRoomReadElsewhere(_ s: MatrixSession.Record, room: String) async -> Bool? {
        guard let counts = await roomCounts(s, [room]), let unread = counts[room] else {
            return nil
        }
        return unread == 0
    }

    /// Mirror of the active-session check: stay quiet while another device of
    /// this account has a fresh heartbeat. Any doubt returns false (notify).
    private func staysQuiet(_ s: MatrixSession.Record) async -> Bool {
        guard let device = s.deviceId, !device.isEmpty else { return false }
        let path = "/_matrix/client/v3/user/\(MatrixSession.enc(s.userId))/account_data/\(MatrixSession.enc(Self.activeSessionKey))"
        guard let blob = await getJSON(s, path),
              let other = blob["deviceId"] as? String, !other.isEmpty,
              let tsNumber = blob["ts"] as? NSNumber,
              let graceNumber = blob["graceMs"] as? NSNumber else {
            return false
        }
        if other == device { return false }
        let ts = tsNumber.doubleValue
        let grace = graceNumber.doubleValue
        guard ts.isFinite, grace.isFinite, grace > 0 else { return false }
        if ts < 0 { return false }
        let now = Self.nowMs()
        if ts > now + Self.MAX_FUTURE_SKEW_MS { return false }
        return now - ts < min(grace, Self.MAX_GRACE_MS)
    }

    /// The pending invite for this account, from a one-room /sync with
    /// timeout=0 and set_presence=offline (same filter as the Android service).
    private func fetchInvite(_ s: MatrixSession.Record, _ roomId: String) async -> Invite? {
        let none: [String: Any] = ["not_types": ["*"]]
        var roomFilter: [String: Any] = [:]
        roomFilter["rooms"] = [roomId]
        roomFilter["timeline"] = ["limit": 0, "not_types": ["*"]] as [String: Any]
        roomFilter["state"] = none
        roomFilter["ephemeral"] = none
        roomFilter["account_data"] = none
        roomFilter["include_leave"] = false
        var filter: [String: Any] = [:]
        filter["room"] = roomFilter
        filter["presence"] = none
        filter["account_data"] = none
        guard let filterData = try? JSONSerialization.data(withJSONObject: filter),
              let filterJson = String(data: filterData, encoding: .utf8) else {
            return nil
        }
        guard let obj = await getJSON(s, "/_matrix/client/v3/sync?timeout=0&set_presence=offline&filter=" + MatrixSession.enc(filterJson)),
              let rooms = obj["rooms"] as? [String: Any],
              let invites = rooms["invite"] as? [String: Any],
              let invited = invites[roomId] as? [String: Any],
              let inviteState = invited["invite_state"] as? [String: Any],
              let events = inviteState["events"] as? [[String: Any]] else {
            return nil
        }

        var invite = Invite()
        var inviterEvent: [String: Any]? = nil
        var alias = ""
        var members: [String: [String: Any]] = [:]
        for e in events {
            let c = (e["content"] as? [String: Any]) ?? [:]
            let type = (e["type"] as? String) ?? ""
            if type == "m.room.member", let key = e["state_key"] as? String {
                members[key] = c
                if key == s.userId, (c["membership"] as? String) == "invite" {
                    inviterEvent = e
                }
            } else if type == "m.room.create" {
                invite.isSpace = (c["type"] as? String) == "m.space"
            } else if type == "m.room.name" {
                invite.roomName = Self.trimmed(c["name"])
            } else if type == "m.room.canonical_alias" {
                alias = Self.trimmed(c["alias"])
            } else if type == "m.room.avatar" {
                invite.roomAvatar = Self.trimmed(c["url"])
            }
        }
        guard let own = inviterEvent else { return nil }
        if invite.roomName.isEmpty {
            invite.roomName = alias
        }
        invite.inviterId = Self.trimmed(own["sender"])
        if let inviter = members[invite.inviterId] {
            invite.inviterName = Self.trimmed(inviter["displayname"])
            invite.inviterAvatar = Self.trimmed(inviter["avatar_url"])
        }
        invite.isDirect = ((own["content"] as? [String: Any])?["is_direct"] as? Bool) == true

        if !invite.inviterId.isEmpty, invite.inviterName.isEmpty || invite.inviterAvatar.isEmpty,
           let profile = await getJSON(s, "/_matrix/client/v3/profile/\(MatrixSession.enc(invite.inviterId))") {
            if invite.inviterName.isEmpty {
                invite.inviterName = Self.trimmed(profile["displayname"])
            }
            if invite.inviterAvatar.isEmpty {
                invite.inviterAvatar = Self.trimmed(profile["avatar_url"])
            }
        }
        return invite
    }

    /// An unencrypted m.image or m.sticker: the 800 px thumbnail, else the file.
    private func unencryptedImage(_ s: MatrixSession.Record, _ content: [String: Any]) async -> Data? {
        guard let mxc = content["url"] as? String, let parts = Self.mxcParts(mxc) else {
            return nil
        }
        let id = "\(MatrixSession.enc(parts.server))/\(MatrixSession.enc(parts.media))"
        if let thumb = await mediaGet(s, "/_matrix/client/v1/media/thumbnail/\(id)?width=800&height=800&method=scale&animated=false") {
            return thumb
        }
        return await mediaGet(s, "/_matrix/client/v1/media/download/\(id)")
    }

    private func thumbnail(_ s: MatrixSession.Record, _ mxc: String, size: Int, method: String) async -> Data? {
        guard let parts = Self.mxcParts(mxc) else { return nil }
        let id = "\(MatrixSession.enc(parts.server))/\(MatrixSession.enc(parts.media))"
        return await mediaGet(s, "/_matrix/client/v1/media/thumbnail/\(id)?width=\(size)&height=\(size)&method=\(method)")
    }

    // MARK: - Delivered notifications

    private func delivered() async -> [UNNotification] {
        await withCheckedContinuation { (continuation: CheckedContinuation<[UNNotification], Never>) in
            UNUserNotificationCenter.current().getDeliveredNotifications { items in
                continuation.resume(returning: items)
            }
        }
    }

    /// Removes this account's delivered notifications for a room (or, with no
    /// room, every message notification of the account). Returns the count.
    private func removeDelivered(roomId: String?, userId: String?) async -> Int {
        let items = await delivered()
        var ids: [String] = []
        for n in items {
            let info = n.request.content.userInfo
            guard let room = Self.text(info["room_id"]) else { continue }
            if let wanted = roomId, room != wanted { continue }
            if roomId == nil, n.request.content.categoryIdentifier != "zam.message" { continue }
            if let user = userId, Self.text(info["user_id"]) != user { continue }
            ids.append(n.request.identifier)
        }
        if !ids.isEmpty {
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
        }
        return ids.count
    }

    /// Badge-only push: removes notifications of rooms the server reports as read.
    private func removeReadRooms(_ session: MatrixSession.Record?) async -> Int {
        guard let s = session else { return 0 }
        let items = await delivered()
        var rooms: [String] = []
        for n in items {
            let info = n.request.content.userInfo
            guard Self.text(info["user_id"]) == s.userId,
                  let room = Self.text(info["room_id"]),
                  !rooms.contains(room) else {
                continue
            }
            rooms.append(room)
        }
        guard !rooms.isEmpty, let counts = await roomCounts(s, rooms) else { return 0 }
        let read = Set(rooms.filter { counts[$0] == 0 })
        var ids: [String] = []
        for n in items {
            let info = n.request.content.userInfo
            guard let room = Self.text(info["room_id"]), read.contains(room),
                  Self.text(info["user_id"]) == s.userId else {
                continue
            }
            ids.append(n.request.identifier)
        }
        if !ids.isEmpty {
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: ids)
        }
        return ids.count
    }

    // MARK: - Content

    /// Thread id, category, userInfo (room_id, event_id, user_id), badge and
    /// interruption level, shared by every notification this service posts.
    private static func decorate(_ c: UNMutableNotificationContent, category: String, roomId: String,
                                 eventId: String?, userId: String?, unread: Int?, timeSensitive: Bool) {
        c.categoryIdentifier = category
        c.threadIdentifier = "\(userId ?? "none")|\(roomId)"
        var info: [AnyHashable: Any] = ["room_id": roomId]
        if let event = eventId {
            info["event_id"] = event
        }
        if let user = userId {
            info["user_id"] = user
        }
        c.userInfo = info
        if let count = unread {
            c.badge = NSNumber(value: count)
        }
        if timeSensitive, #available(iOS 15.0, *) {
            c.interruptionLevel = .timeSensitive
        }
    }

    /// Donates an INSendMessageIntent for the message and returns the content
    /// updated from it (Communication notification), or nil when that fails.
    @available(iOS 15.0, *)
    private static func communication(_ base: UNMutableNotificationContent, _ m: Message,
                                      roomId: String, userId: String) -> UNMutableNotificationContent? {
        let name = m.senderName ?? m.senderId ?? "Someone"
        let image: INImage? = m.senderAvatar.map { INImage(imageData: $0) }
        let person = INPerson(personHandle: INPersonHandle(value: m.senderId ?? roomId, type: .unknown),
                              nameComponents: nil,
                              displayName: name,
                              image: image,
                              contactIdentifier: nil,
                              customIdentifier: m.senderId,
                              isMe: false,
                              suggestionType: .none)
        var group: INSpeakableString? = nil
        if !m.isDM, let roomName = m.roomName {
            group = INSpeakableString(spokenPhrase: roomName)
        }
        let intent = INSendMessageIntent(recipients: nil,
                                         outgoingMessageType: .outgoingMessageText,
                                         content: m.body,
                                         speakableGroupName: group,
                                         conversationIdentifier: roomId,
                                         serviceName: nil,
                                         sender: person)
        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate { _ in }
        do {
            let updated = try base.updating(from: intent)
            guard let mutable = updated.mutableCopy() as? UNMutableNotificationContent else {
                return nil
            }
            mutable.attachments = base.attachments
            return mutable
        } catch {
            return nil
        }
    }

    /// Writes image bytes to a temp file with an extension matching the magic bytes.
    private static func writeTemp(_ data: Data) -> URL? {
        let ext: String
        if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) {
            ext = "png"
        } else if data.starts(with: [0x47, 0x49, 0x46]) {
            ext = "gif"
        } else if data.count > 12, data.starts(with: [0x52, 0x49, 0x46, 0x46]),
                  data[8..<12].elementsEqual([0x57, 0x45, 0x42, 0x50]) {
            ext = "webp"
        } else {
            ext = "jpg"
        }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + "." + ext)
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }

    private static func inviteText(_ invite: Invite) -> (title: String, text: String) {
        let who = !invite.inviterName.isEmpty ? invite.inviterName
            : (!invite.inviterId.isEmpty ? invite.inviterId : "Someone")
        if invite.isSpace {
            let title = invite.roomName.isEmpty ? "Space invite" : invite.roomName
            return (title, "\(who) invited you to join this space")
        }
        if invite.isDirect || invite.roomName.isEmpty {
            let text = invite.isDirect ? "Invited you to a direct chat" : "Invited you to a room"
            return (who, text)
        }
        return (invite.roomName, "\(who) invited you to join this room")
    }

    /// Mirror of isMentionOfUser in src/lib/utils/encryptedMentions.ts.
    private static func isMention(_ content: [String: Any], userId: String, displayName: String?) -> Bool {
        if let mentions = content["m.mentions"] as? [String: Any] {
            if let ids = mentions["user_ids"] as? [String], ids.contains(userId) {
                return true
            }
            return (mentions["room"] as? Bool) == true
        }
        guard let body = content["body"] as? String, !body.isEmpty else { return false }
        var localpart = ""
        if userId.hasPrefix("@"), let colon = userId.firstIndex(of: ":") {
            let start = userId.index(after: userId.startIndex)
            if colon > start {
                localpart = String(userId[start..<colon])
            }
        }
        let words = [displayName ?? "", localpart, "@room"]
        for word in words where !word.isEmpty {
            if containsWord(body, word) {
                return true
            }
        }
        return false
    }

    private static func containsWord(_ body: String, _ word: String) -> Bool {
        let pattern = "(^|\\W)" + NSRegularExpression.escapedPattern(for: word) + "(\\W|$)"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else {
            return false
        }
        return regex.firstMatch(in: body, options: [], range: NSRange(body.startIndex..., in: body)) != nil
    }

    private static func isOwnInvite(_ event: [String: Any], userId: String) -> Bool {
        guard (event["type"] as? String) == "m.room.member",
              (event["state_key"] as? String) == userId,
              let content = event["content"] as? [String: Any] else {
            return false
        }
        return (content["membership"] as? String) == "invite"
    }

    private static func isThreadReply(_ content: [String: Any]) -> Bool {
        guard let relation = content["m.relates_to"] as? [String: Any] else { return false }
        return (relation["rel_type"] as? String) == "m.thread"
            && !((relation["event_id"] as? String) ?? "").isEmpty
    }

    // MARK: - Small helpers

    /// A non-empty string, or nil.
    private static func text(_ value: Any?) -> String? {
        guard let s = value as? String, !s.isEmpty else { return nil }
        return s
    }

    private static func trimmed(_ value: Any?) -> String {
        ((value as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func intValue(_ value: Any?) -> Int? {
        if let n = value as? NSNumber {
            return n.intValue
        }
        if let s = value as? String {
            return Int(s.trimmingCharacters(in: .whitespaces))
        }
        return nil
    }

    private static func number(_ value: Any?) -> Double? {
        if let n = value as? NSNumber {
            return n.doubleValue
        }
        return nil
    }

    private static func nowMs() -> Double {
        Date().timeIntervalSince1970 * 1000
    }

    /// A push setting as the web layer wrote it: a string, or a bool.
    private static func setting(_ key: String) -> String? {
        let defaults = AppGroup.defaults
        if let s = defaults.string(forKey: key) {
            return s
        }
        if let b = defaults.object(forKey: key) as? Bool {
            return b ? "true" : "false"
        }
        return nil
    }

    private static func mxcParts(_ mxc: String) -> (server: String, media: String)? {
        guard mxc.hasPrefix("mxc://") else { return nil }
        let rest = mxc.dropFirst("mxc://".count)
        guard let slash = rest.firstIndex(of: "/") else { return nil }
        let server = String(rest[rest.startIndex..<slash])
        let media = String(rest[rest.index(after: slash)...])
        guard !server.isEmpty, !media.isEmpty else { return nil }
        return (server, media)
    }

    private static func short(_ id: String?) -> String {
        guard let id = id else { return "none" }
        return String(id.prefix(6))
    }
}
