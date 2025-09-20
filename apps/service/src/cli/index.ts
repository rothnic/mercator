import { Command } from 'commander';

import type { FixtureId } from '../recipes/fixtures.js';
import { RecipeWorkflowService } from '../recipes/service.js';

const SUPPORTED_FIXTURES: readonly FixtureId[] = ['product-simple'];

const parseFixtureId = (value: string | undefined): FixtureId => {
  if (!value) {
    return 'product-simple';
  }
  if (!SUPPORTED_FIXTURES.includes(value as FixtureId)) {
    throw new Error(`Unsupported fixture id: ${value}`);
  }
  return value as FixtureId;
};

export interface CreateCliOptions {
  readonly service: RecipeWorkflowService;
  readonly stdout?: NodeJS.WritableStream;
  readonly stderr?: NodeJS.WritableStream;
}

export const createCli = (options: CreateCliOptions): Command => {
  const program = new Command();
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const service = options.service;

  const writeJson = (value: unknown) => {
    const serialized = JSON.stringify(value, null, 2);
    stdout.write(`${serialized}\n`);
  };

  const handle = <T extends unknown[]>(runner: (...args: T) => Promise<void>) => {
    return async (...args: T) => {
      try {
        await runner(...args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stderr.write(`${message}\n`);
        throw error;
      }
    };
  };

  program.name('mercator-service').description('Mercator recipe workflow CLI');

  program
    .command('recipes:generate')
    .description('Run the orchestration loop to generate a draft recipe')
    .option('--fixture <id>', 'Fixture identifier', 'product-simple')
    .option('--html <path>', 'Path to HTML document for orchestration')
    .option('--url <url>', 'Document URL to fetch before orchestration')
    .option('--actor <actor>', 'Actor recorded for storage history')
    .action(
      handle(async (command: { fixture?: string; html?: string; actor?: string; url?: string }) => {
        const documentUrl = command.url?.trim();
        const fixtureId = documentUrl ? undefined : parseFixtureId(command.fixture);
        const result = await service.generateRecipe({
          url: documentUrl,
          fixtureId,
          htmlPath: documentUrl ? undefined : command.html,
          actor: command.actor
        });
        writeJson({
          recipeId: result.stored.id,
          lifecycle: result.stored.recipe.lifecycle,
          document: result.document
        });
      })
    );

  program
    .command('recipes:promote <recipeId>')
    .description('Promote a draft recipe to the stable lifecycle state')
    .option('--actor <actor>', 'Actor recorded for promotion event')
    .option('--notes <notes>', 'Optional notes added to lifecycle history')
    .action(
      handle(async (recipeId: string, command: { actor?: string; notes?: string }) => {
        const promoted = await service.promoteRecipe(recipeId, {
          actor: command.actor,
          notes: command.notes
        });
        writeJson({
          recipeId: promoted.id,
          lifecycle: promoted.recipe.lifecycle
        });
      })
    );

  program
    .command('parse')
    .description('Execute the latest stable recipe against a document')
    .option('--fixture <id>', 'Fixture identifier', 'product-simple')
    .option('--html <path>', 'Path to HTML document to parse')
    .option('--url <url>', 'Document URL to fetch before execution')
    .action(
      handle(async (command: { fixture?: string; html?: string; url?: string }) => {
        const documentUrl = command.url?.trim();
        const fixtureId = documentUrl ? undefined : parseFixtureId(command.fixture);
        const result = await service.parseDocument({
          url: documentUrl,
          fixtureId,
          htmlPath: documentUrl ? undefined : command.html
        });
        writeJson({
          recipeId: result.recipe.id,
          product: result.product,
          document: result.document
        });
      })
    );

  return program;
};
