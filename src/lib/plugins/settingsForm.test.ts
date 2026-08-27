import { describe, it, expect } from "vitest";
import {
    defaultRow,
    addListRow,
    removeListRow,
    moveListRow,
    setListCell,
    setFieldValue,
} from "./settingsForm";
import type { ScalarField } from "./settingsSchema";

const fields: ScalarField[] = [
    { key: "match", type: "text", label: "Match", default: "x" },
    { key: "on", type: "toggle", label: "On", default: true },
    { key: "n", type: "number", label: "N", default: 3 },
];

describe("defaultRow", () => {
    it("builds a coerced row of defaults from the sub-schema", () => {
        expect(defaultRow(fields)).toEqual({ match: "x", on: true, n: 3 });
    });
    it("falls back to type-zero when no default given", () => {
        expect(defaultRow([{ key: "a", type: "text", label: "A" }])).toEqual({
            a: "",
        });
    });
});

describe("addListRow", () => {
    it("appends a default row without mutating the input", () => {
        const rows = [{ match: "a", on: false, n: 1 }];
        const next = addListRow(rows, fields);
        expect(next).toHaveLength(2);
        expect(next[1]).toEqual({ match: "x", on: true, n: 3 });
        expect(rows).toHaveLength(1); // unmutated
        expect(next).not.toBe(rows);
    });
});

describe("removeListRow", () => {
    it("removes the row at index, returns a new array", () => {
        const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
        const next = removeListRow(rows, 1);
        expect(next).toEqual([{ a: 1 }, { a: 3 }]);
        expect(rows).toHaveLength(3);
    });
    it("returns an unchanged copy for an out-of-range index", () => {
        const rows = [{ a: 1 }];
        expect(removeListRow(rows, 5)).toEqual([{ a: 1 }]);
        expect(removeListRow(rows, -1)).toEqual([{ a: 1 }]);
        expect(removeListRow(rows, 5)).not.toBe(rows);
    });
});

describe("moveListRow", () => {
    it("moves a row down", () => {
        const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
        expect(moveListRow(rows, 0, 2)).toEqual([{ a: 2 }, { a: 3 }, { a: 1 }]);
    });
    it("moves a row up", () => {
        const rows = [{ a: 1 }, { a: 2 }, { a: 3 }];
        expect(moveListRow(rows, 2, 0)).toEqual([{ a: 3 }, { a: 1 }, { a: 2 }]);
    });
    it("returns an unchanged copy when from===to or out of range", () => {
        const rows = [{ a: 1 }, { a: 2 }];
        expect(moveListRow(rows, 1, 1)).toEqual([{ a: 1 }, { a: 2 }]);
        expect(moveListRow(rows, 0, 9)).toEqual([{ a: 1 }, { a: 2 }]);
        expect(moveListRow(rows, -1, 0)).toEqual([{ a: 1 }, { a: 2 }]);
    });
});

describe("setListCell", () => {
    it("updates one cell of one row immutably", () => {
        const rows = [
            { a: 1, b: 2 },
            { a: 3, b: 4 },
        ];
        const next = setListCell(rows, 1, "a", 99);
        expect(next).toEqual([
            { a: 1, b: 2 },
            { a: 99, b: 4 },
        ]);
        expect(rows[1]).toEqual({ a: 3, b: 4 }); // original row unmutated
        expect(next[1]).not.toBe(rows[1]);
    });
    it("returns an unchanged copy for an out-of-range index", () => {
        const rows = [{ a: 1 }];
        expect(setListCell(rows, 5, "a", 9)).toEqual([{ a: 1 }]);
    });
});

describe("setFieldValue", () => {
    it("returns a new object with the key set", () => {
        const v = { a: 1, b: 2 };
        const next = setFieldValue(v, "a", 9);
        expect(next).toEqual({ a: 9, b: 2 });
        expect(v).toEqual({ a: 1, b: 2 });
    });
});
