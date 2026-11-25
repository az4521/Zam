// Megolm (m.megolm.v1.aes-sha2) decryption for the notification service
// extension, which cannot run the crypto WASM. It decrypts a room event with
// an inbound group session in the session-export format that the app mirrors
// into the App Group (RoomKeyStore), or that server-side key backup returns
// (m.megolm_backup.v1.curve25519-aes-sha2). Read-only: nothing here touches
// the app's crypto store.
//
// Formats follow the Matrix spec and libolm/vodozemac:
// - session export: 0x01 | u32 BE message index | 128-byte ratchet | Ed25519 key
// - message: 0x03 | protobuf (1: index varint, 2: ciphertext bytes) |
//   8-byte HMAC-SHA256 | 64-byte Ed25519 signature
import Foundation
import CryptoKit
import CommonCrypto

enum Megolm {
    struct DecryptError: Error {
        let reason: String
    }

    /// The parts of an exported inbound group session needed to decrypt.
    struct Session {
        let firstIndex: UInt32
        let ratchet: [UInt8]
        let signingKey: Curve25519.Signing.PublicKey

        /// `sessionKey` is the unpadded base64 session-export string.
        init(exportedKey sessionKey: String) throws {
            guard let raw = base64Data(sessionKey), raw.count == 1 + 4 + 128 + 32, raw[0] == 0x01 else {
                throw DecryptError(reason: "bad session key")
            }
            let bytes = [UInt8](raw)
            firstIndex = UInt32(bytes[1]) << 24 | UInt32(bytes[2]) << 16 | UInt32(bytes[3]) << 8 | UInt32(bytes[4])
            ratchet = Array(bytes[5..<133])
            do {
                signingKey = try Curve25519.Signing.PublicKey(rawRepresentation: Data(bytes[133..<165]))
            } catch {
                throw DecryptError(reason: "bad signing key")
            }
        }
    }

    /// Decrypts the `ciphertext` of an m.megolm.v1.aes-sha2 event content to
    /// the plaintext event JSON ({room_id, type, content}).
    static func decrypt(ciphertext: String, session: Session) throws -> [String: Any] {
        guard let raw = base64Data(ciphertext) else { throw DecryptError(reason: "bad ciphertext") }
        let message = [UInt8](raw)
        let macLength = 8
        let signatureLength = 64
        guard message.count > 1 + macLength + signatureLength, message[0] == 0x03 else {
            throw DecryptError(reason: "unsupported message version")
        }
        let signedEnd = message.count - signatureLength
        let macEnd = signedEnd
        let bodyEnd = macEnd - macLength

        let signature = Data(message[signedEnd...])
        guard session.signingKey.isValidSignature(signature, for: Data(message[0..<signedEnd])) else {
            throw DecryptError(reason: "bad signature")
        }

        let (index, cipher) = try parseBody(Array(message[1..<bodyEnd]))
        guard index >= session.firstIndex else {
            throw DecryptError(reason: "message index before the known session start")
        }
        let ratchet = advance(session.ratchet, from: session.firstIndex, to: index)

        let keys = HKDF<SHA256>.deriveKey(inputKeyMaterial: SymmetricKey(data: ratchet),
                                          salt: Data(),
                                          info: Data("MEGOLM_KEYS".utf8),
                                          outputByteCount: 80)
        let material = keys.withUnsafeBytes { [UInt8]($0) }
        let aesKey = Array(material[0..<32])
        let macKey = Array(material[32..<64])
        let iv = Array(material[64..<80])

        let mac = HMAC<SHA256>.authenticationCode(for: Data(message[0..<bodyEnd]), using: SymmetricKey(data: macKey))
        guard constantTimeEqual(Array(Array(mac).prefix(macLength)), Array(message[bodyEnd..<macEnd])) else {
            throw DecryptError(reason: "bad mac")
        }

        let plain = try aesCbcDecrypt(cipher, key: aesKey, iv: iv)
        guard let json = try? JSONSerialization.jsonObject(with: Data(plain)) as? [String: Any] else {
            throw DecryptError(reason: "plaintext is not JSON")
        }
        return json
    }

    /// The message index of an encrypted event, without decrypting it.
    static func messageIndex(ciphertext: String) -> UInt32? {
        guard let raw = base64Data(ciphertext) else { return nil }
        let message = [UInt8](raw)
        guard message.count > 1 + 8 + 64, message[0] == 0x03 else { return nil }
        return try? parseBody(Array(message[1..<(message.count - 72)])).0
    }

    // MARK: - Key backup (m.megolm_backup.v1.curve25519-aes-sha2)

    /// Decrypts one backed-up session's `session_data` with the backup's
    /// private key (raw 32 bytes) to the backed-up key JSON, whose
    /// `session_key` is in the session-export format.
    static func decryptBackup(sessionData: [String: Any], privateKey: Data) throws -> [String: Any] {
        guard let ephemeralText = sessionData["ephemeral"] as? String,
              let ciphertextText = sessionData["ciphertext"] as? String,
              let macText = sessionData["mac"] as? String,
              let ephemeral = base64Data(ephemeralText),
              let ciphertext = base64Data(ciphertextText),
              let mac = base64Data(macText) else {
            throw DecryptError(reason: "bad backup data")
        }
        let shared: SharedSecret
        do {
            let ours = try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: privateKey)
            let theirs = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: ephemeral)
            shared = try ours.sharedSecretFromKeyAgreement(with: theirs)
        } catch {
            throw DecryptError(reason: "bad backup key")
        }
        let keys = shared.hkdfDerivedSymmetricKey(using: SHA256.self, salt: Data(), sharedInfo: Data(), outputByteCount: 80)
        let material = keys.withUnsafeBytes { [UInt8]($0) }
        let aesKey = Array(material[0..<32])
        let macKey = Array(material[32..<64])
        let iv = Array(material[64..<80])
        // The spec's MAC covers an empty string (a libolm quirk every client keeps).
        let expected = HMAC<SHA256>.authenticationCode(for: Data(), using: SymmetricKey(data: macKey))
        guard constantTimeEqual(Array(Array(expected).prefix(8)), [UInt8](mac)) else {
            throw DecryptError(reason: "bad backup mac")
        }
        let plain = try aesCbcDecrypt([UInt8](ciphertext), key: aesKey, iv: iv)
        guard let json = try? JSONSerialization.jsonObject(with: Data(plain)) as? [String: Any] else {
            throw DecryptError(reason: "backup plaintext is not JSON")
        }
        return json
    }

    // MARK: - Ratchet

    /// HMAC-SHA256 keyed with part `from`, over the seed byte of part `to`.
    private static func rehash(_ data: inout [UInt8], from: Int, to: Int) {
        let key = SymmetricKey(data: data[(from * 32)..<(from * 32 + 32)])
        let out = HMAC<SHA256>.authenticationCode(for: Data([UInt8(to)]), using: key)
        data.replaceSubrange((to * 32)..<(to * 32 + 32), with: Array(out))
    }

    /// megolm_advance_to from libolm: moves the ratchet from `counter` to `target`.
    static func advance(_ start: [UInt8], from counter: UInt32, to target: UInt32) -> [UInt8] {
        var data = start
        var current = counter
        for j in 0..<4 {
            let shift = UInt32((4 - j - 1) * 8)
            let mask: UInt32 = shift >= 32 ? 0 : (~UInt32(0)) << shift
            var steps = Int(((target >> shift) &- (current >> shift)) & 0xff)
            if steps == 0 {
                if target < current {
                    steps = 0x100
                } else {
                    continue
                }
            }
            while steps > 1 {
                rehash(&data, from: j, to: j)
                steps -= 1
            }
            var k = 3
            while k >= j {
                rehash(&data, from: j, to: k)
                k -= 1
            }
            current = target & mask
        }
        return data
    }

    // MARK: - Helpers

    private static func parseBody(_ body: [UInt8]) throws -> (UInt32, [UInt8]) {
        var pos = 0
        var index: UInt32?
        var cipher: [UInt8]?
        func varint() throws -> UInt64 {
            var value: UInt64 = 0
            var shift: UInt64 = 0
            while pos < body.count {
                let byte = body[pos]
                pos += 1
                value |= UInt64(byte & 0x7f) << shift
                if byte & 0x80 == 0 { return value }
                shift += 7
                if shift > 63 { break }
            }
            throw DecryptError(reason: "bad varint")
        }
        while pos < body.count {
            let tag = try varint()
            switch tag {
            case 0x08:
                index = UInt32(truncatingIfNeeded: try varint())
            case 0x12:
                let length = Int(try varint())
                guard length >= 0, pos + length <= body.count else { throw DecryptError(reason: "bad length") }
                cipher = Array(body[pos..<(pos + length)])
                pos += length
            default:
                // Unknown field: skip by wire type.
                switch tag & 0x7 {
                case 0: _ = try varint()
                case 2:
                    let length = Int(try varint())
                    guard pos + length <= body.count else { throw DecryptError(reason: "bad length") }
                    pos += length
                default: throw DecryptError(reason: "bad field")
                }
            }
        }
        guard let i = index, let c = cipher else { throw DecryptError(reason: "missing fields") }
        return (i, c)
    }

    private static func aesCbcDecrypt(_ data: [UInt8], key: [UInt8], iv: [UInt8]) throws -> [UInt8] {
        var out = [UInt8](repeating: 0, count: data.count + kCCBlockSizeAES128)
        var outLength = 0
        let status = CCCrypt(CCOperation(kCCDecrypt), CCAlgorithm(kCCAlgorithmAES),
                             CCOptions(kCCOptionPKCS7Padding),
                             key, key.count, iv, data, data.count,
                             &out, out.count, &outLength)
        guard status == kCCSuccess else { throw DecryptError(reason: "aes failed") }
        return Array(out[0..<outLength])
    }

    private static func constantTimeEqual(_ a: [UInt8], _ b: [UInt8]) -> Bool {
        guard a.count == b.count else { return false }
        var diff: UInt8 = 0
        for i in 0..<a.count { diff |= a[i] ^ b[i] }
        return diff == 0
    }

    /// Standard or unpadded, URL-safe or not.
    static func base64Data(_ text: String) -> Data? {
        var s = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        return Data(base64Encoded: s)
    }
}
