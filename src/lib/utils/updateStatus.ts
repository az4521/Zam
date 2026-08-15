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
        | "none"
        | "check"
        | "download"
        | "restart"
        | "install"
        | "open-release";
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
                label: "Checking for updates…",
                action: "none",
                actionLabel: "",
                busy: true,
                percent: null,
            };

        case "up-to-date":
            return {
                label: `You're on the latest version${versionSuffix}`,
                action: "check",
                actionLabel: "Check for updates",
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
                label: `Update available${versionSuffix}`,
                action: "download",
                actionLabel: "Download & install",
                busy: false,
                percent: null,
            };

        case "downloading":
            return {
                label: `Downloading update… ${clampedPercent}%`,
                action: "none",
                actionLabel: "",
                busy: true,
                percent: clampedPercent,
            };

        case "downloaded":
            // Android cannot restart-to-apply — a sideloaded APK install is a
            // user tap in the OS package installer. Fire that instead.
            if (platform === "android") {
                return {
                    label: "Update ready — Install",
                    action: "install",
                    actionLabel: "Install",
                    busy: false,
                    percent: null,
                };
            }
            return {
                label: "Update ready — restart to apply",
                action: "restart",
                actionLabel: "Restart to apply",
                busy: false,
                percent: null,
            };

        case "unsupported":
            return {
                label: "A new version is available",
                action: "open-release",
                actionLabel: "Open release page",
                busy: false,
                percent: null,
            };

        case "error":
            return {
                label: message ?? "Update check failed",
                action: "check",
                actionLabel: "Check for updates",
                busy: false,
                percent: null,
            };

        case "idle":
        default:
            return {
                label: "Check for updates to install the latest version.",
                action: "check",
                actionLabel: "Check for updates",
                busy: false,
                percent: null,
            };
    }
}
