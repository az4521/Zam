import { describe, it, expect } from "vitest";
import {
    restoreProgressView,
    restoreResultLabel,
    backupBadge,
    backupSummaryLabel,
    backupDetailLines,
    secretStorageKeyLabel,
    type BackupStatusModel,
} from "./keyBackup";

describe("restoreProgressView", () => {
    it("returns an indeterminate 'preparing' view for null progress", () => {
        expect(restoreProgressView(null)).toEqual({
            label: "Preparing…",
            percent: null,
        });
    });

    it("is indeterminate during the fetch stage", () => {
        const view = restoreProgressView({ stage: "fetch" });
        expect(view.percent).toBeNull();
        expect(view.label).toMatch(/fetch/i);
    });

    it("reports percent and a count label during load_keys", () => {
        const view = restoreProgressView({
            stage: "load_keys",
            successes: 30,
            failures: 0,
            total: 120,
        });
        expect(view.percent).toBe(25);
        expect(view.label).toContain("30");
        expect(view.label).toContain("120");
    });

    it("bases percent on processed keys (successes + failures), rounded", () => {
        // 33 of 100 processed → 33%.
        const view = restoreProgressView({
            stage: "load_keys",
            successes: 30,
            failures: 3,
            total: 100,
        });
        expect(view.percent).toBe(33);
        // The count label surfaces the successfully-restored keys.
        expect(view.label).toContain("30");
    });

    it("clamps percent to 0–100 and never divides by zero", () => {
        expect(
            restoreProgressView({
                stage: "load_keys",
                successes: 0,
                failures: 0,
                total: 0,
            }).percent,
        ).toBeNull();
        expect(
            restoreProgressView({
                stage: "load_keys",
                successes: 150,
                failures: 0,
                total: 100,
            }).percent,
        ).toBe(100);
    });
});

describe("restoreResultLabel", () => {
    it("reports nothing to restore when the backup is empty", () => {
        expect(restoreResultLabel({ total: 0, imported: 0 })).toMatch(/no/i);
    });

    it("reports a full restore with a pluralised key count", () => {
        expect(restoreResultLabel({ total: 340, imported: 340 })).toBe(
            "340 keys restored",
        );
    });

    it("uses the singular for exactly one key", () => {
        expect(restoreResultLabel({ total: 1, imported: 1 })).toBe(
            "1 key restored",
        );
    });

    it("surfaces a partial restore as 'imported of total'", () => {
        expect(restoreResultLabel({ total: 340, imported: 12 })).toBe(
            "12 of 340 keys restored",
        );
    });
});

describe("backupBadge", () => {
    const base: BackupStatusModel = {
        exists: true,
        active: true,
        trusted: true,
        version: "3",
    };

    it("is inactive when no backup exists", () => {
        expect(backupBadge({ ...base, exists: false })).toEqual({
            label: "Not set up",
            tone: "inactive",
        });
    });

    it("warns when a backup exists but is not trusted", () => {
        expect(backupBadge({ ...base, trusted: false })).toEqual({
            label: "Not trusted",
            tone: "warning",
        });
    });

    it("is active when the backup exists, is trusted, and this session is connected", () => {
        expect(backupBadge(base)).toEqual({ label: "On", tone: "active" });
    });

    it("warns when trusted but this session is not connected to the backup", () => {
        expect(backupBadge({ ...base, active: false })).toEqual({
            label: "Not connected",
            tone: "warning",
        });
    });
});

describe("backupSummaryLabel", () => {
    const base: BackupStatusModel = {
        exists: true,
        active: true,
        trusted: true,
        version: "3",
    };

    it("prompts to set up when there is no backup", () => {
        expect(backupSummaryLabel({ ...base, exists: false })).toMatch(
            /set up recovery/i,
        );
    });

    it("includes the version when actively backing up", () => {
        expect(backupSummaryLabel(base)).toContain("v3");
        expect(backupSummaryLabel(base)).toMatch(/backed up/i);
    });

    it("omits the version gracefully when unknown", () => {
        const label = backupSummaryLabel({ ...base, version: null });
        expect(label).toMatch(/backed up/i);
        expect(label).not.toContain("v");
    });

    it("explains an untrusted backup", () => {
        expect(backupSummaryLabel({ ...base, trusted: false })).toMatch(
            /not trusted|isn't trusted/i,
        );
    });

    it("prompts to enter the recovery key when trusted but disconnected", () => {
        expect(backupSummaryLabel({ ...base, active: false })).toMatch(
            /recovery key/i,
        );
    });
});

describe("backupDetailLines", () => {
    const base = {
        exists: true,
        active: true,
        matchesDecryptionKey: true,
        count: null as number | null,
        sessionsRemaining: null as number | null,
    };

    it("returns nothing when there is no backup at all", () => {
        expect(
            backupDetailLines({ ...base, exists: false, count: 12 }),
        ).toEqual([]);
    });

    it("returns nothing when a backup exists but there's nothing to report yet", () => {
        expect(
            backupDetailLines({
                exists: true,
                active: true,
                matchesDecryptionKey: true,
                count: null,
                sessionsRemaining: null,
            }),
        ).toEqual([]);
    });

    it("reports the server-side key count", () => {
        expect(backupDetailLines({ ...base, count: 12 })).toContain(
            "12 keys backed up",
        );
    });

    it("singularises a count of one", () => {
        expect(backupDetailLines({ ...base, count: 1 })).toContain(
            "1 key backed up",
        );
    });

    it("says so when the backup is empty", () => {
        expect(backupDetailLines({ ...base, count: 0 })).toContain(
            "No keys backed up yet",
        );
    });

    it("omits the count line when the server didn't report one", () => {
        expect(
            backupDetailLines({ ...base, count: null, sessionsRemaining: 2 }),
        ).toEqual(["2 keys still to upload"]);
    });

    it("reports keys still queued for upload", () => {
        expect(
            backupDetailLines({ ...base, count: 5, sessionsRemaining: 3 }),
        ).toContain("3 keys still to upload");
    });

    it("singularises one remaining key", () => {
        expect(
            backupDetailLines({ ...base, count: 5, sessionsRemaining: 1 }),
        ).toContain("1 key still to upload");
    });

    it("confirms when nothing is left to upload", () => {
        expect(
            backupDetailLines({ ...base, count: 5, sessionsRemaining: 0 }),
        ).toContain("Everything on this session is backed up");
    });

    it("omits the upload queue entirely when this session isn't backing up", () => {
        // A stale zero must not claim "everything is backed up" under a summary
        // line saying this session isn't connected to the backup.
        expect(
            backupDetailLines({
                ...base,
                active: false,
                count: 5,
                sessionsRemaining: 0,
            }),
        ).toEqual(["5 keys backed up"]);
    });

    it("orders count before remaining", () => {
        expect(
            backupDetailLines({
                exists: true,
                active: true,
                matchesDecryptionKey: false,
                count: 2,
                sessionsRemaining: 4,
            }),
        ).toEqual(["2 keys backed up", "4 keys still to upload"]);
    });
});

describe("secretStorageKeyLabel", () => {
    it("reports when no default key is set", () => {
        expect(secretStorageKeyLabel(null)).toBe("Not set");
    });

    it("shortens a long key id", () => {
        expect(secretStorageKeyLabel("abcdefghijklmnop")).toBe("abcdefgh…");
    });

    it("leaves a short key id intact", () => {
        expect(secretStorageKeyLabel("abcdefgh")).toBe("abcdefgh");
    });

    it("treats an empty id as unset", () => {
        expect(secretStorageKeyLabel("")).toBe("Not set");
    });
});
