const ICON_SIZE = 64;
let generation = 0;
let originalIcons: Array<{
    link: HTMLLinkElement;
    href: string;
    type: string;
}> | null = null;

function rememberIcons(): Array<{
    link: HTMLLinkElement;
    href: string;
    type: string;
}> {
    originalIcons ??= [
        ...document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']"),
    ].map((link) => ({ link, href: link.href, type: link.type }));
    return originalIcons;
}

/** Draw a compact unread counter over the existing favicon. */
export async function updateFaviconBadge(count: number): Promise<void> {
    if (typeof document === "undefined") return;
    const request = ++generation;
    const icons = rememberIcons();
    if (count <= 0) {
        for (const { link, href, type } of icons) {
            link.href = href;
            link.type = type;
        }
        return;
    }

    const image = new Image();
    image.src = "/favicon.png";
    try {
        await image.decode();
    } catch {
        return;
    }
    if (request !== generation) return;

    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, ICON_SIZE, ICON_SIZE);

    const label = count > 99 ? "99+" : String(count);
    const radius = label.length > 2 ? 18 : 16;
    ctx.fillStyle = "#ed4245";
    ctx.beginPath();
    ctx.arc(ICON_SIZE - radius, radius, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${label.length > 2 ? 20 : 24}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, ICON_SIZE - radius, radius + 1);

    const dataUrl = canvas.toDataURL("image/png");
    for (const { link } of icons) {
        link.type = "image/png";
        link.href = dataUrl;
    }
}
