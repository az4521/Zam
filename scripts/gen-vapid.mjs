// Convert a base64url VAPID private key (the raw 32-byte P-256 scalar that
// `npx web-push generate-vapid-keys` prints) into a PKCS#8 PEM for Sygnal.
//
//   node scripts/gen-vapid.mjs <base64url-private-key>
//
// Writes vapid_private_key.pem and prints the derived base64url PUBLIC key —
// verify that matches VITE_VAPID_PUBLIC_KEY / the fallback in webPush.ts.

import { createPrivateKey, createPublicKey } from "node:crypto";
import { writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) {
    console.error("Usage: node scripts/gen-vapid.mjs <base64url-private-key>");
    process.exit(1);
}

const b64urlToBuf = (s) =>
    Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const bufToB64url = (buf) =>
    buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

const d = b64urlToBuf(input);
if (d.length !== 32) {
    console.error(
        `Expected a 32-byte key, got ${d.length} bytes. Is this the raw VAPID private key?`,
    );
    process.exit(1);
}

// Wrap the raw scalar in a PKCS#8 DER for prime256v1, then let Node parse it.
// PKCS#8 prefix for an EC P-256 private key, followed by the 32-byte scalar.
const pkcs8Prefix = Buffer.from(
    "308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201" +
        "010420",
    "hex",
);
const der = Buffer.concat([pkcs8Prefix, d]);

const privateKey = createPrivateKey({
    key: der,
    format: "der",
    type: "pkcs8",
});

const pem = privateKey.export({ type: "pkcs8", format: "pem" });
writeFileSync("vapid_private_key.pem", pem);

// Derive the public key (uncompressed point) for verification.
const spki = createPublicKey(privateKey).export({ type: "spki", format: "der" });
const point = spki.subarray(spki.length - 65); // 0x04 || X(32) || Y(32)

console.log("Wrote vapid_private_key.pem");
console.log("Derived public key (should match VITE_VAPID_PUBLIC_KEY):");
console.log("  " + bufToB64url(point));
