import { Agent, type MastraLanguageModel } from '@mastra/core/agent';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';

const DEFAULT_INSTRUCTIONS = [
  'You are the Mercator recipe synthesis specialist.',
  'You receive product documents and must generate CSS selector recipes that extract structured product data.',
  'Call the `generate_recipe` tool exactly once per run and return the JSON payload it produces without modification.'
].join('\n');

export interface RecipeAgentOptions {
  readonly model?: MastraLanguageModel;
}

export const createRecipeAgent = (options?: RecipeAgentOptions): Agent<'recipeAgent'> => {
  const model =
    options?.model ??
    (createMockModel({ objectGenerationMode: 'json', mockText: { status: 'ready' } }) as MastraLanguageModel);

  return new Agent({
    id: 'recipeAgent',
    name: 'recipeAgent',
    instructions: DEFAULT_INSTRUCTIONS,
    model
  });
};
