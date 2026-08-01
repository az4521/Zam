/** The slice of highlight.js this module uses. Structural on purpose: the
 *  real `hljs` satisfies it, and a test can pass a fake — which is what
 *  keeps this file free of a static `highlight.js` import. */
export interface HighlightEngine {
    getLanguage(name: string): unknown;
    highlight(
        source: string,
        options: { language: string },
    ): { value: string; language?: string };
    highlightAuto(source: string): { value: string; language?: string };
}

/** Cheap prefilter for "is it worth downloading the highlighter for this?".
 *  A false positive only costs a chunk we would very likely fetch anyway;
 *  a false negative would leave code blocks permanently unhighlighted, so
 *  this errs toward matching (any <pre> plus any <code>, in any order). */
export function containsCodeBlock(html: string): boolean {
    return /<pre[\s/>]/i.test(html) && /<code[\s/>]/i.test(html);
}

/** Highlight sanitized Matrix HTML. highlight.js escapes source tokens.
 *  `engine` is null until the highlighter chunk has loaded — the html is
 *  then returned untouched and the caller re-renders once it arrives. */
export function highlightCodeBlocks(
    html: string,
    engine: HighlightEngine | null,
): string {
    if (!html || !engine || typeof document === "undefined") return html;
    const template = document.createElement("template");
    template.innerHTML = html;
    for (const code of template.content.querySelectorAll<HTMLElement>(
        "pre > code",
    )) {
        const languageClass = [...code.classList].find((name) =>
            name.startsWith("language-"),
        );
        const requested = languageClass?.slice("language-".length);
        const source = code.textContent ?? "";
        const result =
            requested && engine.getLanguage(requested)
                ? engine.highlight(source, { language: requested })
                : engine.highlightAuto(source);
        code.innerHTML = result.value;
        code.classList.add("hljs");
        if (result.language && !requested)
            code.classList.add(`language-${result.language}`);
    }
    return template.innerHTML;
}

/** Render emoji outside code while leaving source code byte-for-byte intact. */
export function mapOutsideCode(
    html: string,
    transform: (fragment: string) => string,
): string {
    const protectedBlocks: string[] = [];
    const tokenized = html.replace(
        /<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>/gi,
        (block) => {
            const token = `\u0001CODE${protectedBlocks.length}\u0002`;
            protectedBlocks.push(block);
            return token;
        },
    );
    return transform(tokenized).replace(
        /\u0001CODE(\d+)\u0002/g,
        (_match, index) => protectedBlocks[Number(index)] ?? "",
    );
}
