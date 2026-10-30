// Makes the Ed25519 key pair that signs web bundles. The PUBLIC half goes in
// electron/bundleKey.cjs; the PRIVATE half goes in the ZAM_BUNDLE_SIGNING_KEY
// repository secret and nowhere else. Prints both, writes nothing.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
console.log(
    "public  (electron/bundleKey.cjs):\n" +
        publicKey.export({ format: "der", type: "spki" }).toString("base64"),
);
console.log(
    "\nprivate (secret ZAM_BUNDLE_SIGNING_KEY):\n" +
        privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
);
