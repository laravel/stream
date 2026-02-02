import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { svelteModule } from "./vite-plugin-svelte-module";

export default defineConfig({
    plugins: [
        svelteModule(),
        dts({
            insertTypesEntry: true,
            rollupTypes: true,
            include: ["src/**/*.ts", "src/**/*.svelte.ts"],
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "LaravelStreamSvelte",
            fileName: (format) => `index.${format}.js`,
        },
        rollupOptions: {
            external: ["svelte"],
            output: {
                globals: {
                    svelte: "Svelte",
                },
            },
        },
    },
});
