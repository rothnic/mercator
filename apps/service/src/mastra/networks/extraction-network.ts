import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import { Agent } from '@mastra/core/agent';
import { MastraBase } from '@mastra/core/base';
import { RegisteredLogger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import type { AgentNetwork, AgentNetworkConfig } from '@mastra/core/network';
import { NewAgentNetwork } from '@mastra/core/network/vNext';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { createTool, type Tool } from '@mastra/core/tools';

import { ingestionAgent } from '../agents/ingestion-agent';
import { targetModelerAgent } from '../agents/target-modeler-agent';
import { selectorAgent } from '../agents/selector-agent';
import { evaluationAgent } from '../agents/evaluation-agent';
import { DEFAULT_OPENAI_MODEL } from '../models';

const sanitizeAgentId = (name: string): string => name.replace(/[^a-zA-Z0-9_-]/g, '_');

const ROUTER_INSTRUCTIONS = `
    Coordinate Mercator's document-ingestion workflow exactly as outlined in the Mastra AgentNetwork documentation.
    The expected sequence is:
    1. ingestionAgent → scrape the URL via Firecrawl and register the workspace.
    2. targetModelerAgent → craft/merge the Product target draft from screenshot + markdown evidence.
    3. selectorAgent → propose selectors, register rules, and iterate with evaluations until fields align.
    4. evaluationAgent → confirm matches, highlight gaps, and signal readiness.

    Always preserve context between steps by setting includeHistory=true when handing off to downstream agents.
    Produce concise routing rationales so the primary orchestrator can display clear progress to the user.
  `;

const SPECIALIST_AGENTS = [ingestionAgent, targetModelerAgent, selectorAgent, evaluationAgent] as const;

interface AgentInteraction {
  readonly input: string;
  readonly output: string;
  readonly timestamp: string;
}

export class MercatorAgentNetwork extends MastraBase implements AgentNetwork {
  private readonly instructions: string;
  private readonly model: AgentNetworkConfig['model'];
  private readonly agents: Agent[];
  private readonly routingAgent: Agent;
  private readonly agentDirectory = new Map<string, Agent>();
  private readonly agentHistory = new Map<string, AgentInteraction[]>();
  private readonly tools: { transmit: Tool };

  constructor(config: AgentNetworkConfig) {
    super({ component: RegisteredLogger.NETWORK, name: config.name || 'MercatorAgentNetwork' });

    this.instructions = config.instructions;
    this.model = config.model;
    this.agents = [...config.agents];

    for (const agent of this.agents) {
      this.agentDirectory.set(this.formatAgentId(agent.name), agent);
    }

    this.tools = {
      transmit: createTool({
        id: 'transmit',
        description: 'Call one or more specialized agents to handle specific tasks.',
        inputSchema: z.object({
          actions: z.array(
            z.object({
              agent: z.string().describe('The identifier of the agent to call.'),
              input: z.string().describe('The user-facing instructions to pass to the agent.'),
              includeHistory: z.boolean().optional().describe('Include previous agent outputs as context.')
            })
          )
        }),
        execute: async ({ context, runtimeContext }) => {
          const actions = context.actions;
          this.logger.debug('Routing transmit actions', { count: actions.length });

          const results = await Promise.all(
            actions.map((action) =>
              this.executeAgent(action.agent, action.input, action.includeHistory ?? false, runtimeContext)
            )
          );

          actions.forEach((action, index) =>
            this.recordInteraction(action.agent, action.input, results[index] ?? '')
          );

          return actions
            .map((action, index) => `[${action.agent}]: ${results[index] ?? ''}`)
            .join('\n\n');
        }
      })
    };

    this.routingAgent = new Agent({
      name: config.name,
      instructions: this.getInstructions(),
      model: this.model,
      tools: this.tools,
      defaultGenerateOptions: {
        tracingOptions: {
          metadata: {
            agentId: this.formatAgentId(config.name),
            networkRole: 'router'
          }
        }
      },
      defaultStreamOptions: {
        tracingOptions: {
          metadata: {
            agentId: this.formatAgentId(config.name),
            networkRole: 'router'
          }
        }
      }
    });
  }

  formatAgentId(name: string): string {
    return sanitizeAgentId(name);
  }

  private resolveAgent(agentId: string): Agent | undefined {
    const sanitized = this.formatAgentId(agentId);
    return this.agentDirectory.get(sanitized);
  }

  private recordInteraction(agentId: string, input: string, output: string): void {
    const sanitized = this.formatAgentId(agentId);
    const history = this.agentHistory.get(sanitized) ?? [];
    history.push({
      input,
      output,
      timestamp: new Date().toISOString()
    });
    this.agentHistory.set(sanitized, history);
  }

  private buildHistoryPrompt(): string | undefined {
    if (this.agentHistory.size === 0) {
      return undefined;
    }

    const lines: string[] = [];
    for (const [agentId, interactions] of this.agentHistory.entries()) {
      lines.push(`## ${agentId}`);
      interactions.forEach((interaction, index) => {
        lines.push(
          `Interaction ${index + 1} (${interaction.timestamp}):`,
          `- Input: ${interaction.input}`,
          `- Output: ${interaction.output}`
        );
      });
      lines.push('');
    }

    return `Previous agent interactions:\n\n${lines.join('\n')}`.trim();
  }

  private resetHistory(): void {
    this.agentHistory.clear();
  }

  getTools(): { transmit: Tool } {
    return this.tools;
  }

  getAgentHistory(agentId: string): AgentInteraction[] {
    const sanitized = this.formatAgentId(agentId);
    return (this.agentHistory.get(sanitized) ?? []).map((entry) => ({ ...entry }));
  }

  getAgentInteractionHistory(): Record<string, AgentInteraction[]> {
    const snapshot: Record<string, AgentInteraction[]> = {};
    for (const [agentId, interactions] of this.agentHistory.entries()) {
      snapshot[agentId] = interactions.map((entry) => ({ ...entry }));
    }
    return snapshot;
  }

  getAgentInteractionSummary(): string {
    if (this.agentHistory.size === 0) {
      return 'No agent interactions have occurred yet.';
    }

    const combined: { agentId: string; interaction: AgentInteraction; order: number }[] = [];
    let sequence = 0;
    for (const [agentId, interactions] of this.agentHistory.entries()) {
      interactions.forEach((interaction) => {
        combined.push({ agentId, interaction, order: sequence++ });
      });
    }

    combined.sort((left, right) => {
      const leftTime = Date.parse(left.interaction.timestamp);
      const rightTime = Date.parse(right.interaction.timestamp);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
        return leftTime - rightTime;
      }
      return left.order - right.order;
    });

    const summaryLines = combined.map((entry, index) => {
      const { agentId, interaction } = entry;
      const timestamp = interaction.timestamp || 'No timestamp';
      const truncatedInput = interaction.input.length > 120
        ? `${interaction.input.slice(0, 117)}...`
        : interaction.input;
      const truncatedOutput = interaction.output.length > 120
        ? `${interaction.output.slice(0, 117)}...`
        : interaction.output;
      return `## Step ${index + 1}: Agent ${agentId} at ${timestamp}\n` +
        `**Input:** ${truncatedInput}\n\n**Output:** ${truncatedOutput}`;
    });

    return ['# Chronological Agent Interactions', ...summaryLines].join('\n\n');
  }

  private async executeAgent(
    agentId: string,
    instruction: string,
    includeHistory = false,
    runtimeContext?: RuntimeContext
  ): Promise<string> {
    try {
      const agent = this.resolveAgent(agentId);
      if (!agent) {
        const available = Array.from(this.agentDirectory.keys());
        throw new Error(`Agent "${agentId}" not found. Available agents: ${available.join(', ')}`);
      }

      const historyPrompt = includeHistory ? this.buildHistoryPrompt() : undefined;
      const prompt = historyPrompt ? `${historyPrompt}\n\n${instruction}` : instruction;
      const messages = [{ role: 'user', content: prompt }];

      const result = await agent.generate(messages, {
        runtimeContext,
        tracingOptions: {
          metadata: {
            agentId: this.formatAgentId(agent.name),
            networkRole: 'specialist',
            routedBy: this.formatAgentId(this.routingAgent.name),
            includeHistory
          }
        }
      });
      return result.text ?? '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Error executing agent', { agentId, message });
      return `Unable to execute agent "${agentId}": ${message}`;
    }
  }

  getInstructions(): string {
    const agentDetails = this.agents
      .map((agent) => ` - **${this.formatAgentId(agent.name)}**: ${agent.name}`)
      .join('\n');

    return `
          You are a router in a network of specialized AI agents.
          Your job is to decide which agent should handle each step of a task.

          ## System Instructions
          ${this.instructions}

          ## Available Specialized Agents
          You can call these agents using the "transmit" tool:
          ${agentDetails}

          ## How to Use the "transmit" Tool
          Provide a JSON payload with an array of actions. Each action specifies the agent identifier, the input to send, and whether to include history.
        `;
  }

  getRoutingAgent(): Agent {
    return this.routingAgent;
  }

  getAgents(): Agent[] {
    return [...this.agents];
  }

  generate(...args: Parameters<Agent['generate']>): ReturnType<Agent['generate']> {
    this.resetHistory();
    return this.routingAgent.generate(...args);
  }

  stream(...args: Parameters<Agent['stream']>): ReturnType<Agent['stream']> {
    this.resetHistory();
    return this.routingAgent.stream(...args);
  }

  __registerMastra(mastra: Mastra): void {
    this.__setLogger(mastra.getLogger());
    this.routingAgent.__registerMastra(mastra);
    for (const agent of this.agents) {
      if (typeof agent.__registerMastra === 'function') {
        agent.__registerMastra(mastra);
      }
    }
  }
}

export const legacyExtractionNetwork = new MercatorAgentNetwork({
  name: 'legacy-extraction-network',
  model: openai(DEFAULT_OPENAI_MODEL),
  instructions: ROUTER_INSTRUCTIONS,
  agents: [...SPECIALIST_AGENTS]
});

const createSpecialistDirectory = (): Record<string, Agent> => {
  const directory: Record<string, Agent> = {};
  for (const agent of SPECIALIST_AGENTS) {
    directory[sanitizeAgentId(agent.name)] = agent;
  }
  return directory;
};

export const extractionNetwork = new NewAgentNetwork({
  id: 'extraction-network',
  name: 'Mercator Extraction Network',
  instructions: ROUTER_INSTRUCTIONS,
  model: () => openai(DEFAULT_OPENAI_MODEL),
  agents: () => createSpecialistDirectory()
});
