// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }

    /** App version, injected from package.json at build time (see vite.config.ts). */
    const __APP_VERSION__: string;
}

export {};
