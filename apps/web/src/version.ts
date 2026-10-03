/** La pone el build (vite.config.ts, desde package.json); en los tests de vitest no existe. */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'desarrollo';
