import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { analysisAgent } from './agents/analysis-agent';
import { orchestratorAgent } from './agents/orchestrator-agent';
import { researchAgent } from './agents/research-agent';
import { createRecipeAgent } from './agents/recipe-agent';
import { orchestrationWorkflow } from './workflows/orchestration-workflow';
import { storage } from './stores';

type MercatorMastraInstance = Mastra<
  {
    orchestratorAgent: typeof orchestratorAgent;
    researchAgent: typeof researchAgent;
    analysisAgent: typeof analysisAgent;
    recipeAgent: ReturnType<typeof createRecipeAgent>;
  },
  Record<string, never>,
  {
    orchestrationWorkflow: typeof orchestrationWorkflow;
  }
>;

declare global {
  // The dev server preloads a shim that defines a global `mastra` binding so
  // Mastra's generated telemetry loader can safely reference it during
  // initialization.
  var mastra: MercatorMastraInstance | undefined;
}

export const mastra: MercatorMastraInstance = new Mastra({
  agents: {
    orchestratorAgent,
    researchAgent,
    analysisAgent,
    recipeAgent: createRecipeAgent()
  },
  workflows: {
    orchestrationWorkflow
  },
  storage,
  telemetry: {
    enabled: false,
    disableLocalExport: true
  },
  logger: new PinoLogger({
    name: 'MercatorOrchestrator',
    level: 'info'
  })
} satisfies ConstructorParameters<typeof Mastra>[0]);

globalThis.mastra = mastra;

export type MercatorMastra = typeof mastra;
export default mastra;
