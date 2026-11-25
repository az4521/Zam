import Foundation

let path = CommandLine.arguments[1]
let d = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: path))) as! [String: Any]
let roomId = d["roomId"] as! String
let key = d["exportedKey"] as! [String: Any]
var failures = 0

func check(_ name: String, _ ok: Bool) {
    print((ok ? "PASS " : "FAIL ") + name)
    if !ok { failures += 1 }
}

let session = try Megolm.Session(exportedKey: key["session_key"] as! String)
for e in d["events"] as! [[String: Any]] {
    let content = e["content"] as! [String: Any]
    let plain = e["plain"] as! [String: Any]
    let ct = content["ciphertext"] as! String
    let idx = e["index"] as! Int
    do {
        let out = try Megolm.decrypt(ciphertext: ct, session: session)
        let body = (out["content"] as? [String: Any])?["body"] as? String
        check("event \(idx) decrypts", body == plain["body"] as? String
              && out["room_id"] as? String == roomId && out["type"] as? String == "m.room.message")
        check("event \(idx) index", Megolm.messageIndex(ciphertext: ct) == UInt32(idx))
    } catch {
        check("event \(idx) decrypts (\(error))", false)
    }
}

// Tampering must fail.
let first = (d["events"] as! [[String: Any]])[3]
var tampered = Megolm.base64Data((first["content"] as! [String: Any])["ciphertext"] as! String)!
tampered[10] ^= 0x01
do {
    _ = try Megolm.decrypt(ciphertext: tampered.base64EncodedString(), session: session)
    check("tampered message rejected", false)
} catch {
    check("tampered message rejected", true)
}

// A session exported from a later index cannot decrypt earlier messages,
// and one advanced to index 256 decrypts 256 and 299.
let later = Megolm.advance(session.ratchet, from: 0, to: 256)
var exported = Data([0x01, 0, 0, 1, 0])
exported.append(contentsOf: later)
exported.append(session.signingKey.rawRepresentation)
let laterSession = try Megolm.Session(exportedKey: exported.base64EncodedString())
for e in d["events"] as! [[String: Any]] {
    let idx = e["index"] as! Int
    let ct = (e["content"] as! [String: Any])["ciphertext"] as! String
    let ok = (try? Megolm.decrypt(ciphertext: ct, session: laterSession)) != nil
    check("later session, event \(idx) \(idx >= 256 ? "decrypts" : "refused")", ok == (idx >= 256))
}

// Key backup.
let backup = d["backup"] as! [String: Any]
let priv = Megolm.base64Data(backup["privateKeyBase64"] as! String)!
let rooms = backup["rooms"] as! [String: Any]
let sessions = (rooms[roomId] as! [String: Any])["sessions"] as! [String: Any]
let backed = sessions[key["session_id"] as! String] as! [String: Any]
do {
    let restored = try Megolm.decryptBackup(sessionData: backed["session_data"] as! [String: Any], privateKey: priv)
    check("backup decrypts", restored["session_key"] is String)
    let fromBackup = try Megolm.Session(exportedKey: restored["session_key"] as! String)
    let e = (d["events"] as! [[String: Any]])[5]
    let out = try Megolm.decrypt(ciphertext: (e["content"] as! [String: Any])["ciphertext"] as! String, session: fromBackup)
    check("event via backup key", ((out["content"] as? [String: Any])?["body"] as? String) == ((e["plain"] as! [String: Any])["body"] as? String))
} catch {
    check("backup (\(error))", false)
}
var wrong = priv
wrong[5] ^= 0x10
check("wrong backup key rejected", (try? Megolm.decryptBackup(sessionData: backed["session_data"] as! [String: Any], privateKey: wrong)) == nil)

print(failures == 0 ? "ALL PASSED" : "\(failures) FAILED")
exit(failures == 0 ? 0 : 1)
