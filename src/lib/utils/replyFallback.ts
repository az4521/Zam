/** Spec v1.19 rich-reply fallback stripping. Body: drop leading "> "-prefixed
 * lines, then one blank separator. HTML: remove a LEADING <mx-reply> element
 * (children included) via DOM parse — regex is evadable by attributes. */
export function stripBodyFallback(body: string): string {
    const lines = body.split("\n");
    let i = 0;
    while (i < lines.length && lines[i].startsWith("> ")) i++;
    if (i === 0) return body;
    if (i < lines.length && lines[i] === "") i++;
    return lines.slice(i).join("\n");
}

export function stripFormattedFallback(html: string): string {
    if (!/^\s*<mx-reply[\s>]/i.test(html)) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const first = doc.body.firstElementChild;
    if (first?.tagName.toLowerCase() === "mx-reply") first.remove();
    return doc.body.innerHTML;
}
