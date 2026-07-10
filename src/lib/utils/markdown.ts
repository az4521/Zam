/**
 * Discord-flavoured markdown → Matrix HTML
 *
 * Supported syntax:
 *   ***bold italic***   **bold**   *italic*   _italic_   __underline__
 *   ~~strikethrough~~   ||spoiler||   `inline code`
 *   ```lang\ncode block\n```
 *   # / ## / ### headings
 *   > blockquote
 *   - unordered list item
 *   1. ordered list item
 *   -# subtext (smaller muted text)
 */

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function processInline(raw: string): { html: string; changed: boolean } {
    // Pull code spans, URLs, and emoji shortcodes out first so their content is never processed
    const spans: string[] = [];
    let s = raw.replace(/`([^`\n]+)`/g, (_, code) => {
        spans.push(`<code>${escapeHtml(code)}</code>`);
        return `\x02${spans.length - 1}\x03`;
    });
    s = s.replace(/https?:\/\/[^\s<>)"']*/g, (url) => {
        spans.push(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
        return `\x02${spans.length - 1}\x03`;
    });
    // Stash :emoji_shortcodes: so underscores/asterisks in names aren't formatted
    s = s.replace(/:[a-zA-Z0-9_+-]+:/g, (token) => {
        spans.push(escapeHtml(token));
        return `\x02${spans.length - 1}\x03`;
    });
    const hadSpans = spans.length > 0;

    // Stash backslash-escaped characters so they survive formatting passes
    const escaped: string[] = [];
    s = s.replace(/\\([\\`*_~|#>![\](){}])/g, (_, ch) => {
        escaped.push(escapeHtml(ch));
        return `\x04${escaped.length - 1}\x05`;
    });

    // Escape remaining HTML entities
    s = escapeHtml(s);

    // Apply inline formatting — longest/greedier markers first
    s = s.replace(/\|\|(.+?)\|\|/g, '<span data-mx-spoiler="">$1</span>');
    s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(?<![\w])__(.+?)__(?![\w])/g, "<u>$1</u>");
    s = s.replace(/\*([^*\n]+?)\*/g, "<em>$1</em>");
    s = s.replace(/(?<![\w])_([^_\n]+?)_(?![\w])/g, "<em>$1</em>");

    // Restore escaped characters and code spans
    s = s.replace(/\x04(\d+)\x05/g, (_, i) => escaped[+i]);
    s = s.replace(/\x02(\d+)\x03/g, (_, i) => spans[+i]);

    return {
        html: s,
        changed: hadSpans || escaped.length > 0 || s !== escapeHtml(raw),
    };
}

export function parseMarkdown(input: string): {
    formattedBody: string;
    hasFormatting: boolean;
} {
    let hasFormatting = false;
    const lines = input.split("\n");
    const parts: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const raw = lines[i];
        // Strip a leading backslash that escapes a block-level marker
        const line = /^\\([>`#\-])/.test(raw) ? raw.slice(1) : raw;
        const blockEscaped = line !== raw;

        // Fenced code block
        if (!blockEscaped && line.trimStart().startsWith("```")) {
            const langMatch = line.trimStart().match(/^```(\w*)/);
            const lang = langMatch?.[1] ?? "";
            const codeLines: string[] = [];
            i++;
            while (
                i < lines.length &&
                !lines[i].trimStart().startsWith("```")
            ) {
                codeLines.push(escapeHtml(lines[i]));
                i++;
            }
            // If no content but a language was specified, use the language string as content
            let langAttr = "";
            let codeContent: string;
            if (codeLines.length === 0 && lang) {
                codeContent = escapeHtml(lang);
            } else {
                langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
                codeContent = codeLines.join("\n");
            }
            parts.push(`<pre><code${langAttr}>${codeContent}</code></pre>`);
            hasFormatting = true;
            i++;
            continue;
        }

        // Blockquote
        if (!blockEscaped && (line.startsWith("> ") || line === ">")) {
            const content = line.startsWith("> ") ? line.slice(2) : "";
            const { html } = processInline(content);
            parts.push(`<blockquote>${html}</blockquote>`);
            hasFormatting = true;
            i++;
            continue;
        }

        // Headings (# / ## / ###)
        const hMatch = !blockEscaped ? line.match(/^(#{1,3})\s+(.+)/) : null;
        if (hMatch) {
            const level = hMatch[1].length;
            const { html } = processInline(hMatch[2]);
            parts.push(`<h${level}>${html}</h${level}>`);
            hasFormatting = true;
            i++;
            continue;
        }

        // Subtext (-# prefix)
        if (!blockEscaped && line.startsWith("-# ")) {
            const { html } = processInline(line.slice(3));
            parts.push(`<small>${html}</small>`);
            hasFormatting = true;
            i++;
            continue;
        }

        // Unordered list (lines starting with "- ")
        if (!blockEscaped && (line.startsWith("- ") || line === "-")) {
            const items: string[] = [];
            while (
                i < lines.length &&
                (lines[i].startsWith("- ") || lines[i] === "-")
            ) {
                const content = lines[i].startsWith("- ")
                    ? lines[i].slice(2)
                    : "";
                const { html } = processInline(content);
                items.push(`<li>${html}</li>`);
                i++;
            }
            parts.push(`<ul>${items.join("")}</ul>`);
            hasFormatting = true;
            continue;
        }

        // Ordered list (lines starting with "N. ")
        if (!blockEscaped && /^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
                const content = lines[i].replace(/^\d+\.\s+/, "");
                const { html } = processInline(content);
                items.push(`<li>${html}</li>`);
                i++;
            }
            parts.push(`<ol>${items.join("")}</ol>`);
            hasFormatting = true;
            continue;
        }

        // Regular line with inline formatting
        const { html, changed } = processInline(line);
        if (changed) hasFormatting = true;
        parts.push(html);
        i++;
    }

    return { formattedBody: parts.join("<br>\n"), hasFormatting };
}
