/**
 * Pure helpers for editing a plugin settings form's values — list-field row
 * operations (add / remove / reorder / cell-set) and scalar field-set. Every
 * helper returns a fresh copy and never mutates its input, so a Svelte $state
 * assignment (`values[k] = addListRow(...)`) stays reactive. No SDK/DOM/
 * localStorage imports.
 */
import { coerceValues, type ScalarField } from "./settingsSchema";

/** A fresh row of coerced defaults for a list field's sub-schema. */
export function defaultRow(fields: ScalarField[]): Record<string, unknown> {
    return coerceValues(fields, {});
}

/** New array with one default row appended. */
export function addListRow(
    rows: Record<string, unknown>[],
    fields: ScalarField[],
): Record<string, unknown>[] {
    return [...rows, defaultRow(fields)];
}

/** New array without `index`; out-of-range index → unchanged copy. */
export function removeListRow(
    rows: Record<string, unknown>[],
    index: number,
): Record<string, unknown>[] {
    if (index < 0 || index >= rows.length) return [...rows];
    return rows.filter((_, i) => i !== index);
}

/** New array with the row moved; out-of-range or from===to → unchanged copy. */
export function moveListRow(
    rows: Record<string, unknown>[],
    from: number,
    to: number,
): Record<string, unknown>[] {
    if (
        from === to ||
        from < 0 ||
        from >= rows.length ||
        to < 0 ||
        to >= rows.length
    ) {
        return [...rows];
    }
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

/** New array; the row at `index` gets a shallow copy with `key` set. */
export function setListCell(
    rows: Record<string, unknown>[],
    index: number,
    key: string,
    value: unknown,
): Record<string, unknown>[] {
    if (index < 0 || index >= rows.length) return [...rows];
    return rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
}

/** New object with `key` set. */
export function setFieldValue(
    values: Record<string, unknown>,
    key: string,
    value: unknown,
): Record<string, unknown> {
    return { ...values, [key]: value };
}
