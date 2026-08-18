import { describe, it, expect } from "vitest";
import { geoErrorMessage, geolocationUnavailableMessage } from "./geoErrors";

const HTTPS_HINT =
    "Location needs a secure (HTTPS) connection - open the app over https.";

describe("geoErrorMessage", () => {
    it("blames the insecure context for code 1 when not secure", () => {
        // Insecure contexts auto-deny with PERMISSION_DENIED without ever
        // prompting — "permission denied" would send users down the wrong
        // trail.
        expect(geoErrorMessage({ code: 1 }, false)).toBe(HTTPS_HINT);
    });

    it("reports a real permission denial for code 1 in a secure context", () => {
        expect(geoErrorMessage({ code: 1 }, true)).toBe(
            "Location permission was denied - check site permissions.",
        );
    });

    it("reports position unavailable for code 2 regardless of context", () => {
        const msg =
            "Your position is unavailable (location off or no GPS fix).";
        expect(geoErrorMessage({ code: 2 }, true)).toBe(msg);
        expect(geoErrorMessage({ code: 2 }, false)).toBe(msg);
    });

    it("reports a timeout for code 3 regardless of context", () => {
        const msg = "Timed out getting your location.";
        expect(geoErrorMessage({ code: 3 }, true)).toBe(msg);
        expect(geoErrorMessage({ code: 3 }, false)).toBe(msg);
    });

    it("falls back to a generic message for unknown codes", () => {
        expect(geoErrorMessage({ code: 0 }, true)).toBe(
            "Couldn't get your location.",
        );
        expect(geoErrorMessage({ code: 42 }, false)).toBe(
            "Couldn't get your location.",
        );
    });

    it("falls back to a generic message for null/undefined errors", () => {
        expect(geoErrorMessage(null, true)).toBe("Couldn't get your location.");
        expect(geoErrorMessage(undefined, false)).toBe(
            "Couldn't get your location.",
        );
    });
});

describe("geolocationUnavailableMessage", () => {
    it("says the browser lacks geolocation in a secure context", () => {
        expect(geolocationUnavailableMessage(true)).toBe(
            "Location isn't available in this browser.",
        );
    });

    it("blames the insecure context when not secure", () => {
        expect(geolocationUnavailableMessage(false)).toBe(HTTPS_HINT);
    });
});
