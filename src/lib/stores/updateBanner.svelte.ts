// App-wide update watch + banner state. Gives the updater a presence OUTSIDE
// Settings → About: the banner is a subtle, dismissible "update ready" prompt,
// and on Android this is also where the launch-time check + download runs
// (desktop already checks from its main process; here we just mirror its
// status app-wide). No-op on web, where neither updater bridge is present.
import { t } from "$lib/i18n";

import {
    updateStatusView,
    type UpdateStatusInput,
    type UpdateStatusView,
} from "$lib/utils/updateStatus";
import { shouldShowUpdateBanner } from "$lib/utils/updateBanner";
import {
    isDesktopUpdater,
    desktopDownload,
    desktopRestartToInstall,
    onDesktopUpdateStatus,
} from "$lib/desktopUpdater";
import { canApplyUpdateNow } from "$lib/utils/updateApplyGate";
import { readIdleMs } from "$lib/stores/presence.svelte";
import { voiceCallState } from "$lib/stores/voiceCall.svelte";
import { incomingCallsState } from "$lib/stores/incomingCalls.svelte";
import { isAndroidUpdater, downloadApk, installApk } from "$lib/androidUpdater";
import {
    isAndroidWebBundle,
    webBundleApply,
    webBundleCheck,
    webBundleDownload,
} from "$lib/androidWebBundle";
import { pickApkAsset, versionCodeFromSemver } from "$lib/utils/androidUpdate";
import { checkForUpdate, openReleasePage } from "$lib/update";
import { settingsState } from "$lib/stores/settings.svelte";

const RELEASES_URL = "https://github.com/az4521/Zam/releases/latest";

interface UpdateBannerState {
    status: UpdateStatusInput;
    dismissed: boolean;
    /** Path of a downloaded Android APK, for the Install action. */
    apkPath: string | null;
    /** Release page URL, for the "open release" fallback. */
    releaseUrl: string;
}

export const updateBannerState = $state<UpdateBannerState>({
    status: { phase: "idle", autoEnabled: settingsState.autoUpdateEnabled },
    dismissed: false,
    apkPath: null,
    releaseUrl: RELEASES_URL,
});

/** Live view model (label/action/actionLabel) for the current status. */
export function bannerView(): UpdateStatusView {
    return updateStatusView({
        ...updateBannerState.status,
        autoEnabled: settingsState.autoUpdateEnabled,
    });
}

/** Whether the banner should currently be shown. */
export function bannerVisible(): boolean {
    // Debug > "Hide update prompts": the checker and auto-apply carry on.
    if (settingsState.updateNagDisabled) return false;
    return shouldShowUpdateBanner(
        updateBannerState.status.phase,
        updateBannerState.dismissed,
    );
}

function setStatus(patch: Partial<UpdateStatusInput>): void {
    const prevPhase = updateBannerState.status.phase;
    updateBannerState.status = {
        ...updateBannerState.status,
        ...patch,
        autoEnabled: settingsState.autoUpdateEnabled,
    };
    // A freshly-actionable phase re-shows a previously dismissed banner (a new
    // update earns a new prompt); transient phases don't un-dismiss.
    if (
        updateBannerState.status.phase !== prevPhase &&
        shouldShowUpdateBanner(updateBannerState.status.phase, false)
    ) {
        updateBannerState.dismissed = false;
    }
}

export function dismissUpdateBanner(): void {
    updateBannerState.dismissed = true;
}

/**
 * Android: a release that only changes the web UI updates through a signed
 * bundle (WebBundlePlugin), not the APK. "offer" reports it, "auto" also
 * downloads it when automatic updates are on, "download" always does. Native
 * applies a staged bundle itself, at launch or the moment the app goes to the
 * background (the app is frozen about 30 seconds after that, so JS cannot
 * wait for a quiet moment); the banner's Reload applies it on request.
 * Returns true when the bundle path owns this release, so the APK flow must
 * not also offer it; false for anything else, including any trouble.
 */
export async function androidBundleStep(
    mode: "offer" | "auto" | "download",
): Promise<boolean> {
    if (!isAndroidWebBundle()) return false;
    try {
        const found = await webBundleCheck();
        if (found.kind !== "bundle") return false;
        const base = {
            platform: "android" as const,
            kind: "bundle" as const,
            version: found.version,
        };
        if (found.staged) {
            setStatus({ phase: "downloaded", ...base });
            return true;
        }
        setStatus({ phase: "available", ...base });
        if (
            mode === "offer" ||
            (mode === "auto" && !settingsState.autoUpdateEnabled)
        )
            return true;
        setStatus({ phase: "downloading", percent: 0, ...base });
        await webBundleDownload((percent) =>
            setStatus({ phase: "downloading", percent }),
        );
        setStatus({ phase: "downloaded", ...base });
        return true;
    } catch {
        return false;
    }
}

// The last time the Android launch-style check ran, so coming back to the app
// can re-check without doing it on every switch.
let lastAndroidCheckAt = 0;
const ANDROID_RECHECK_MS = 4 * 60 * 60 * 1000;

// Android has no background process, so the "auto" check runs here at boot.
// `force` downloads even with the toggle off (the banner's manual Download).
async function androidFlow(force: boolean): Promise<void> {
    lastAndroidCheckAt = Date.now();
    try {
        setStatus({ phase: "checking", platform: "android", kind: "shell" });
        if (await androidBundleStep(force ? "download" : "auto")) return;
        const info = await checkForUpdate();
        updateBannerState.releaseUrl = info.url || RELEASES_URL;
        if (!info.updateAvailable) {
            setStatus({ phase: "up-to-date", version: info.latest });
            return;
        }
        setStatus({ phase: "available", version: info.latest });
        if (!force && !settingsState.autoUpdateEnabled) return;
        const url = pickApkAsset(info.assets ?? []);
        if (!url) {
            setStatus({ phase: "unsupported", version: info.latest });
            return;
        }
        setStatus({ phase: "downloading", version: info.latest, percent: 0 });
        // Floor = the version the user was shown, so native also refuses a
        // rolled-back-but-still-signed archive.
        const minVersionCode = versionCodeFromSemver(info.latest ?? "");
        const path = await downloadApk(url, minVersionCode, (percent) =>
            setStatus({ phase: "downloading", percent }),
        );
        updateBannerState.apkPath = path;
        setStatus({ phase: "downloaded", version: info.latest });
    } catch (e) {
        setStatus({ phase: "error", message: (e as Error)?.message });
    }
}

/**
 * Wire the app-wide update watch once, from the app shell's onMount.
 *  - Desktop: subscribe to the main process's status stream so the banner
 *    reflects the ~10s launch check wherever the user is.
 *  - Android: run the launch check now (+ auto-download when the toggle is on).
 * No-op on web. Returns a teardown.
 */
export function initUpdateWatch(): () => void {
    if (isDesktopUpdater()) {
        const unsub = onDesktopUpdateStatus((s) => {
            setStatus(s);
            void applyDownloadedUpdateWhenIdle();
        });
        // A download that finished while the user was busy applies at the first
        // quiet moment, so keep looking; the page being hidden is one too.
        const timer = setInterval(
            () => void applyDownloadedUpdateWhenIdle(),
            APPLY_CHECK_MS,
        );
        const onVisibility = () => void applyDownloadedUpdateWhenIdle();
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            unsub();
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }
    if (isAndroidUpdater()) {
        void androidFlow(false);
        // The app is frozen in the background, so a long-open session never
        // re-checks by itself; coming back after a while does.
        const onVisible = () => {
            const phase = updateBannerState.status.phase;
            if (
                document.visibilityState !== "visible" ||
                phase === "downloading" ||
                phase === "downloaded" ||
                Date.now() - lastAndroidCheckAt < ANDROID_RECHECK_MS
            )
                return;
            void androidFlow(false);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () =>
            document.removeEventListener("visibilitychange", onVisible);
    }
    return () => {};
}

const APPLY_CHECK_MS = 30_000;
// A restart or reload that did not take effect (say the main process refused)
// must not leave the watch stuck thinking it is applying.
const APPLY_RETRY_MS = 60_000;
let applyingSince = 0;

/**
 * Desktop, automatic updates on: once an update has downloaded, apply it (a
 * reload for a web bundle, a restart for an installer) at a moment nobody is
 * using the app, never in a call. Reads idleness first and decides on fresh
 * state afterwards, so a click during the read still wins.
 */
async function applyDownloadedUpdateWhenIdle(): Promise<void> {
    if (
        updateBannerState.status.phase !== "downloaded" ||
        !settingsState.autoUpdateEnabled ||
        Date.now() - applyingSince < APPLY_RETRY_MS
    )
        return;
    const idleMs = await readIdleMs();
    if (
        updateBannerState.status.phase !== "downloaded" ||
        !canApplyUpdateNow({
            inCall: voiceCallState.connState !== null,
            ringing: incomingCallsState.ringing.length > 0,
            windowVisible: document.visibilityState === "visible",
            idleMs,
        })
    )
        return;
    applyingSince = Date.now();
    desktopRestartToInstall();
}

/** The banner's primary button, dispatched off the current view's action. */
export async function runBannerAction(): Promise<void> {
    switch (bannerView().action) {
        case "restart":
            if (isAndroidWebBundle()) {
                // Only ever offered for a downloaded web bundle.
                try {
                    await webBundleApply();
                } catch (e) {
                    setStatus({
                        phase: "error",
                        message: (e as Error)?.message,
                    });
                }
            } else desktopRestartToInstall();
            break;
        case "install":
            // `apkPath` stays the "a download completed" marker; it is no
            // longer passed — native installs its own private download.
            if (updateBannerState.apkPath) {
                try {
                    await installApk();
                } catch (e) {
                    // Native rejects for real reasons now (signer mismatch,
                    // version floor, nothing staged), so this branch fires.
                    // Route it through the same error phase androidFlow uses
                    // rather than leaving an unhandled rejection.
                    setStatus({
                        phase: "error",
                        message:
                            (e as Error)?.message ??
                            t("updateBanner.installFailed"),
                    });
                }
            }
            break;
        case "download":
            if (isDesktopUpdater()) desktopDownload();
            else await androidFlow(true);
            break;
        case "open-release":
            openReleasePage(updateBannerState.releaseUrl);
            break;
    }
}
