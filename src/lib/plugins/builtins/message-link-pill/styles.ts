export const MESSAGE_LINK_PILL_CSS = `
.zam-linkpill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: min(100%, 280px);
    padding: 1px 8px;
    border: 1px solid var(--zam-divider, #3f4147);
    border-radius: 9999px;
    background: var(--zam-background-secondary, #2b2d31);
    color: var(--zam-text-primary, #f2f3f5);
    font-size: 12px;
    font-weight: 600;
    line-height: 1.5;
    text-decoration: none;
    vertical-align: baseline;
    white-space: nowrap;
    cursor: pointer;
}
.zam-linkpill:hover {
    background: var(--zam-message-hover, #35373c);
    text-decoration: none;
}
.zam-linkpill:focus-visible {
    outline: 2px solid var(--zam-accent, #5865f2);
    outline-offset: 2px;
}
.zam-linkpill-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
.zam-linkpill-hash {
    flex-shrink: 0;
    opacity: 0.7;
}
.zam-linkpill-icon {
    flex-shrink: 0;
    width: 12px;
    height: 12px;
    opacity: 0.7;
}
.zam-linkpill-icon + .zam-linkpill-icon {
    margin-inline-start: -2px;
}
.zam-linkpill-avatar {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    object-fit: cover;
}
.zam-linkpill-initial {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--zam-accent, #5865f2);
    color: #ffffff;
    font-size: 9px;
    line-height: 1;
}
/* A pill whose preview card is hovered or focused. Doubled class beats the
 * :hover rule above so the pair stays lit together. */
.zam-linkpill.zam-linkpill-hot {
    background: var(--zam-accent, #5865f2);
    border-color: var(--zam-accent, #5865f2);
    color: #ffffff;
}
/* A preview card whose pill is hovered or focused. */
.zam-linkpill-target-hot {
    outline: 2px solid var(--zam-accent, #5865f2);
    outline-offset: 2px;
}
`;
