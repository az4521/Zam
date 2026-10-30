package moe.crafty.matrix;

/**
 * Public half (ECDSA P-256, base64 SPKI DER) of the key that signs web bundles
 * (scripts/build-bundle.mjs). A bundle whose manifest does not verify against
 * this is never downloaded. The desktop app keeps the same key in
 * electron/bundleKey.cjs, and a test keeps the two equal. Make a new pair with
 * scripts/gen-bundle-key.mjs.
 */
final class WebBundleKey {
    static final String PUBLIC_KEY =
        "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEU30IJ5LRu3L85Dg64AKcn0RCOSzgYHw0bjpEDAXh9TPqmir2RB4q/4L9RvtLf84mG0Ib+VmOrR/u/8QWt7Dk5Q==";

    private WebBundleKey() {}
}
