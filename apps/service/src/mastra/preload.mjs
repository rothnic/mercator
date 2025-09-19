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

async function resolveAgentModel(agentInstance, runtimeContext) {
  if (typeof agentInstance.getModel === 'function') {
    return runtimeContext !== undefined
      ? agentInstance.getModel({ runtimeContext })
      : agentInstance.getModel();
  }

  if (typeof agentInstance.model === 'function') {
    return agentInstance.model({ runtimeContext });
  }

  return agentInstance.model;
}

function isV2Model(resolvedModel) {
  return (
    resolvedModel !== null &&
    typeof resolvedModel === 'object' &&
    'specificationVersion' in resolvedModel &&
    resolvedModel.specificationVersion === 'v2'
  );
}

if (
  !agentPrototype.__mercatorStreamPatched &&
  typeof agentPrototype.stream === 'function' &&
  typeof agentPrototype.streamVNext === 'function'
) {
  const originalStream = agentPrototype.stream;

  agentPrototype.stream = async function patchedStream(messages, options) {
    try {
      const resolvedModel = await resolveAgentModel(
        this,
        options?.runtimeContext
      );

      if (isV2Model(resolvedModel) && typeof this.streamVNext === 'function') {
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

if (
  !agentPrototype.__mercatorGeneratePatched &&
  typeof agentPrototype.generate === 'function' &&
  typeof agentPrototype.generateVNext === 'function'
) {
  const originalGenerate = agentPrototype.generate;

  agentPrototype.generate = async function patchedGenerate(input, options) {
    try {
      const resolvedModel = await resolveAgentModel(
        this,
        options?.runtimeContext
      );

      if (isV2Model(resolvedModel) && typeof this.generateVNext === 'function') {
        return this.generateVNext(input, options);
      }
    } catch (error) {
      // Fall back to the original generate implementation if resolution fails.
    }

    return originalGenerate.call(this, input, options);
  };

  Object.defineProperty(agentPrototype, '__mercatorGeneratePatched', {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false
  });
}
