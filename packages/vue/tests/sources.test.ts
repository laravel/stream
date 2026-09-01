import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const packages = ["vue", "react", "svelte"];
const root = join(import.meta.dirname, "..", "..");

const typescriptFilesIn = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);

        if (entry.isDirectory()) {
            return typescriptFilesIn(path);
        }

        return entry.name.endsWith(".ts") ? [path] : [];
    });

/**
 * The framework-agnostic sources are copied into each package rather than
 * shared, following the existing dispatch.ts / store.ts convention. Nothing
 * but this test stops one copy being fixed and the other two being forgotten.
 */
describe("shared sources", () => {
    const shared = ["csrf.ts", "events.ts", "jsonEvents.ts"];

    const digest = (pkg: string, file: string): string =>
        createHash("sha256")
            .update(readFileSync(join(root, pkg, "src", "streams", file)))
            .digest("hex");

    it.each(shared)("keeps %s identical across every package", (file) => {
        const digests = packages.map((pkg) => digest(pkg, file));

        expect(new Set(digests).size).toBe(1);
    });
});

describe("source files", () => {
    /**
     * A NUL written into a source file rather than escaped still
     * compiles, formats and passes tests, but turns the file binary to every
     * text tool that reads it.
     */
    it("contains no literal NUL bytes", () => {
        const offenders = packages
            .flatMap((pkg) => [
                ...typescriptFilesIn(join(root, pkg, "src")),
                ...typescriptFilesIn(join(root, pkg, "tests")),
            ])
            .filter((path) => readFileSync(path).includes(0))
            .map((path) => relative(root, path));

        expect(offenders).toEqual([]);
    });
});
