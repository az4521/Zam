/**
 * Pure logic for plugin settings schemas: field types, schema validation, and
 * value coercion. Validates that a third-party plugin's settings schema is
 * well-formed (no nested lists, select has options, unique keys) and coerces
 * stored user values to the schema's types with defaults. Pure — no SDK, DOM,
 * or localStorage imports.
 */

export interface ToggleField {
    key: string;
    type: "toggle";
    label: string;
    default?: boolean;
    description?: string;
}

export interface TextField {
    key: string;
    type: "text";
    label: string;
    default?: string;
    placeholder?: string;
    description?: string;
}

export interface NumberField {
    key: string;
    type: "number";
    label: string;
    default?: number;
    min?: number;
    max?: number;
    step?: number;
    description?: string;
}

export interface SelectField {
    key: string;
    type: "select";
    label: string;
    default?: string;
    options: { value: string; label: string }[];
    description?: string;
}

export type ScalarField = ToggleField | TextField | NumberField | SelectField;

export interface ListField {
    key: string;
    type: "list";
    label: string;
    fields: ScalarField[];
    default?: Record<string, unknown>[];
    description?: string;
}

export type SettingsField = ScalarField | ListField;

export type SettingsSchema = SettingsField[];

const VALID_TYPES = new Set(["toggle", "text", "number", "select", "list"]);
const SCALAR_TYPES = new Set(["toggle", "text", "number", "select"]);

/** Validates a settings schema. Never throws; collects all errors. */
export function validateSchema(schema: unknown): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!Array.isArray(schema)) {
        errors.push("Schema must be an array");
        return { valid: false, errors };
    }

    const keys = new Set<string>();

    for (let i = 0; i < schema.length; i++) {
        const field = schema[i];

        if (
            typeof field !== "object" ||
            field === null ||
            Array.isArray(field)
        ) {
            errors.push(`Field at index ${i} must be an object`);
            continue;
        }

        // Check key
        if (typeof field.key !== "string" || field.key.trim() === "") {
            errors.push(`Field at index ${i} has invalid or empty key`);
        } else {
            if (keys.has(field.key)) {
                errors.push(`Duplicate key: "${field.key}"`);
            }
            keys.add(field.key);
        }

        // Check type
        if (!VALID_TYPES.has(field.type)) {
            errors.push(
                `Field "${field.key ?? `at index ${i}`}" has invalid type: "${field.type}"`,
            );
        }

        // Check label
        if (typeof field.label !== "string") {
            errors.push(
                `Field "${field.key ?? `at index ${i}`}" must have a string label`,
            );
        }

        // Type-specific validation
        if (field.type === "select") {
            if (!Array.isArray(field.options) || field.options.length === 0) {
                errors.push(
                    `Select field "${field.key ?? `at index ${i}`}" must have non-empty options array`,
                );
            }
        }

        if (field.type === "list") {
            if (!Array.isArray(field.fields) || field.fields.length === 0) {
                errors.push(
                    `List field "${field.key ?? `at index ${i}`}" must have non-empty fields array`,
                );
            } else {
                // Check for nested lists
                for (const subField of field.fields) {
                    if (
                        typeof subField === "object" &&
                        subField !== null &&
                        subField.type === "list"
                    ) {
                        errors.push(
                            `List field "${field.key ?? `at index ${i}`}" cannot contain nested list fields`,
                        );
                    }
                    // Also validate that list fields are scalar types
                    if (
                        typeof subField === "object" &&
                        subField !== null &&
                        !SCALAR_TYPES.has(subField.type)
                    ) {
                        errors.push(
                            `List field "${field.key ?? `at index ${i}`}" can only contain scalar field types`,
                        );
                    }
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/** Coerces stored values to match the schema. Never throws; falls back to
 *  defaults then type-zero. Idempotent. */
export function coerceValues(
    schema: SettingsSchema,
    stored: unknown,
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const storedObj =
        typeof stored === "object" && stored !== null && !Array.isArray(stored)
            ? (stored as Record<string, unknown>)
            : {};

    for (const field of schema) {
        const storedValue = storedObj[field.key];

        if (field.type === "toggle") {
            result[field.key] =
                typeof storedValue === "boolean"
                    ? storedValue
                    : (field.default ?? false);
        } else if (field.type === "text") {
            result[field.key] =
                typeof storedValue === "string"
                    ? storedValue
                    : (field.default ?? "");
        } else if (field.type === "number") {
            let num: number;

            if (
                typeof storedValue === "number" &&
                Number.isFinite(storedValue)
            ) {
                num = storedValue;
            } else if (typeof storedValue === "string") {
                const parsed = Number(storedValue);
                num = Number.isFinite(parsed) ? parsed : (field.default ?? 0);
            } else {
                num = field.default ?? 0;
            }

            // Clamp to min/max
            if (field.min !== undefined && num < field.min) {
                num = field.min;
            }
            if (field.max !== undefined && num > field.max) {
                num = field.max;
            }

            result[field.key] = num;
        } else if (field.type === "select") {
            const validValues = new Set(field.options.map((opt) => opt.value));

            if (
                typeof storedValue === "string" &&
                validValues.has(storedValue)
            ) {
                result[field.key] = storedValue;
            } else if (
                field.default !== undefined &&
                validValues.has(field.default)
            ) {
                result[field.key] = field.default;
            } else {
                result[field.key] = field.options[0]?.value ?? "";
            }
        } else if (field.type === "list") {
            if (Array.isArray(storedValue)) {
                const coercedRows: Record<string, unknown>[] = [];
                for (const row of storedValue) {
                    if (
                        typeof row === "object" &&
                        row !== null &&
                        !Array.isArray(row)
                    ) {
                        coercedRows.push(coerceValues(field.fields, row));
                    }
                    // Non-object rows are dropped
                }
                result[field.key] = coercedRows;
            } else {
                result[field.key] = field.default ?? [];
            }
        }
    }

    return result;
}
