import { describe, it, expect } from "vitest";
import { parseManifest, KNOWN_CAPABILITIES, type Manifest } from "./manifest";
import type { SettingsSchema } from "./settingsSchema";

describe("parseManifest", () => {
    it("parses a full valid manifest to the expected object", () => {
        const input = {
            id: "com.example.myplugin",
            name: "My Plugin",
            version: "1.2.3",
            description: "A test plugin",
            author: "Test Author",
            entry: "index.js",
            minAppVersion: "1.0.0",
            capabilities: ["commands", "ui", "future-unknown-capability"],
            settings: [{ key: "enabled", type: "toggle", label: "Enabled" }],
        };

        const result = parseManifest(input);

        expect(result).toEqual({
            id: "com.example.myplugin",
            name: "My Plugin",
            version: "1.2.3",
            description: "A test plugin",
            author: "Test Author",
            entry: "index.js",
            minAppVersion: "1.0.0",
            capabilities: ["commands", "ui", "future-unknown-capability"],
            settings: [{ key: "enabled", type: "toggle", label: "Enabled" }],
        });
    });

    it("drops unknown top-level keys", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test plugin",
            author: "Author",
            entry: "main.js",
            unknownField: "should be dropped",
            anotherUnknown: 123,
        };

        const result = parseManifest(input);

        expect(result).not.toHaveProperty("unknownField");
        expect(result).not.toHaveProperty("anotherUnknown");
        expect(Object.keys(result)).toEqual([
            "id",
            "name",
            "version",
            "description",
            "author",
            "entry",
        ]);
    });

    it("keeps unknown capability strings for forward compatibility", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test plugin",
            author: "Author",
            entry: "main.js",
            capabilities: [
                "commands",
                "future-capability-v2",
                "another-unknown",
            ],
        };

        const result = parseManifest(input);

        expect(result.capabilities).toEqual([
            "commands",
            "future-capability-v2",
            "another-unknown",
        ]);
    });

    it("throws on null input", () => {
        expect(() => parseManifest(null)).toThrow();
    });

    it("throws on array input", () => {
        expect(() => parseManifest([])).toThrow();
    });

    it("throws on string input", () => {
        expect(() => parseManifest("not an object")).toThrow();
    });

    it("throws on number input", () => {
        expect(() => parseManifest(42)).toThrow();
    });

    it("throws on missing id field with field name in message", () => {
        const input = {
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bid\b/);
    });

    it("throws on blank id field", () => {
        const input = {
            id: "   ",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bid\b/);
    });

    it("throws on missing name field", () => {
        const input = {
            id: "test.plugin",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bname\b/);
    });

    it("throws on missing version field", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bversion\b/);
    });

    it("throws on missing description field", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bdescription\b/);
    });

    it("throws on missing author field", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bauthor\b/);
    });

    it("throws on missing entry field", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
        };
        expect(() => parseManifest(input)).toThrow(/\bentry\b/);
    });

    it("throws on id containing a space", () => {
        const input = {
            id: "test plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bid\b/);
    });

    it("throws on id containing a slash", () => {
        const input = {
            id: "test/plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bid\b/);
    });

    it("throws on non-semver version", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        expect(() => parseManifest(input)).toThrow(/\bversion\b/);
    });

    it("throws on present-but-invalid minAppVersion", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
            minAppVersion: "not-a-semver",
        };
        expect(() => parseManifest(input)).toThrow(/\bminAppVersion\b/);
    });

    it("throws on capabilities that is not an array", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
            capabilities: "commands",
        };
        expect(() => parseManifest(input)).toThrow(/\bcapabilities\b/);
    });

    it("throws on capabilities containing a non-string element", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
            capabilities: ["commands", 123, "ui"],
        };
        expect(() => parseManifest(input)).toThrow(/\bcapabilities\b/);
    });

    it("throws on settings that is not an array", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
            settings: { key: "value" },
        };
        expect(() => parseManifest(input)).toThrow(/\bsettings\b/);
    });

    it("omits optional fields when they are not present", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test plugin",
            author: "Author",
            entry: "main.js",
        };

        const result = parseManifest(input);

        expect(result).not.toHaveProperty("minAppVersion");
        expect(result).not.toHaveProperty("capabilities");
        expect(result).not.toHaveProperty("settings");
        expect(Object.keys(result)).toEqual([
            "id",
            "name",
            "version",
            "description",
            "author",
            "entry",
        ]);
    });

    it("accepts a valid semver version with prerelease", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0-beta.1",
            description: "Test",
            author: "Author",
            entry: "main.js",
        };
        const result = parseManifest(input);
        expect(result.version).toBe("1.0.0-beta.1");
    });

    it("trims whitespace from required string fields", () => {
        const input = {
            id: "  test.plugin  ",
            name: "  Test  ",
            version: "  1.0.0  ",
            description: "  Test  ",
            author: "  Author  ",
            entry: "  main.js  ",
        };
        const result = parseManifest(input);
        expect(result.id).toBe("test.plugin");
        expect(result.name).toBe("Test");
        expect(result.version).toBe("1.0.0");
    });

    it("accepts an id that matches the reverse-DNS pattern", () => {
        const validIds = [
            "com.example.plugin",
            "org.test.my-plugin",
            "io.github.user_plugin",
            "plugin123",
            "P.L.U.G.I.N",
        ];

        for (const id of validIds) {
            const input = {
                id,
                name: "Test",
                version: "1.0.0",
                description: "Test",
                author: "Author",
                entry: "main.js",
            };
            expect(() => parseManifest(input)).not.toThrow();
        }
    });

    it("accepts valid minAppVersion", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
            minAppVersion: "1.4.0",
        };
        const result = parseManifest(input);
        expect(result.minAppVersion).toBe("1.4.0");
    });

    it("accepts an empty capabilities array", () => {
        const input = {
            id: "test.plugin",
            name: "Test",
            version: "1.0.0",
            description: "Test",
            author: "Author",
            entry: "main.js",
            capabilities: [],
        };
        const result = parseManifest(input);
        expect(result.capabilities).toEqual([]);
    });
});
