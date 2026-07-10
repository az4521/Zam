// Pure helpers for reading a homeserver's advertised support from the
// /versions (spec versions + unstable_features) and /capabilities responses.
//
// IMPORTANT: /capabilities only advertises a small, fixed set of operations.
// Only those can be reliably feature-gated (see serverSupports). Everything
// else — E2EE, calling, search, presence, directory, polls — is NOT advertised
// and must be handled with an attempt + graceful fallback instead.

export type Capabilities = Record<
    string,
    { enabled?: boolean } & Record<string, unknown>
>;

/** Features the /capabilities endpoint lets us gate reliably. */
export type GatedFeature =
    | "changePassword"
    | "setDisplayName"
    | "setAvatarUrl"
    | "change3pid";

const GATED_CAPABILITY: Record<GatedFeature, string> = {
    changePassword: "m.change_password",
    setDisplayName: "m.set_displayname",
    setAvatarUrl: "m.set_avatar_url",
    change3pid: "m.3pid_changes",
};

/**
 * Whether the server permits an operation. An unlisted capability means
 * "available" per the spec, so we only report false when it is explicitly
 * disabled.
 */
export function serverSupports(
    feature: GatedFeature,
    capabilities: Capabilities | null | undefined,
): boolean {
    const cap = capabilities?.[GATED_CAPABILITY[feature]];
    return cap?.enabled !== false;
}

/** Parse a "v1.11" spec version into [major, minor]. */
function parseVersion(v: string): [number, number] {
    const m = /^v?(\d+)\.(\d+)/.exec(v);
    return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

/** Whether the server advertises spec `target` (e.g. "v1.4") or newer. */
export function specAtLeast(versions: string[], target: string): boolean {
    const [tMaj, tMin] = parseVersion(target);
    return versions.some((v) => {
        const [maj, min] = parseVersion(v);
        return maj > tMaj || (maj === tMaj && min >= tMin);
    });
}

const UNSTABLE_LABELS: Record<string, string> = {
    "org.matrix.e2e_cross_signing": "Cross-signing (E2EE)",
    "org.matrix.msc2285.stable": "Private read receipts",
    "org.matrix.msc2836": "Threaded relations",
    "org.matrix.msc2946": "Space summaries",
    "org.matrix.msc3026.busy_presence": "Busy presence",
    "org.matrix.msc3814": "Dehydrated devices",
    "org.matrix.msc3827": "Filter public rooms by type",
    "org.matrix.msc3916.stable": "Authenticated media",
    "org.matrix.msc3952_intentional_mentions": "Intentional mentions",
    "org.matrix.simplified_msc3575": "Sliding sync (simplified)",
    "uk.half-shot.msc2666.query_mutual_rooms": "Shared rooms with a user",
};

/** A human-friendly label for an unstable-feature flag, or the raw key. */
export function labelUnstableFeature(key: string): string {
    return UNSTABLE_LABELS[key] ?? key;
}
