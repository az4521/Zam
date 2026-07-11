# Vendored Twemoji assets

`svg/` is a verbatim copy of `assets/svg` from
[jdecked/twemoji](https://github.com/jdecked/twemoji) at commit
`314c9f493f5609ab3a2691fba9650827c3e317a1` — the same commit the app
previously loaded from the jsDelivr CDN, so rendering is unchanged.

Referenced via `TWEMOJI_BASE` in `src/lib/utils/twemoji.ts`. To update:
replace `svg/` with the new commit's `assets/svg` and bump the commit hash
here and in that file (keep it in lockstep with the `@twemoji/api` parser
version so codepoint lookups keep matching).

The graphics are licensed CC-BY 4.0 (`LICENSE-GRAPHICS.txt`).
