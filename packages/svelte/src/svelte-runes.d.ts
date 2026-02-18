/**
 * In .svelte.ts files, runes are used as bare identifiers (no import).
 * The Svelte compiler transforms them. These global types allow TypeScript
 * to type-check our source when building the library.
 */
declare const $state: <T>(initial?: T) => T;
declare const $effect: ((fn: () => void | (() => void)) => void) & {
    root: (fn: () => void | (() => void)) => () => void;
};
