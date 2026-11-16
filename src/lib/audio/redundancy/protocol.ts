/** Message to Zam's E2EE worker: `{ kind: ZAM_REDUNDANCY, data: { depth } }`
 *  sets how many earlier frames each outgoing audio packet carries. A
 *  separate file so the page can import it without running the worker hook. */
export const ZAM_REDUNDANCY = "zamRedundancy";

/** Message to Zam's E2EE worker: `{ kind: ZAM_NATIVE_SHARE, data: { port } }`
 *  attaches the native screen share's substitution port (matrix/call/
 *  nativeShare.ts). Its AUs replace the share's placeholder video frames
 *  before LiveKit encrypts them. */
export const ZAM_NATIVE_SHARE = "zamNativeShare";
