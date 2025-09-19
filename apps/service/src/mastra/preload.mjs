// Ensure the generated telemetry loader can access a global `mastra` binding
// even before the Mastra instance module executes. The bundler-generated
// `telemetry-config.mjs` assumes this binding exists and will throw a
// ReferenceError otherwise. We only need the symbol to exist; the actual
// Mastra instance is registered later when `src/mastra/index.ts` runs.
if (!Object.getOwnPropertyDescriptor(globalThis, 'mastra')) {
  Object.defineProperty(globalThis, 'mastra', {
    configurable: true,
    enumerable: false,
    get() {
      return globalThis.___mastra_instance;
    },
    set(value) {
      globalThis.___mastra_instance = value;
    }
  });
}
