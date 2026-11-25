#!/usr/bin/env node
// Writes the AltStore / SideStore source (altstore/source.json on the Pages
// site) for one iOS release. AltStore checks the listed entitlements and
// privacy strings against the IPA, so both are read from the same files the
// Xcode project builds with (Info.plist + every target's .entitlements).
//
// Usage:
//   node scripts/gen-altstore-source.mjs --version 1.2.3 --build 456 \
//     --ipa-url https://.../Zam-1.2.3.ipa --size 12345678 \
//     --base https://owner.github.io/repo [--notes release-body.md] \
//     --out site/altstore/source.json
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

function args() {
    const out = {};
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 2) {
        if (!argv[i].startsWith("--")) throw new Error(`bad arg ${argv[i]}`);
        out[argv[i].slice(2)] = argv[i + 1];
    }
    for (const k of ["version", "build", "ipa-url", "size", "base", "out"])
        if (!out[k]) throw new Error(`missing --${k}`);
    return out;
}

/** Top-level <key>/<string> pairs whose key ends in UsageDescription. */
function privacyStrings(plist) {
    const out = {};
    const re =
        /<key>(NS\w+UsageDescription)<\/key>\s*<string>([^<]*)<\/string>/g;
    for (const m of plist.matchAll(re)) out[m[1]] = unescapeXml(m[2]);
    return out;
}

function entitlementKeys(plist) {
    return [...plist.matchAll(/<key>([^<]+)<\/key>/g)].map((m) => m[1]);
}

function unescapeXml(s) {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

const a = args();
const ios = join(root, "ios/App");
const infoPlist = readFileSync(join(ios, "App/Info.plist"), "utf8");
const entitlements = new Set();
for (const f of [
    "App/App.entitlements",
    "NotificationService/NotificationService.entitlements",
    "ShareExtension/ShareExtension.entitlements",
]) {
    for (const k of entitlementKeys(readFileSync(join(ios, f), "utf8")))
        entitlements.add(k);
}

const notes = a.notes
    ? readFileSync(a.notes, "utf8").trim()
    : `Zam ${a.version}`;
const base = a.base.replace(/\/+$/, "");
const tint = "#ADBEEF";
const description =
    "Zam is a Matrix chat client with spaces, voice and video calls and " +
    "end-to-end encryption.";

const source = {
    name: "Zam",
    identifier: "moe.crafty.matrix.altstore",
    subtitle: "Zam for iOS",
    description,
    iconURL: `${base}/altstore/icon.png`,
    website: base,
    tintColor: tint,
    apps: [
        {
            name: "Zam",
            bundleIdentifier: "moe.crafty.matrix",
            developerName: "Zam",
            subtitle: "A Matrix chat client",
            localizedDescription: description,
            iconURL: `${base}/altstore/icon.png`,
            tintColor: tint,
            category: "social",
            screenshots: [],
            versions: [
                {
                    version: a.version,
                    buildVersion: String(a.build),
                    date: new Date().toISOString(),
                    localizedDescription: notes,
                    downloadURL: a["ipa-url"],
                    size: Number(a.size),
                    minOSVersion: "15.0",
                },
            ],
            appPermissions: {
                entitlements: [...entitlements].sort(),
                privacy: privacyStrings(infoPlist),
            },
        },
    ],
    news: [],
};

mkdirSync(dirname(a.out), { recursive: true });
writeFileSync(a.out, JSON.stringify(source, null, 2) + "\n");
console.log(`altstore source for ${a.version} written to ${a.out}`);
