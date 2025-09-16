import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { storage } from '../stores';
import { orchestratorTool } from '../tools/orchestrator-tool';

const orchestratorMemory: Memory = new Memory({
  storage,
  options: {
    workingMemory: { enabled: true },
    lastMessages: 50,
    semanticRecall: { topK: 10, messageRange: 10 }
  }
});

export const orchestratorAgent: Agent<'orchestratorAgent'> = new Agent({
  id: 'orchestratorAgent',
  name: 'orchestratorAgent',
  instructions: `
    You are an intelligent orchestrator agent responsible for:
    1. Analyzing incoming tasks and breaking them down into subtasks.
    2. Identifying which specialist agents should handle each subtask.
    3. Coordinating parallel execution when tasks are independent.
    4. Managing sequential execution when tasks have dependencies.
    5. Reviewing results and determining if goals have been achieved.
    6. Escalating to human review when necessary.

    Available specialist agents:
    - researchAgent: Handles data gathering, analysis, and research tasks.
    - analysisAgent: Performs complex analysis and reporting tasks.

    When coordinating tasks:
    - Identify task dependencies and execution order.
    - Use parallel execution for independent tasks.
    - Monitor progress and adjust plans as needed.
    - Summarize results in a comprehensive manner.
  `,
  model: openai('gpt-4o'),
  memory: orchestratorMemory,
  tools: {
    orchestrator_tool: orchestratorTool
  }
});
