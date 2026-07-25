/**
 * Pure helpers for m.location (MSC3488) sharing + rendering. No DOM/SDK state.
 */

export interface LocationInput {
    lat: number;
    lon: number;
    description?: string;
}

/**
 * Parse a `geo:LAT,LON[,ALT][;u=…]` URI. Returns null when malformed. Accepts
 * `unknown` because it's fed untrusted event content — a non-string uri must
 * return null, never throw during render.
 */
export function parseGeoUri(uri: unknown): { lat: number; lon: number } | null {
    if (typeof uri !== "string") return null;
    const m = uri.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
    if (!m) return null;
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

/** "51.5074, -0.1278" — up to 5 decimals, trailing zeros trimmed. */
export function formatCoords(lat: number, lon: number): string {
    const round = (n: number) => Number(n.toFixed(5));
    return `${round(lat)}, ${round(lon)}`;
}

/** An OpenStreetMap deep link (privacy-friendly, no account). */
export function mapLinkFor(lat: number, lon: number): string {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

/**
 * A Google Maps deep link for the coordinates, using the official Maps URL
 * scheme (`?api=1`) so it opens the native app on mobile and the web map
 * elsewhere. Offered alongside {@link mapLinkFor} for users who prefer Google.
 */
export function googleMapsLinkFor(lat: number, lon: number): string {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

/** MSC3488 m.location content with a geo_uri + plain-text fallback body. */
export function buildLocationContent(
    loc: LocationInput,
): Record<string, unknown> {
    const geoUri = `geo:${loc.lat},${loc.lon}`;
    const label = loc.description?.trim() || "Location";
    return {
        msgtype: "m.location",
        body: `${label} (${geoUri})`,
        geo_uri: geoUri,
        "org.matrix.msc3488.location": {
            uri: geoUri,
            ...(loc.description?.trim()
                ? { description: loc.description.trim() }
                : {}),
        },
        "org.matrix.msc3488.asset": { type: "m.self" },
        "org.matrix.msc1767.text": loc.description?.trim() || geoUri,
    };
}
