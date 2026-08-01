import { describe, it, expect } from "vitest";
import { isOffCanvasClosed } from "./drawerInert";

// Left drawer (AppShell): open at 0, closed at -DRAWER_WIDTH.
const LEFT_CLOSED = -312;
// Right drawers (MessageArea): open at 0, closed at +WIDTH.
const RIGHT_CLOSED = 280;

describe("isOffCanvasClosed", () => {
    it("reports a left drawer parked at its closed offset as closed", () => {
        expect(isOffCanvasClosed(LEFT_CLOSED, LEFT_CLOSED)).toBe(true);
    });

    it("reports a left drawer dragged past closed as closed", () => {
        expect(isOffCanvasClosed(-400, LEFT_CLOSED)).toBe(true);
    });

    it("reports a left drawer one pixel open as NOT closed", () => {
        expect(isOffCanvasClosed(-311, LEFT_CLOSED)).toBe(false);
    });

    it("reports a fully open left drawer as NOT closed", () => {
        expect(isOffCanvasClosed(0, LEFT_CLOSED)).toBe(false);
    });

    it("reports a right drawer parked at its closed offset as closed", () => {
        expect(isOffCanvasClosed(RIGHT_CLOSED, RIGHT_CLOSED)).toBe(true);
    });

    it("reports a right drawer dragged past closed as closed", () => {
        expect(isOffCanvasClosed(400, RIGHT_CLOSED)).toBe(true);
    });

    it("reports a right drawer one pixel open as NOT closed", () => {
        expect(isOffCanvasClosed(279, RIGHT_CLOSED)).toBe(false);
    });

    it("reports a fully open right drawer as NOT closed", () => {
        expect(isOffCanvasClosed(0, RIGHT_CLOSED)).toBe(false);
    });

    // The direction is inferred from the SIGN of closedTranslate. Getting this
    // wrong makes a drawer inert while it is open — a total keyboard lockout
    // that no type check can catch, so it is pinned from both sides.
    it("does not treat a left drawer's open position as a right drawer's closed one", () => {
        expect(isOffCanvasClosed(0, LEFT_CLOSED)).toBe(false);
        expect(isOffCanvasClosed(LEFT_CLOSED, RIGHT_CLOSED)).toBe(false);
        expect(isOffCanvasClosed(RIGHT_CLOSED, LEFT_CLOSED)).toBe(false);
    });

    // Fail OPEN, never closed: an unreadable measurement must leave the drawer
    // interactive. Being wrong in this direction costs a tabbable off-screen
    // control; being wrong the other way costs the user the whole drawer.
    // Every assertion below reports CLOSED — i.e. wrongly inert — if the
    // Number.isFinite guard is deleted, so these are what actually pin it.
    it("treats an infinite measurement as not closed", () => {
        expect(isOffCanvasClosed(Number.NEGATIVE_INFINITY, LEFT_CLOSED)).toBe(
            false,
        );
        expect(isOffCanvasClosed(Number.POSITIVE_INFINITY, RIGHT_CLOSED)).toBe(
            false,
        );
        // An infinite closed offset out-runs every finite translate, so a
        // matching infinite translate is the ONLY shape in which an unreadable
        // closed offset can be misread as closed.
        expect(
            isOffCanvasClosed(
                Number.NEGATIVE_INFINITY,
                Number.NEGATIVE_INFINITY,
            ),
        ).toBe(false);
    });

    // Contract, NOT guard coverage: every comparison against NaN is already
    // false, so these two pass even with the Number.isFinite guard deleted.
    it("documents a NaN measurement as not closed (contract, not guard coverage)", () => {
        expect(isOffCanvasClosed(Number.NaN, LEFT_CLOSED)).toBe(false);
        expect(isOffCanvasClosed(-312, Number.NaN)).toBe(false);
    });

    it("treats a zero-width drawer as not closed", () => {
        // No off-canvas distance exists, so there is no state in which hiding
        // the subtree from the keyboard would be correct.
        expect(isOffCanvasClosed(0, 0)).toBe(false);
    });
});
