// Public half (Ed25519, base64 SPKI DER) of the key that signs web bundles
// (scripts/build-bundle.mjs). A bundle whose manifest does not verify against
// this is never downloaded. Make a new pair with scripts/gen-bundle-key.mjs.
module.exports = {
    BUNDLE_PUBLIC_KEY:
        "MCowBQYDK2VwAyEAVUhNzNf8rLNAPMaH9JinAjNYSQXmJ+o08Ehtj919O0U=",
};
