import adapter from "@sveltejs/adapter-static"; //'@sveltejs/adapter-auto';
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// CSP is applied to production builds only. In dev it would fight Vite HMR
// (inline scripts + eval + ws), so we leave `vite dev` unconstrained.
const production = process.env.NODE_ENV === "production";

// The load-bearing directive is `script-src` without `unsafe-inline`, which
// kills injected inline handlers and <script> tags — the XSS backstop behind
// the HTML sanitizer. SvelteKit adds hashes for its own inline bootstrap.
//
// `img/media/connect/frame-src` are intentionally permissive: the client
// loads avatars, inline media, link previews and embeds from arbitrary,
// user-controlled homeservers and hosts. CSP here is defense-in-depth, not
// the primary control. The delivered <meta> also covers the Electron
// renderer, which loads this same build.
const csp = {
    mode: "hash",
    directives: {
        "default-src": ["self"],
        "script-src": ["self", "wasm-unsafe-eval", "blob:"],
        "worker-src": ["self", "blob:"],
        "style-src": ["self", "unsafe-inline"],
        "img-src": ["*", "data:", "blob:"],
        "media-src": ["*", "data:", "blob:"],
        "font-src": ["self", "data:"],
        "connect-src": ["*", "data:", "blob:"],
        "frame-src": ["*"],
        "object-src": ["none"],
        "base-uri": ["self"],
        "form-action": ["self"],
    },
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter({
            fallback: "index.html",
        }),
        ...(production ? { csp } : {}),
    },
};

export default config;
