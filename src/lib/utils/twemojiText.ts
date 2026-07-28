import { escapeHtml } from "./markdown";
import { renderHtml } from "./twemoji";

/**
 * Render untrusted PLAIN TEXT (a room name, a space name) as HTML with its
 * emoji replaced by Twemoji <img> tags.
 *
 * `renderHtml` in ./twemoji expects HTML and will happily pass markup through,
 * so the text MUST be escaped first — this wrapper is the only sanctioned way
 * to put a room name behind `{@html}`. Never call `renderHtml` on raw text.
 */
export function renderPlainTextWithTwemoji(
    text: string,
    className = "name-twemoji",
): string {
    return renderHtml(escapeHtml(text), className);
}
