import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { orchestratorAgent } from './agents/orchestrator-agent';
import { ingestionAgent } from './agents/ingestion-agent';
import { targetModelerAgent } from './agents/target-modeler-agent';
import { selectorAgent } from './agents/selector-agent';
import { evaluationAgent } from './agents/evaluation-agent';
import { createRecipeAgent } from './agents/recipe-agent';
import { orchestrationWorkflow } from './workflows/orchestration-workflow';
import { storage } from './stores';
import { extractionNetwork } from './networks/extraction-network';

type MercatorMastraInstance = Mastra<
  {
    orchestratorAgent: typeof orchestratorAgent;
    ingestionAgent: typeof ingestionAgent;
    targetModelerAgent: typeof targetModelerAgent;
    selectorAgent: typeof selectorAgent;
    evaluationAgent: typeof evaluationAgent;
    recipeAgent: ReturnType<typeof createRecipeAgent>;
  },
  Record<string, never>,
  {
    orchestrationWorkflow: typeof orchestrationWorkflow;
  },
  Record<string, never>,
  Record<string, never>,
  PinoLogger,
  {
    extractionNetwork: typeof extractionNetwork;
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
    ingestionAgent,
    targetModelerAgent,
    selectorAgent,
    evaluationAgent,
    recipeAgent: createRecipeAgent()
  },
  networks: {
    extractionNetwork
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
