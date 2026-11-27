/**
 * Change counter for the pack sprite sheets (matrix/packSheets.ts). It is
 * bumped whenever a sheet becomes available or is dropped, so a component
 * that calls `spriteFor` inside a `$derived` that reads `tick` re-runs.
 */
export const packSheetsState = $state({ tick: 0 });
