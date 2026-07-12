import hljs from "highlight.js/lib/common";

/** Highlight sanitized Matrix HTML. highlight.js escapes source tokens. */
export function highlightCodeBlocks(html: string): string {
    if (!html || typeof document === "undefined") return html;
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
            requested && hljs.getLanguage(requested)
                ? hljs.highlight(source, { language: requested })
                : hljs.highlightAuto(source);
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
