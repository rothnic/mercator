// Ensure the generated telemetry loader can access a global `mastra` binding
// even before the Mastra instance module executes. The bundler-generated
// `telemetry-config.mjs` assumes this binding exists and will throw a
// ReferenceError otherwise. We only need the symbol to exist; the actual
// Mastra instance is registered later when `src/mastra/index.ts` runs.
import { Agent } from '@mastra/core/agent';

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

const agentPrototype = Agent.prototype;

if (
  !agentPrototype.__mercatorStreamPatched &&
  typeof agentPrototype.stream === 'function' &&
  typeof agentPrototype.streamVNext === 'function'
) {
  const originalStream = agentPrototype.stream;

  agentPrototype.stream = async function patchedStream(messages, options) {
    try {
      const runtimeContext = options?.runtimeContext;
      const resolvedModel =
        typeof this.getModel === 'function'
          ? runtimeContext !== undefined
            ? await this.getModel({ runtimeContext })
            : await this.getModel()
          : typeof this.model === 'function'
            ? await this.model({ runtimeContext })
            : this.model;

      if (
        resolvedModel &&
        typeof resolvedModel === 'object' &&
        'specificationVersion' in resolvedModel &&
        resolvedModel.specificationVersion === 'v2' &&
        typeof this.streamVNext === 'function'
      ) {
        return this.streamVNext(messages, options);
      }
    } catch (error) {
      // Fall back to the original streaming implementation if the model
      // resolution fails for any reason.
    }

    return originalStream.call(this, messages, options);
  };

  Object.defineProperty(agentPrototype, '__mercatorStreamPatched', {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false
  });
}
