import { describe, it, expect } from "vitest";
import {
    validateSchema,
    coerceValues,
    type SettingsSchema,
} from "./settingsSchema";

describe("validateSchema", () => {
    it("accepts a well-formed mixed schema with all field types", () => {
        const schema = [
            { key: "enabled", type: "toggle", label: "Enable feature" },
            { key: "name", type: "text", label: "Name" },
            { key: "count", type: "number", label: "Count" },
            {
                key: "mode",
                type: "select",
                label: "Mode",
                options: [
                    { value: "auto", label: "Auto" },
                    { value: "manual", label: "Manual" },
                ],
            },
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [
                    { key: "title", type: "text", label: "Title" },
                    { key: "priority", type: "number", label: "Priority" },
                ],
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it("rejects a non-array schema", () => {
        const result = validateSchema({ fields: [] });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("array");
    });

    it("rejects null or undefined", () => {
        expect(validateSchema(null).valid).toBe(false);
        expect(validateSchema(undefined).valid).toBe(false);
    });

    it("rejects duplicate keys", () => {
        const schema = [
            { key: "name", type: "text", label: "First" },
            { key: "name", type: "text", label: "Second" },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("Duplicate key"))).toBe(
            true,
        );
    });

    it("rejects empty key", () => {
        const schema = [{ key: "", type: "text", label: "Empty" }];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("key"))).toBe(true);
    });

    it("rejects unknown type", () => {
        const schema = [{ key: "field", type: "unknown", label: "Label" }];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("type"))).toBe(true);
    });

    it("rejects select without options", () => {
        const schema = [{ key: "mode", type: "select", label: "Mode" }];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("options"))).toBe(true);
    });

    it("rejects select with empty options array", () => {
        const schema = [
            { key: "mode", type: "select", label: "Mode", options: [] },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("options"))).toBe(true);
    });

    it("rejects list without fields", () => {
        const schema = [{ key: "items", type: "list", label: "Items" }];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("fields"))).toBe(true);
    });

    it("rejects list with empty fields array", () => {
        const schema = [
            { key: "items", type: "list", label: "Items", fields: [] },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("fields"))).toBe(true);
    });

    it("rejects list nested inside another list's fields", () => {
        const schema = [
            {
                key: "outer",
                type: "list",
                label: "Outer",
                fields: [
                    {
                        key: "inner",
                        type: "list",
                        label: "Inner",
                        fields: [{ key: "x", type: "text", label: "X" }],
                    },
                ],
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(
            result.errors.some(
                (e) => e.includes("nested") || e.includes("list"),
            ),
        ).toBe(true);
    });

    it("rejects non-string label", () => {
        const schema = [{ key: "field", type: "text", label: 123 }];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("label"))).toBe(true);
    });

    it("rejects field that is not an object", () => {
        const schema = ["not an object"];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("rejects list with bare string sub-field", () => {
        const schema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: ["not an object"] as any,
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("items"))).toBe(true);
    });

    it("rejects list sub-field with empty key", () => {
        const schema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [{ key: "", type: "text", label: "Empty" }],
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(
            result.errors.some((e) => e.includes("items") && e.includes("key")),
        ).toBe(true);
    });

    it("rejects list sub-field with non-string label", () => {
        const schema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [{ key: "field", type: "text", label: 123 as any }],
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(
            result.errors.some(
                (e) => e.includes("items") && e.includes("label"),
            ),
        ).toBe(true);
    });

    it("rejects list sub-field select without options", () => {
        const schema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [
                    { key: "choice", type: "select", label: "Choice" } as any,
                ],
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(false);
        expect(
            result.errors.some(
                (e) => e.includes("items") && e.includes("options"),
            ),
        ).toBe(true);
    });

    it("accepts list with well-formed scalar sub-fields", () => {
        const schema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [
                    { key: "title", type: "text", label: "Title" },
                    { key: "count", type: "number", label: "Count" },
                    { key: "enabled", type: "toggle", label: "Enabled" },
                    {
                        key: "mode",
                        type: "select",
                        label: "Mode",
                        options: [{ value: "a", label: "A" }],
                    },
                ],
            },
        ];
        const result = validateSchema(schema);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });
});

describe("coerceValues", () => {
    const schema: SettingsSchema = [
        {
            key: "enabled",
            type: "toggle",
            label: "Enable",
            default: true,
        },
        {
            key: "name",
            type: "text",
            label: "Name",
            default: "default-name",
        },
        {
            key: "count",
            type: "number",
            label: "Count",
            default: 5,
            min: 0,
            max: 10,
        },
        {
            key: "mode",
            type: "select",
            label: "Mode",
            default: "auto",
            options: [
                { value: "auto", label: "Auto" },
                { value: "manual", label: "Manual" },
            ],
        },
    ];

    it("applies defaults for missing keys", () => {
        const result = coerceValues(schema, {});
        expect(result.enabled).toBe(true);
        expect(result.name).toBe("default-name");
        expect(result.count).toBe(5);
        expect(result.mode).toBe("auto");
    });

    it("applies type-zero defaults when default is absent", () => {
        const minimalSchema: SettingsSchema = [
            { key: "flag", type: "toggle", label: "Flag" },
            { key: "text", type: "text", label: "Text" },
            { key: "num", type: "number", label: "Num" },
        ];
        const result = coerceValues(minimalSchema, {});
        expect(result.flag).toBe(false);
        expect(result.text).toBe("");
        expect(result.num).toBe(0);
    });

    it("keeps a valid stored value", () => {
        const stored = {
            enabled: false,
            name: "custom",
            count: 7,
            mode: "manual",
        };
        const result = coerceValues(schema, stored);
        expect(result.enabled).toBe(false);
        expect(result.name).toBe("custom");
        expect(result.count).toBe(7);
        expect(result.mode).toBe("manual");
    });

    it("falls back on wrong type for toggle", () => {
        const result = coerceValues(schema, { enabled: "string" });
        expect(result.enabled).toBe(true); // default
    });

    it("falls back on wrong type for text", () => {
        const result = coerceValues(schema, { name: 123 });
        expect(result.name).toBe("default-name");
    });

    it("falls back on wrong type for number", () => {
        const result = coerceValues(schema, { count: "not a number" });
        expect(result.count).toBe(5); // default
    });

    it("clamps number to min", () => {
        const result = coerceValues(schema, { count: -5 });
        expect(result.count).toBe(0);
    });

    it("clamps number to max", () => {
        const result = coerceValues(schema, { count: 20 });
        expect(result.count).toBe(10);
    });

    it("coerces numeric string to number", () => {
        const result = coerceValues(schema, { count: "3" });
        expect(result.count).toBe(3);
    });

    it("coerces numeric string and clamps", () => {
        const result = coerceValues(schema, { count: "15" });
        expect(result.count).toBe(10);
    });

    it("select falls back to default on invalid value", () => {
        const result = coerceValues(schema, { mode: "invalid" });
        expect(result.mode).toBe("auto");
    });

    it("select falls back to first option when no default and invalid value", () => {
        const selectSchema: SettingsSchema = [
            {
                key: "choice",
                type: "select",
                label: "Choice",
                options: [
                    { value: "a", label: "A" },
                    { value: "b", label: "B" },
                ],
            },
        ];
        const result = coerceValues(selectSchema, { choice: "invalid" });
        expect(result.choice).toBe("a");
    });

    it("list drops non-object rows and coerces object rows", () => {
        const listSchema: SettingsSchema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [
                    { key: "title", type: "text", label: "Title", default: "" },
                    {
                        key: "value",
                        type: "number",
                        label: "Value",
                        default: 0,
                    },
                ],
            },
        ];
        const stored = {
            items: [
                { title: "First", value: 10 },
                "not an object",
                { title: "Second", value: "5" }, // will coerce "5" to 5
                42,
                null,
            ],
        };
        const result = coerceValues(listSchema, stored);
        expect(Array.isArray(result.items)).toBe(true);
        expect((result.items as any[]).length).toBe(2);
        expect((result.items as any[])[0]).toEqual({
            title: "First",
            value: 10,
        });
        expect((result.items as any[])[1]).toEqual({
            title: "Second",
            value: 5,
        });
    });

    it("list uses default when stored is not an array", () => {
        const listSchema: SettingsSchema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [{ key: "x", type: "text", label: "X" }],
                default: [{ x: "def" }],
            },
        ];
        const result = coerceValues(listSchema, { items: "not an array" });
        expect(result.items).toEqual([{ x: "def" }]);
    });

    it("list defaults to empty array when no default", () => {
        const listSchema: SettingsSchema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [{ key: "x", type: "text", label: "X" }],
            },
        ];
        const result = coerceValues(listSchema, {});
        expect(result.items).toEqual([]);
    });

    it("ignores extra stored keys", () => {
        const result = coerceValues(schema, { extra: "ignored", name: "kept" });
        expect(result).not.toHaveProperty("extra");
        expect(result.name).toBe("kept");
    });

    it("is idempotent", () => {
        const stored = {
            enabled: "wrong type",
            count: 15, // will clamp
            mode: "invalid",
        };
        const once = coerceValues(schema, stored);
        const twice = coerceValues(schema, once);
        expect(twice).toEqual(once);
    });

    it("handles null and undefined stored gracefully", () => {
        const nullResult = coerceValues(schema, null);
        expect(nullResult.enabled).toBe(true);
        expect(nullResult.name).toBe("default-name");

        const undefinedResult = coerceValues(schema, undefined);
        expect(undefinedResult.enabled).toBe(true);
    });

    it("handles select with empty options edge case", () => {
        // Edge case: schema validation would reject this, but coerceValues shouldn't crash
        const edgeSchema: SettingsSchema = [
            {
                key: "choice",
                type: "select",
                label: "Choice",
                options: [],
            },
        ];
        const result = coerceValues(edgeSchema, {});
        expect(result.choice).toBe(""); // Falls back to empty string when no options
    });

    it("coerces list default rows with wrong-typed values", () => {
        const listSchema: SettingsSchema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [
                    { key: "count", type: "number", label: "Count" },
                    { key: "name", type: "text", label: "Name" },
                ],
                default: [
                    { count: "123", name: 456, extra: "ignore" }, // wrong types + extra key
                ],
            },
        ];
        const result = coerceValues(listSchema, {});
        expect(Array.isArray(result.items)).toBe(true);
        const items = result.items as any[];
        expect(items.length).toBe(1);
        expect(items[0]).toEqual({ count: 123, name: "" }); // coerced + extra key removed
        expect(items[0]).not.toHaveProperty("extra");
    });

    it("list coercion is idempotent with defaults", () => {
        const listSchema: SettingsSchema = [
            {
                key: "items",
                type: "list",
                label: "Items",
                fields: [{ key: "x", type: "number", label: "X" }],
                default: [{ x: "10" }], // string number
            },
        ];
        const once = coerceValues(listSchema, {});
        const twice = coerceValues(listSchema, once);
        expect(twice).toEqual(once);
    });
});
