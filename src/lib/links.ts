import { GITHUB_OWNER, GITHUB_REPO } from "$lib/utils/androidUpdate";

// Project links shown by the hosted web build (login screen, Settings > About).
// Packaged desktop/Android builds already have the app, so they hide the
// promotional ones (see CAN_INSTALL_UPDATE in $lib/update).
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
/** Always the newest installer/APK, so a release never needs a link edit. */
export const DOWNLOAD_URL = `${GITHUB_URL}/releases/latest`;
export const WEBSITE_URL = "https://zam.crafty.moe";
