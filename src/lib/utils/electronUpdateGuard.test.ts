import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import {
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
    existsSync,
} from "fs";
import { tmpdir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { createUpdateGuard, compareVersions } = require(
    join(__dirname, "../../../electron/updateGuard.cjs"),
);
const { createFileLog } = require(
    join(__dirname, "../../../electron/fileLog.cjs"),
);

let dir = "";
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "zam-guard-"));
});
afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

const marker = () => join(dir, "pending-install.json");
const state = () => join(dir, "update-state.json");

describe("compareVersions", () => {
    it("compares major.minor.patch numerically, ignoring a leading v", () => {
        expect(compareVersions("1.54.15", "1.54.2")).toBeGreaterThan(0);
        expect(compareVersions("v1.54.1", "1.54.1")).toBe(0);
        expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
    });
});

describe("update guard", () => {
    it("records a version as failed when the install never took", () => {
        // Launch 1 on 1.54.1 starts the install for 1.54.15 ...
        createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.1",
        }).beginInstall("1.54.15");
        expect(existsSync(marker())).toBe(true);
        // ... and launch 2 is still on 1.54.1.
        const next = createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.1",
        });
        expect(next.reconcile()).toEqual({ pendingFailed: true });
        expect(next.isFailed("1.54.15")).toBe(true);
        expect(next.isBlocked("1.54.15")).toBe(true);
        expect(existsSync(marker())).toBe(false);
    });

    it("clears the marker and records nothing when the update took", () => {
        createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.1",
        }).beginInstall("1.54.15");
        const next = createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.15",
        });
        expect(next.reconcile()).toEqual({ pendingFailed: false });
        expect(next.isFailed("1.54.15")).toBe(false);
        expect(existsSync(marker())).toBe(false);
    });

    it("keeps a failed version blocked across launches until a newer one runs", () => {
        writeFileSync(
            state(),
            JSON.stringify({ failedVersion: "1.54.15", failedAt: 1 }),
        );
        const still = createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.1",
        });
        still.reconcile();
        expect(still.isFailed("1.54.15")).toBe(true);
        expect(still.isFailed("1.54.16")).toBe(false);

        const later = createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.15",
        });
        later.reconcile();
        expect(later.failedVersion()).toBeNull();
        expect(
            JSON.parse(readFileSync(state(), "utf8")).failedVersion,
        ).toBeNull();
    });

    it("blocks an auto-apply of the version it already attempted this run", () => {
        const guard = createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.1",
        });
        expect(guard.isBlocked("1.54.15")).toBe(false);
        guard.beginInstall("1.54.15");
        expect(guard.isBlocked("1.54.15")).toBe(true);
        expect(guard.isBlocked("1.54.16")).toBe(false);
    });

    it("ignores a marker that names some other version", () => {
        writeFileSync(
            marker(),
            JSON.stringify({ toVersion: "2.0.0", fromVersion: "1.0.0", ts: 1 }),
        );
        const guard = createUpdateGuard({
            userDataDir: dir,
            currentVersion: "1.54.1",
        });
        expect(guard.reconcile()).toEqual({ pendingFailed: false });
        expect(guard.failedVersion()).toBeNull();
    });
});

describe("file log", () => {
    it("appends timestamped lines and truncates a file that grew past the cap", () => {
        const file = join(dir, "t.log");
        writeFileSync(file, "x".repeat(2000));
        const log = createFileLog(file, { maxBytes: 1000 });
        expect(readFileSync(file, "utf8")).toBe("");
        log.error("boom", new Error("bad"));
        log.info("ok");
        log.debug("quiet");
        const text = readFileSync(file, "utf8");
        expect(text).toMatch(/error boom Error: bad/);
        expect(text).toMatch(/info ok\n$/);
        expect(text).not.toContain("quiet");
    });
});
