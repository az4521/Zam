import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

// Safari < 15.4 drops a declaration using dvh/svh/lvh (or the vw ones),
// leaving e.g. a modal with no height. Put a vh/vw copy in front of each:
// newer engines take the later declaration, older ones keep the copy.
const viewportUnitFallback = {
    postcssPlugin: "zam-viewport-unit-fallback",
    Declaration(decl) {
        if (!/\d[dsl]v[hw]\b/.test(decl.value)) return;
        const fallback = decl.value.replace(/(\d)[dsl]v([hw])\b/g, "$1v$2");
        const prev = decl.prev();
        if (prev?.type === "decl" && prev.prop === decl.prop) return;
        decl.cloneBefore({ value: fallback });
    },
};

export default {
    plugins: [tailwindcss, viewportUnitFallback, autoprefixer],
};
