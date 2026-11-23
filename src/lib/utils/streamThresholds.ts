// Size thresholds for the authed media stream (matrix/videoStream.ts). They live
// in this small module so components can read them without importing the whole
// streaming implementation.

/**
 * Encrypted files at least this big are streamed through MediaSource rather
 * than downloaded whole. See matrix/videoStream.ts for the integrity trade-off.
 */
export const STREAM_ENCRYPTED_MIN_BYTES = 4 * 1024 * 1024;
