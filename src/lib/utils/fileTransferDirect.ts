// Pure helpers for the direct (WebRTC data channel) transport of a file
// transfer. The SDP and candidates arrive in Olm-encrypted to-device messages,
// so everything here treats them as untrusted input and never throws on them.

/** Flow control for the data channel: stop queueing above this many bytes. */
export const DIRECT_MAX_BUFFERED = 4 * 1024 * 1024;
/** Resume queueing once the channel has drained below this many bytes. */
export const DIRECT_LOW_WATER = 1024 * 1024;

const MAX_CANDIDATE_LENGTH = 1024;
const MAX_CANDIDATES = 64;
const MAX_SDP_LENGTH = 64 * 1024;

/** Drops the candidate lines a browser puts into its own SDP. Candidates
 *  travel only in candidates messages, so the SDP stays free of them. The
 *  line endings of the lines that remain are kept as they were. */
export function stripCandidateLines(sdp: string): string {
    return sdp
        .split("\n")
        .filter((line) => {
            const bare = line.replace(/\r$/, "");
            return (
                !bare.startsWith("a=candidate:") &&
                bare !== "a=end-of-candidates"
            );
        })
        .join("\n");
}

/** True when the candidate's type, the token after `typ`, is `relay`. */
export function isRelayCandidate(candidate: string): boolean {
    const tokens = candidate.trim().split(/\s+/);
    const at = tokens.indexOf("typ");
    return at >= 0 && tokens[at + 1] === "relay";
}

/** Keeps only well-formed candidate objects from a message field. Anything
 *  else is dropped rather than failing the whole batch. */
export function parseCandidates(
    value: unknown,
    relayOnly: boolean,
): RTCIceCandidateInit[] {
    if (!Array.isArray(value)) return [];
    const out: RTCIceCandidateInit[] = [];
    const count = Math.min(value.length, MAX_CANDIDATES);
    for (let i = 0; i < count; i++) {
        // Getters on hostile objects can throw; one bad entry must not
        // take the batch down, so each entry is read on its own.
        let init: RTCIceCandidateInit | null;
        try {
            init = toCandidateInit(value[i]);
        } catch {
            continue;
        }
        if (!init) continue;
        if (relayOnly && !isRelayCandidate(init.candidate!)) continue;
        out.push(init);
    }
    return out;
}

function toCandidateInit(item: unknown): RTCIceCandidateInit | null {
    if (typeof item !== "object" || item === null) return null;
    const raw = item as Record<string, unknown>;
    const candidate = raw.candidate;
    if (
        typeof candidate !== "string" ||
        candidate.length === 0 ||
        candidate.length > MAX_CANDIDATE_LENGTH ||
        !candidate.startsWith("candidate:")
    )
        return null;
    // toJSON() yields null for the absent optional fields, so null counts
    // as missing rather than as a malformed value.
    const init: RTCIceCandidateInit = { candidate };
    const { sdpMid, sdpMLineIndex, usernameFragment } = raw;
    if (sdpMid !== undefined && sdpMid !== null) {
        if (typeof sdpMid !== "string") return null;
        init.sdpMid = sdpMid;
    }
    if (sdpMLineIndex !== undefined && sdpMLineIndex !== null) {
        if (
            typeof sdpMLineIndex !== "number" ||
            !Number.isInteger(sdpMLineIndex) ||
            sdpMLineIndex < 0
        )
            return null;
        init.sdpMLineIndex = sdpMLineIndex;
    }
    if (usernameFragment !== undefined && usernameFragment !== null) {
        if (typeof usernameFragment !== "string") return null;
        init.usernameFragment = usernameFragment;
    }
    return init;
}

/** Shape check only. A session description that carries candidate lines is
 *  refused, because candidates must arrive in their own messages. The type is
 *  taken so call sites say which description they expect; the text alone
 *  cannot tell an offer from an answer. */
export function isValidSdp(
    value: unknown,
    _type: "offer" | "answer",
): value is string {
    if (typeof value !== "string") return false;
    if (value.length > MAX_SDP_LENGTH) return false;
    if (!value.startsWith("v=0")) return false;
    return !value
        .split("\n")
        .some((line) => line.replace(/\r$/, "").startsWith("a=candidate:"));
}
