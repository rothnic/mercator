import { RuntimeContext } from '@mastra/core/di';
import { mastra } from '../mastra';
import { orchestrationWorkflow } from '../mastra/workflows/orchestration-workflow';

type OrchestrationWorkflow = typeof orchestrationWorkflow;
type OrchestrationRun = Awaited<ReturnType<OrchestrationWorkflow['createRunAsync']>>;
type OrchestrationRunResult = Awaited<ReturnType<OrchestrationRun['start']>>;

export async function runBasicExample() {
  const runtimeContext = new RuntimeContext();
  const workflow: OrchestrationWorkflow = mastra.getWorkflow('orchestrationWorkflow');
  const run: OrchestrationRun = await workflow.createRunAsync();

  const result: OrchestrationRunResult = await run.start({
    inputData: {
      task: 'Research renewable energy market trends and recommend a go-to-market narrative.',
      requirements: {
        requiresHumanApproval: false,
        maxExecutionTime: 600,
        priority: 'high'
      }
    },
    runtimeContext
  });

  if (result.status === 'success') {
    console.warn('Final Report:', result.result.finalReport);
    console.warn('Metrics:', result.result.metrics);
    console.warn('Recommendations:', result.result.recommendations);
  } else {
    console.warn('Workflow execution status:', result.status);
  }
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  runBasicExample().catch((error) => {
    console.error('Workflow example failed:', error);
    process.exit(1);
  });
}
