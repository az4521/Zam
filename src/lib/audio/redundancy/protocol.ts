/** Message to Zam's E2EE worker: `{ kind: ZAM_REDUNDANCY, data: { depth } }`
 *  sets how many earlier frames each outgoing audio packet carries. A
 *  separate file so the page can import it without running the worker hook. */
export const ZAM_REDUNDANCY = "zamRedundancy";
