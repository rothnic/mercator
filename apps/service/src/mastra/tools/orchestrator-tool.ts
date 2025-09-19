import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const subtaskSchema = z.object({
  id: z.string().min(1, 'Subtask id is required'),
  description: z.string().min(1, 'Subtask description is required'),
  agent: z.enum(['ingestionAgent', 'targetModelerAgent', 'selectorAgent', 'evaluationAgent']),
  dependencies: z.array(z.string()).optional().default([]),
  priority: z.enum(['high', 'medium', 'low']).default('medium')
});

export const orchestratorTool = createTool({
  id: 'orchestrator-tool',
  description: 'Coordinates task execution across multiple agents and checks dependency ordering.',
  inputSchema: z.object({
    task: z.string().min(1, 'Task description is required'),
    subtasks: z.array(subtaskSchema).min(1, 'Provide at least one subtask'),
    executionMode: z.enum(['parallel', 'sequential']).default('parallel')
  }),
  outputSchema: z.object({
    orchestrationPlan: z.object({
      totalTasks: z.number(),
      parallelGroups: z.array(z.array(z.string())),
      estimatedDuration: z.string()
    }),
    status: z.string()
  }),
  execute: (executionContext) => {
    const { context, mastra } = executionContext;
    const normalizedSubtasks = context.subtasks.map((subtask) => ({
      ...subtask,
      dependencies: subtask.dependencies ?? []
    }));

    const processed = new Set<string>();
    const parallelGroups: string[][] = [];

    if (context.executionMode === 'parallel') {
      const independentTasks = normalizedSubtasks.filter((task) => task.dependencies.length === 0);
      if (independentTasks.length > 0) {
        parallelGroups.push(independentTasks.map((task) => task.id));
        independentTasks.forEach((task) => processed.add(task.id));
      }

      let remaining = normalizedSubtasks.filter((task) => task.dependencies.length > 0);
      let safety = 0;

      while (remaining.length > 0 && safety <= normalizedSubtasks.length) {
        const ready = remaining.filter((task) => task.dependencies.every((dep) => processed.has(dep)));
        if (ready.length === 0) {
          break;
        }

        parallelGroups.push(ready.map((task) => task.id));
        ready.forEach((task) => processed.add(task.id));
        remaining = remaining.filter((task) => !processed.has(task.id));
        safety += 1;
      }

      const unresolved = normalizedSubtasks
        .filter((task) => !processed.has(task.id))
        .map((task) => task.id);

      if (unresolved.length > 0) {
        parallelGroups.push(...unresolved.map((taskId) => [taskId]));
      }
    } else {
      normalizedSubtasks.forEach((task) => {
        parallelGroups.push([task.id]);
        processed.add(task.id);
      });
    }

    const estimatedDuration = `${Math.max(parallelGroups.length, 1) * 2} minutes`;
    let status = 'Plan created successfully';

    const mastraInstance =
      mastra && typeof (mastra as { getAgent?: (name: string) => unknown }).getAgent === 'function'
        ? (mastra as { getAgent: (name: string) => unknown })
        : undefined;

    if (mastraInstance) {
      const missingAgents = new Set<string>();
      for (const subtask of normalizedSubtasks) {
        try {
          mastraInstance.getAgent(subtask.agent);
        } catch {
          missingAgents.add(subtask.agent);
        }
      }

      if (missingAgents.size > 0) {
        status = `Missing agents for subtasks: ${Array.from(missingAgents).join(', ')}`;
      }
    }

    if (parallelGroups.length === 0) {
      parallelGroups.push([]);
    }

    return Promise.resolve({
      orchestrationPlan: {
        totalTasks: normalizedSubtasks.length,
        parallelGroups,
        estimatedDuration
      },
      status
    });
  }
});
