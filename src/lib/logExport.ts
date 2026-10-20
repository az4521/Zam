// Builds the "client logs" export (Settings > Debug Info): a header saying
// which build, platform, device and crypto state the logs came from, then
// every line logCapture.ts has kept. The lines are redacted as captured; the
// header is redacted here.
import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "$lib/update";
import { getClient } from "$lib/matrix/client";
import {
    getCryptoInitError,
    getOwnDeviceKeyInfo,
    isCryptoAvailable,
} from "$lib/matrix/crypto";
import { getCapturedLogs, getDroppedLogCount, redact } from "$lib/logCapture";
import { saveObjectUrl, revokeLater } from "$lib/utils/saveFile";

function platformName(): string {
    if (Capacitor.isNativePlatform()) return Capacitor.getPlatform();
    if (typeof window !== "undefined" && window.desktop) return "electron";
    return "web";
}

/** Whether the server lists this device's keys, as other users would see. */
async function ownKeysOnServer(
    userId: string,
    deviceId: string,
): Promise<string> {
    const crypto = getClient()?.getCrypto();
    if (!crypto) return "n/a (no crypto)";
    try {
        const devices = await Promise.race([
            crypto.getUserDeviceInfo([userId], true),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("timed out")), 10_000),
            ),
        ]);
        const mine = devices.get(userId);
        if (!mine) return "user not in key query result";
        return mine.has(deviceId)
            ? `yes (${mine.size} device(s) listed)`
            : `NO: not among ${mine.size} listed device(s): ${[...mine.keys()].join(", ")}`;
    } catch (e) {
        return `query failed: ${e instanceof Error ? e.message : String(e)}`;
    }
}

export async function buildLogExport(): Promise<string> {
    const mx = getClient();
    const userId = mx?.getUserId() ?? null;
    const deviceId = mx?.getDeviceId() ?? null;
    const keys = await getOwnDeviceKeyInfo();
    const header = [
        "=== Zam client logs ===",
        `exported: ${new Date().toISOString()}`,
        `version: ${APP_VERSION}`,
        `platform: ${platformName()}`,
        `user agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "?"}`,
        `user: ${userId ?? "(not signed in)"}`,
        `homeserver: ${mx?.getHomeserverUrl() ?? "?"}`,
        `device id: ${deviceId ?? "?"}`,
        `sync state: ${mx?.getSyncState() ?? "?"}`,
        `crypto initialised: ${isCryptoAvailable()}`,
        `crypto init error: ${getCryptoInitError() ?? "none"}`,
        `device ed25519: ${keys?.ed25519 ?? "?"}`,
        `device curve25519: ${keys?.curve25519 ?? "?"}`,
        `own device keys on server: ${
            userId && deviceId ? await ownKeysOnServer(userId, deviceId) : "n/a"
        }`,
    ].map(redact);
    const dropped = getDroppedLogCount();
    const lines = getCapturedLogs();
    return [
        ...header,
        `log lines: ${lines.length}${dropped ? ` (${dropped} older lines dropped)` : ""}`,
        "",
        ...lines,
        "",
    ].join("\n");
}

export function logExportFilename(now = new Date()): string {
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    return `zam-logs-${stamp}.txt`;
}

/** Save the export as a .txt (Downloads on Android, a download on web). */
export async function saveLogExport(): Promise<void> {
    const text = await buildLogExport();
    const url = URL.createObjectURL(
        new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    try {
        await saveObjectUrl(url, logExportFilename());
    } finally {
        revokeLater(url);
    }
}
