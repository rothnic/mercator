import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { analysisAgent } from './agents/analysis-agent';
import { orchestratorAgent } from './agents/orchestrator-agent';
import { researchAgent } from './agents/research-agent';
import { orchestrationWorkflow } from './workflows/orchestration-workflow';
import { storage } from './stores';

type MercatorMastraInstance = Mastra<
  {
    orchestratorAgent: typeof orchestratorAgent;
    researchAgent: typeof researchAgent;
    analysisAgent: typeof analysisAgent;
  },
  Record<string, never>,
  {
    orchestrationWorkflow: typeof orchestrationWorkflow;
  }
>;

const mastraConfig = {
  agents: {
    orchestratorAgent,
    researchAgent,
    analysisAgent
  },
  workflows: {
    orchestrationWorkflow
  },
  storage,
  logger: new PinoLogger({
    name: 'MercatorOrchestrator',
    level: 'info'
  })
} satisfies ConstructorParameters<typeof Mastra>[0];

export const mastra: MercatorMastraInstance = new Mastra(mastraConfig);

export type MercatorMastra = typeof mastra;
export default mastra;
