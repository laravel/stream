import { defineConfig } from "vitest/config";
import { svelteModule } from "./vite-plugin-svelte-module";

export default defineConfig({
    plugins: [svelteModule()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./tests/mock.ts"],
    },
});
