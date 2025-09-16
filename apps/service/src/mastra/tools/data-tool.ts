import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

type SimulatedRecord = Record<string, unknown> & { id: number; query: string; data: string; timestamp: string };

const wait = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulateDatabaseQuery(query: string, limit: number): Promise<SimulatedRecord[]> {
  await wait(100);
  return Array.from({ length: Math.min(limit, 10) }, (_, index) => ({
    id: index + 1,
    query,
    data: `Database result ${index + 1}`,
    timestamp: new Date().toISOString()
  }));
}

async function simulateApiCall(query: string, limit: number): Promise<SimulatedRecord[]> {
  await wait(200);
  return Array.from({ length: Math.min(limit, 5) }, (_, index) => ({
    id: index + 1,
    query,
    data: `API result ${index + 1}`,
    timestamp: new Date().toISOString()
  }));
}

async function simulateFileRead(query: string, limit: number): Promise<SimulatedRecord[]> {
  await wait(50);
  return Array.from({ length: Math.min(limit, 20) }, (_, index) => ({
    id: index + 1,
    query,
    data: `File result ${index + 1}`,
    timestamp: new Date().toISOString()
  }));
}

export const dataTool = createTool({
  id: 'data-tool',
  description: 'Retrieves and processes data from simulated sources to support deterministic testing.',
  inputSchema: z.object({
    query: z.string().min(1, 'A query is required'),
    source: z.enum(['database', 'api', 'file']),
    filters: z.record(z.any()).optional(),
    limit: z.number().int().positive().max(100).default(25)
  }),
  outputSchema: z.object({
    data: z.array(z.record(z.any())),
    metadata: z.object({
      totalRecords: z.number(),
      source: z.string(),
      queryTime: z.number()
    }),
    status: z.string()
  }),
  execute: async (executionContext) => {
    const { query, source, limit } = executionContext.context;
    const startTime = Date.now();

    let data: SimulatedRecord[] = [];
    switch (source) {
      case 'database':
        data = await simulateDatabaseQuery(query, limit ?? 25);
        break;
      case 'api':
        data = await simulateApiCall(query, limit ?? 25);
        break;
      case 'file':
        data = await simulateFileRead(query, limit ?? 25);
        break;
      default:
        data = [];
    }

    const queryTime = Date.now() - startTime;

    return {
      data,
      metadata: {
        totalRecords: data.length,
        source,
        queryTime
      },
      status: 'Data retrieved successfully'
    };
  }
});
