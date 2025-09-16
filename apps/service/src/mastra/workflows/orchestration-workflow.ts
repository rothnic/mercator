import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const requirementsSchema = z
  .object({
    requiresHumanApproval: z.boolean().default(false),
    maxExecutionTime: z.number().int().positive().default(300),
    priority: z.enum(['high', 'medium', 'low']).default('medium')
  })
  .optional();

const subtaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  agent: z.enum(['researchAgent', 'analysisAgent']),
  dependencies: z.array(z.string()),
  estimatedTime: z.number().int().nonnegative()
});

const executionPlanSchema = z.object({
  mode: z.enum(['parallel', 'sequential']),
  requiresApproval: z.boolean()
});

const taskAnalysisStep = createStep({
  id: 'task-analysis',
  description: 'Analyze the goal and create a structured execution plan.',
  inputSchema: z.object({
    task: z.string().min(1, 'Task description is required'),
    requirements: requirementsSchema
  }),
  outputSchema: z.object({
    subtasks: z.array(subtaskSchema),
    executionPlan: executionPlanSchema,
    analysis: z.string()
  }),
  execute: async ({ inputData, mastra }) => {
    const orchestrator = mastra?.getAgent('orchestratorAgent' as never);
    if (!orchestrator) {
      throw new Error('Orchestrator agent is not registered');
    }

    const analysisPrompt = `Analyze this task and build a plan:\n\nTask: ${inputData.task}\nRequirements: ${JSON.stringify(
      inputData.requirements ?? {}
    )}\n\nDescribe the recommended execution strategy.`;
    const analysisResult = await orchestrator.generate([
      {
        role: 'user',
        content: analysisPrompt
      }
    ]);

    const subtasks: z.infer<typeof subtaskSchema>[] = [
      {
        id: 'research-phase',
        description: 'Research and gather relevant information for the requested topic.',
        agent: 'researchAgent' as const,
        dependencies: [] as string[],
        estimatedTime: 120
      },
      {
        id: 'analysis-phase',
        description: 'Synthesize research findings and prepare recommendations.',
        agent: 'analysisAgent' as const,
        dependencies: ['research-phase'],
        estimatedTime: 180
      }
    ];

    const requiresHumanApproval = inputData.requirements?.requiresHumanApproval ?? false;
    const planMode: 'parallel' | 'sequential' = subtasks.some(
      (task) => task.dependencies.length > 0
    )
      ? 'sequential'
      : 'parallel';

    return {
      subtasks,
      executionPlan: {
        mode: planMode,
        requiresApproval: requiresHumanApproval
      },
      analysis: analysisResult.text ?? ''
    };
  }
});

const approvalGateStep = createStep({
  id: 'approval-gate',
  description: 'Optionally suspend execution until a reviewer approves the plan.',
  inputSchema: z.object({
    subtasks: z.array(subtaskSchema),
    executionPlan: executionPlanSchema,
    analysis: z.string()
  }),
  resumeSchema: z.object({
    approved: z.boolean(),
    modifications: z.string().optional(),
    feedback: z.string().optional()
  }),
  suspendSchema: z.object({
    reason: z.string(),
    planSummary: z.string(),
    estimatedTime: z.string()
  }),
  outputSchema: z.object({
    subtasks: z.array(subtaskSchema),
    executionPlan: executionPlanSchema,
    analysis: z.string(),
    approved: z.boolean(),
    feedback: z.string().optional(),
    modifiedPlan: z.string().optional()
  }),
  execute: async (params) => {
    const { inputData, resumeData } = params;
    if (!inputData.executionPlan.requiresApproval) {
      return {
        subtasks: inputData.subtasks,
        executionPlan: inputData.executionPlan,
        analysis: inputData.analysis,
        approved: true,
        feedback: undefined,
        modifiedPlan: undefined
      };
    }
    if (!resumeData) {
      const totalMinutes = Math.round(
        inputData.subtasks.reduce((total, task) => total + task.estimatedTime, 0) / 60
      );

      await params.suspend({
        reason: 'Human approval required before task execution',
        planSummary: `Execute ${inputData.subtasks.length} subtasks in ${inputData.executionPlan.mode} mode`,
        estimatedTime: `${Math.max(totalMinutes, 1)} minutes`
      });
    }

    return {
      subtasks: inputData.subtasks,
      executionPlan: inputData.executionPlan,
      analysis: inputData.analysis,
      approved: resumeData?.approved ?? false,
      feedback: resumeData?.feedback,
      modifiedPlan: resumeData?.modifications
    };
  }
});

const parallelExecutionStep = createStep({
  id: 'task-execution',
  description: 'Execute subtasks using the assigned specialist agents.',
  inputSchema: z.object({
    subtasks: z.array(subtaskSchema),
    executionPlan: executionPlanSchema,
    analysis: z.string(),
    approved: z.boolean(),
    feedback: z.string().optional(),
    modifiedPlan: z.string().optional()
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        taskId: z.string(),
        status: z.enum(['success', 'failed']),
        result: z.any(),
        executionTime: z.number().int().nonnegative()
      })
    ),
    summary: z.string(),
    analysis: z.string()
  }),
  execute: async ({ inputData, mastra }) => {
    if (inputData.approved === false) {
      return {
        results: [],
        summary: 'Execution cancelled by human reviewer',
        analysis: inputData.analysis
      };
    }

    const results: {
      taskId: string;
      status: 'success' | 'failed';
      result: unknown;
      executionTime: number;
    }[] = [];

    const mastraInstance = mastra ?? null;

    const runTask = async (task: z.infer<typeof subtaskSchema>, context: string) => {
      if (!mastraInstance) {
        throw new Error('Mastra instance is not available inside workflow execution');
      }

      const agent = mastraInstance.getAgent(task.agent as never);
      const startTime = Date.now();
      try {
        const response = await agent.generate([
          {
            role: 'user',
            content: context
          }
        ]);

        results.push({
          taskId: task.id,
          status: 'success',
          result: response.text ?? '',
          executionTime: Date.now() - startTime
        });
      } catch (error) {
        results.push({
          taskId: task.id,
          status: 'failed',
          result: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime
        });
      }
    };

    const independent = inputData.subtasks.filter((task) => task.dependencies.length === 0);
    const dependent = inputData.subtasks.filter((task) => task.dependencies.length > 0);

    if (independent.length > 0) {
      await Promise.all(
        independent.map((task) =>
          runTask(
            task,
            `Execute this task: ${task.description}\n\nProvide structured findings that can be reused by other agents.`
          )
        )
      );
    }

    for (const task of dependent) {
      const previousResults = task.dependencies
        .map((dependencyId) => results.find((result) => result.taskId === dependencyId)?.result)
        .filter((value): value is string => typeof value === 'string');

      const context = `Execute this task: ${task.description}\n\nPrevious results to consider:\n${
        previousResults.length > 0
          ? previousResults.map((entry, index) => `Dependency ${index + 1}: ${entry}`).join('\n')
          : 'No previous results available.'
      }`;

      await runTask(task, context);
    }

    const successes = results.filter((result) => result.status === 'success').length;
    const summary = `Executed ${results.length} tasks: ${successes} succeeded, ${
      results.length - successes
    } failed.`;

    return {
      results,
      summary,
      analysis: inputData.analysis
    };
  }
});

const resultsCompilationStep = createStep({
  id: 'results-compilation',
  description: 'Compile a final report using orchestrator insights.',
  inputSchema: z.object({
    results: z.array(
      z.object({
        taskId: z.string(),
        status: z.enum(['success', 'failed']),
        result: z.any(),
        executionTime: z.number().int().nonnegative()
      })
    ),
    summary: z.string(),
    analysis: z.string()
  }),
  outputSchema: z.object({
    finalReport: z.string(),
    metrics: z.object({
      totalTasks: z.number(),
      successfulTasks: z.number(),
      failedTasks: z.number(),
      totalExecutionTime: z.number()
    }),
    recommendations: z.array(z.string())
  }),
  execute: async ({ inputData, mastra }) => {
    const orchestrator = mastra?.getAgent('orchestratorAgent' as never);
    if (!orchestrator) {
      throw new Error('Orchestrator agent is not registered');
    }

    const metrics = {
      totalTasks: inputData.results.length,
      successfulTasks: inputData.results.filter((result) => result.status === 'success').length,
      failedTasks: inputData.results.filter((result) => result.status === 'failed').length,
      totalExecutionTime: inputData.results.reduce(
        (total, result) => total + result.executionTime,
        0
      )
    };

    const prompt = `Please create a final report based on the following workflow output.\n\nOriginal Analysis: ${inputData.analysis}\nExecution Summary: ${inputData.summary}\n\nIndividual Task Results:\n${inputData.results
      .map(
        (result) =>
          `Task ${result.taskId} - Status: ${result.status}\nDetails: ${String(result.result)}\nElapsed: ${result.executionTime}ms`
      )
      .join('\n\n')}\n\nProvide:\n1. A concise summary of accomplishments.\n2. Key insights and findings.\n3. Recommendations for the next iteration.\n4. Any risks or issues uncovered.`;

    const report = await orchestrator.generate([
      {
        role: 'user',
        content: prompt
      }
    ]);

    const recommendations = new Set<string>();
    if (metrics.failedTasks > 0) {
      recommendations.add('Review failed subtasks to harden future runs.');
    }
    if (metrics.totalExecutionTime > 600000) {
      recommendations.add('Consider splitting long-running workflows into smaller units.');
    }
    if (metrics.successfulTasks === metrics.totalTasks && metrics.totalTasks > 0) {
      recommendations.add('Capture current plan as a reusable template.');
    }
    if (recommendations.size === 0) {
      recommendations.add('Monitor workflow outputs for drift and update tolerances as needed.');
    }

    return {
      finalReport: report.text ?? 'Workflow completed.',
      metrics,
      recommendations: Array.from(recommendations)
    };
  }
});

export const orchestrationWorkflow = createWorkflow({
  id: 'orchestration-workflow',
  description: 'Multi-agent orchestration workflow with optional human-in-the-loop review.',
  inputSchema: z.object({
    task: z.string().describe('Main task to execute'),
    requirements: requirementsSchema
  }),
  outputSchema: z.object({
    finalReport: z.string(),
    metrics: z.object({
      totalTasks: z.number(),
      successfulTasks: z.number(),
      failedTasks: z.number(),
      totalExecutionTime: z.number()
    }),
    recommendations: z.array(z.string())
  })
})
  .then(taskAnalysisStep)
  .then(approvalGateStep)
  .then(parallelExecutionStep)
  .then(resultsCompilationStep)
  .commit();
