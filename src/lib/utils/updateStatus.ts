import { t } from "$lib/i18n";
export type UpdatePhase =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "downloaded"
    | "up-to-date"
    | "unsupported"
    | "error";

export interface UpdateStatusInput {
    phase: UpdatePhase;
    autoEnabled: boolean;
    percent?: number;
    version?: string;
    message?: string;
    /** Which packaged platform is asking. Governs the `downloaded` action:
     *  electron restarts into the new build; android fires the OS installer.
     *  Defaults to the restart (electron/web) mapping when omitted. */
    platform?: "electron" | "android" | "web";
}

export interface UpdateStatusView {
    label: string;
    action:
        "none" | "check" | "download" | "restart" | "install" | "open-release";
    actionLabel: string;
    busy: boolean;
    percent: number | null;
}

/**
 * Fold an updater's phase plus the auto-update toggle into a declarative view
 * model the About UI can render directly — no Electron, no DOM, data → data.
 * `version` is optional everywhere it appears in a label; an absent version
 * omits the `(v…)` fragment rather than printing `(undefined)`.
 */
export function updateStatusView(input: UpdateStatusInput): UpdateStatusView {
    const { phase, percent, version, message, platform } = input;

    const versionSuffix = version ? ` (v${version})` : "";
    const clampedPercent = Math.max(0, Math.min(100, Math.round(percent ?? 0)));

    switch (phase) {
        case "checking":
            return {
                label: t("updateStatus.checkingForUpdates"),
                action: "none",
                actionLabel: "",
                busy: true,
                percent: null,
            };

        case "up-to-date":
            return {
                label: t("updateStatus.youReOnTheLatestVersion", {
                    versionSuffix,
                }),
                action: "check",
                actionLabel: t("updateStatus.checkForUpdates"),
                busy: false,
                percent: null,
            };

        case "available":
            // A found update always offers an explicit download choice — the
            // download only starts once the user confirms. Background
            // auto-download (when the preference is on) is driven solely by the
            // launch check in the main process and surfaces as "downloading",
            // so it never lands here as a stuck "available".
            return {
                label: t("updateStatus.updateAvailable", { versionSuffix }),
                action: "download",
                actionLabel: t("updateStatus.downloadInstall"),
                busy: false,
                percent: null,
            };

        case "downloading": {
            // Name the version being fetched so the target stays visible past
            // the "available" prompt; fall back to a generic label without one.
            const downloading = version
                ? t("updateStatus.downloadingV", { version })
                : t("updateStatus.downloadingUpdate");
            return {
                label: `${downloading}… ${clampedPercent}%`,
                action: "none",
                actionLabel: "",
                busy: true,
                percent: clampedPercent,
            };
        }

        case "downloaded":
            // Android cannot restart-to-apply: a sideloaded APK install is a
            // user tap in the OS package installer. Fire that instead.
            if (platform === "android") {
                return {
                    label: t("updateStatus.updateReadyInstall", {
                        versionSuffix,
                    }),
                    action: "install",
                    actionLabel: t("updateStatus.install"),
                    busy: false,
                    percent: null,
                };
            }
            return {
                label: t("updateStatus.updateReadyRestartToApply", {
                    versionSuffix,
                }),
                action: "restart",
                actionLabel: t("updateStatus.restartToApply"),
                busy: false,
                percent: null,
            };

        case "unsupported":
            return {
                label: t("updateStatus.aNewVersionIsAvailable", {
                    versionSuffix,
                }),
                action: "open-release",
                actionLabel: t("updateStatus.openReleasePage"),
                busy: false,
                percent: null,
            };

        case "error":
            return {
                label: message ?? t("updateStatus.updateCheckFailed"),
                action: "check",
                actionLabel: t("updateStatus.checkForUpdates"),
                busy: false,
                percent: null,
            };

        case "idle":
        default:
            return {
                label: t("updateStatus.checkForUpdatesToInstallThe"),
                action: "check",
                actionLabel: t("updateStatus.checkForUpdates"),
                busy: false,
                percent: null,
            };
    }
}
