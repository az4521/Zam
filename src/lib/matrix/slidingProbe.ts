/**
 * The sliding sync capability probe, started early so its round trip overlaps
 * crypto startup instead of waiting for it.
 *
 * The probe is a `POST /sync` with no lists, no extensions and no `pos`. It
 * carries its own conn_id (PROBE_CONN_ID), never the real connection's (which
 * has none): tuwunel keys connections by user, device and conn_id, and resets a
 * connection that sends a request without `pos`. Sharing the real connection's
 * key would reset the sync in use. The probe asks the server nothing it would
 * later have to resume: to-device messages, receipts and account data are only
 * requested by the real connection. Its response body is discarded; only the
 * outcome (supported, unsupported, or a transient failure) is kept. No SDK
 * value imports, so the store is testable on its own.
 */
import type { MatrixClient } from "matrix-js-sdk";
import type { MSC3575SlidingSyncRequest } from "matrix-js-sdk/lib/sliding-sync";
import { bootMark } from "$lib/utils/bootTiming";
import { isSlidingSyncUnsupportedError } from "$lib/utils/slidingSyncHelpers";

/** Outcome of the probe. Never a rejection. */
export type SlidingProbe =
    | { kind: "ok" }
    /** The server lacks the endpoint: fall back to classic sync. */
    | { kind: "unsupported"; err: unknown }
    /** Network blip, 5xx, rate limit: not evidence either way. */
    | { kind: "failed"; err: unknown };

/** The client methods the probe uses. */
export type ProbeClient = Pick<
    MatrixClient,
    "slidingSync" | "getHomeserverUrl"
>;

/** The probe's own connection key, distinct from the real sync's (which has none). */
const PROBE_CONN_ID = "zam-probe";

/** Probes keyed by the client that sent them, so a stale client's is never used. */
const pending = new WeakMap<object, Promise<SlidingProbe>>();

/** Pure: map a probe request's settlement to its outcome. */
export function probeOutcome(
    settled: { ok: true } | { ok: false; err: unknown },
): SlidingProbe {
    if (settled.ok) return { kind: "ok" };
    return isSlidingSyncUnsupportedError(settled.err)
        ? { kind: "unsupported", err: settled.err }
        : { kind: "failed", err: settled.err };
}

/**
 * Send the probe now and remember it for `client`. Call only when this account
 * has sliding sync enabled. The returned promise never rejects.
 */
export function startSlidingProbe(client: ProbeClient): Promise<SlidingProbe> {
    bootMark("sliding-probe-start");
    const outcome = Promise.resolve()
        .then(() =>
            client.slidingSync(
                // conn_id is not in the SDK's type, but the SDK posts the whole
                // object as the body, so the server receives it.
                {
                    lists: {},
                    timeout: 0,
                    clientTimeout: 10000,
                    conn_id: PROBE_CONN_ID,
                } as MSC3575SlidingSyncRequest,
                client.getHomeserverUrl(),
            ),
        )
        .then(
            () => probeOutcome({ ok: true }),
            (err: unknown) => probeOutcome({ ok: false, err }),
        );
    pending.set(client, outcome);
    return outcome;
}

/**
 * The probe started for `client`, handed out once. Undefined when none was
 * started (the caller then sends its own).
 */
export function takeSlidingProbe(
    client: object,
): Promise<SlidingProbe> | undefined {
    const p = pending.get(client);
    pending.delete(client);
    return p;
}
