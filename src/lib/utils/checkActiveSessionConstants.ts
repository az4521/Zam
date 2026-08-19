/**
 * Pure guard for the active-session constants that are hand-mirrored across
 * TypeScript, JavaScript, and Java. Enforces that MAX_FUTURE_SKEW_MS and
 * MAX_GRACE_MS stay in sync across src/lib/utils/activeSession.ts,
 * static/sw.js, and MatrixMessagingService.java.
 */

const CONSTANTS = ["MAX_FUTURE_SKEW_MS", "MAX_GRACE_MS"] as const;

type ConstantName = (typeof CONSTANTS)[number];
type Format = "typescript" | "javascript" | "java";

/**
 * Extract the target constants from source code. Returns a map of constant
 * name → numeric value. Handles underscores in numeric literals (TS/JS) and
 * L suffix (Java).
 */
export function extractConstants(
    source: string,
    format: Format,
): Record<string, number> {
    const result: Record<string, number> = {};

    for (const name of CONSTANTS) {
        let pattern: RegExp;
        if (format === "typescript") {
            pattern = new RegExp(
                `export\\s+const\\s+${name}\\s*=\\s*([0-9_]+)`,
            );
        } else if (format === "javascript") {
            pattern = new RegExp(`const\\s+${name}\\s*=\\s*([0-9_]+)`);
        } else {
            // Java
            pattern = new RegExp(
                `private\\s+static\\s+final\\s+long\\s+${name}\\s*=\\s*([0-9_]+)L?`,
            );
        }

        const match = source.match(pattern);
        if (match) {
            const raw = match[1];
            const value = parseInt(raw.replace(/_/g, ""), 10);
            result[name] = value;
        }
    }

    return result;
}

export interface CheckResult {
    ok: boolean;
    mismatches: Array<{
        constant: ConstantName;
        values: Record<string, number | undefined>;
    }>;
}

/**
 * Check that all constants are present and match across all sources.
 * Sources is a map of file path (or label) → source code.
 */
export function checkActiveSessionSync(sources: {
    "activeSession.ts": string;
    "sw.js": string;
    "MatrixMessagingService.java": string;
}): CheckResult {
    const extracted = {
        "activeSession.ts": extractConstants(
            sources["activeSession.ts"],
            "typescript",
        ),
        "sw.js": extractConstants(sources["sw.js"], "javascript"),
        "MatrixMessagingService.java": extractConstants(
            sources["MatrixMessagingService.java"],
            "java",
        ),
    };

    const mismatches: CheckResult["mismatches"] = [];

    for (const name of CONSTANTS) {
        const values = {
            "activeSession.ts": extracted["activeSession.ts"][name],
            "sw.js": extracted["sw.js"][name],
            "MatrixMessagingService.java":
                extracted["MatrixMessagingService.java"][name],
        };

        const uniqueValues = new Set(
            Object.values(values).filter((v) => v !== undefined),
        );

        if (
            uniqueValues.size > 1 ||
            Object.values(values).some((v) => v === undefined)
        ) {
            mismatches.push({ constant: name, values });
        }
    }

    return {
        ok: mismatches.length === 0,
        mismatches,
    };
}
