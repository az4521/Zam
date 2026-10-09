import { ansiToHtml } from "./ansi";

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
 *  then returned untouched and the caller re-renders once it arrives.
 *  ```ansi blocks are coloured from their escape codes (utils/ansi) and
 *  need no engine. */
export function highlightCodeBlocks(
    html: string,
    engine: HighlightEngine | null,
): string {
    if (!html || typeof document === "undefined") return html;
    if (!engine && !html.includes("language-ansi")) return html;
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
        if (requested?.toLowerCase() === "ansi") {
            code.innerHTML = ansiToHtml(source);
            continue;
        }
        if (!engine) continue;
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
