// Test vectors for the iOS Megolm decryptor, made by the real crypto WASM.
// usage: node gen-vectors.mjs <repo>  -> prints JSON (run.sh does this)
import { createRequire } from "node:module";

const repo = process.argv[2];
const require = createRequire(repo + "/package.json");
const wasm = require("@matrix-org/matrix-sdk-crypto-wasm");
await wasm.initAsync();
const {
    OlmMachine,
    UserId,
    DeviceId,
    RoomId,
    EncryptionSettings,
    BackupDecryptionKey,
} = wasm;

const room = new RoomId("!vectors:example.org");
const m = await OlmMachine.initialize(
    new UserId("@alice:example.org"),
    new DeviceId("ALICEDEV"),
);
const settings = new EncryptionSettings();
settings.rotationPeriodMessages = 1000n;
await m.shareRoomKey(room, [], settings);

const events = [];
for (let i = 0; i < 300; i++) {
    const content = { msgtype: "m.text", body: `message ${i} é\u{1F600}` };
    const enc = JSON.parse(
        await m.encryptRoomEvent(
            room,
            "m.room.message",
            JSON.stringify(content),
        ),
    );
    if (i === 0 || i === 1 || i === 2 || i === 255 || i === 256 || i === 299)
        events.push({ index: i, content: enc, plain: content });
}
const keys = JSON.parse(await m.exportRoomKeys(() => true));

const backupKey = BackupDecryptionKey.createRandomKey();
await m.enableBackupV1(backupKey.megolmV1PublicKey.publicKeyBase64, "1");
const req = await m.backupRoomKeys();
const body = JSON.parse(req.body);

console.log(
    JSON.stringify({
        roomId: room.toString(),
        exportedKey: keys[0],
        events,
        backup: {
            privateKeyBase64: backupKey.toBase64(),
            rooms: body.rooms,
        },
    }),
);
process.exit(0);
