// App-wide update watch + banner state. Gives the updater a presence OUTSIDE
// Settings → About: the banner is a subtle, dismissible "update ready" prompt,
// and on Android this is also where the launch-time check + download runs
// (desktop already checks from its main process; here we just mirror its
// status app-wide). No-op on web, where neither updater bridge is present.

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
import { isAndroidUpdater, downloadApk, installApk } from "$lib/androidUpdater";
import { pickApkAsset } from "$lib/utils/androidUpdate";
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

// Android has no background process, so the "auto" check runs here at boot.
// `force` downloads even with the toggle off (the banner's manual Download).
async function androidFlow(force: boolean): Promise<void> {
    try {
        setStatus({ phase: "checking", platform: "android" });
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
        const path = await downloadApk(url, (percent) =>
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
        return onDesktopUpdateStatus((s) => setStatus(s));
    }
    if (isAndroidUpdater()) {
        void androidFlow(false);
    }
    return () => {};
}

/** The banner's primary button, dispatched off the current view's action. */
export async function runBannerAction(): Promise<void> {
    switch (bannerView().action) {
        case "restart":
            desktopRestartToInstall();
            break;
        case "install":
            if (updateBannerState.apkPath) {
                await installApk(updateBannerState.apkPath);
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
