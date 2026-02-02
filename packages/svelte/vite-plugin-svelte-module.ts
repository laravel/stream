import { compileModule } from "svelte/compiler";
import type { Plugin } from "vite";

/**
 * Compiles .svelte.ts (and .svelte.js) files with Svelte's compileModule so runes
 * ($state, $effect) are transformed correctly. TypeScript is stripped first
 * since compileModule's parser expects JavaScript.
 */
export function svelteModule(): Plugin {
    return {
        name: "vite-plugin-svelte-module",
        enforce: "pre",
        async transform(code, id) {
            if (!id.endsWith(".svelte.ts") && !id.endsWith(".svelte.js")) {
                return null;
            }

            let jsCode = code;

            if (id.endsWith(".svelte.ts")) {
                const { transform } = await import("esbuild");
                const transpiled = await transform(code, {
                    loader: "ts",
                    format: "esm",
                    target: "es2020",
                });
                jsCode = transpiled.code;
            }

            const result = compileModule(jsCode, {
                filename: id,
                generate: "client",
            });

            if (result.warnings.length > 0) {
                for (const w of result.warnings) {
                    this.warn({
                        message: w.message,
                        id,
                        position:
                            w.start && w.end
                                ? { start: w.start, end: w.end }
                                : undefined,
                    });
                }
            }

            return {
                code: result.js.code,
                map: result.js.map ?? undefined,
            };
        },
    };
}
