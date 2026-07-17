/**
 * Reactive tick for the crypto/security status shown in Settings → Security &
 * Encryption (Layer 2: cross-signing + secret storage). `crypto.ts` bumps it
 * from CryptoEvent listeners when cross-signing keys change or key-backup state
 * flips, so the settings section re-reads `getSecurityStatus()` and the "Set up
 * recovery" wizard reflects reality after it finishes.
 *
 * Deliberately minimal — the authoritative status is fetched on demand from
 * `crypto.ts` (async CryptoApi reads), never mirrored here. Mirrors the tick
 * pattern of `messages.svelte` (`timelineTick`) and `verification.svelte`
 * (`verificationTick`).
 */
class SecurityStore {
    securityTick = $state(0);
}

export const securityState = new SecurityStore();

/** Bump the tick so security-status `$derived`/`$effect` readers re-run. */
export function bumpSecurityTick(): void {
    securityState.securityTick++;
}
