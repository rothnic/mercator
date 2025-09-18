import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Writable } from 'node:stream';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { loadProductSimpleFixture } from '@mercator/fixtures';
import { LocalFileSystemRecipeStore } from '@mercator/recipe-store';

import { createCli } from '../cli/index.js';
import { createServer } from '../http/server.js';
import { createProductSimpleRuleSet } from '../orchestrator/__fixtures__/product-simple.js';
import { createInMemoryRuleRepository } from '../orchestrator/rule-repository.js';
import { RecipeWorkflowService } from './service.js';

describe('RecipeWorkflowService integration', () => {
  let directory: string;
  let service: RecipeWorkflowService;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mercator-recipes-'));
    const store = new LocalFileSystemRecipeStore({ directory });
    const ruleRepository = createInMemoryRuleRepository([createProductSimpleRuleSet()]);
    service = new RecipeWorkflowService({ store, ruleRepository });
    server = createServer({ service });
  });

  afterEach(async () => {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('generates, promotes, and parses a recipe using fixture HTML path', async () => {
    const fixture = loadProductSimpleFixture();
    const htmlPath = fixture.paths.html;

    const GenerateResponseSchema = z.object({
      recipeId: z.string(),
      document: z.object({ domain: z.string(), path: z.string() })
    });
    const generateResponse = await server.inject({
      method: 'POST',
      url: '/recipes/generate',
      payload: { fixtureId: 'product-simple', htmlPath }
    });
    expect(generateResponse.statusCode).toBe(200);
    const generateBody = GenerateResponseSchema.parse(generateResponse.json());
    expect(generateBody.document.domain).toBe('demo.mercator.sh');

    const stdoutChunks: string[] = [];
    const cli = createCli({
      service,
      stdout: new Writable({
        write(chunk, _encoding, callback) {
          stdoutChunks.push(String(chunk));
          callback();
        }
      }),
      stderr: new Writable({
        write(chunk, _encoding, callback) {
          callback(new Error(`CLI error: ${String(chunk)}`));
        }
      })
    });
    cli.exitOverride();

    const PromoteOutputSchema = z.object({ recipeId: z.string() }).passthrough();
    await cli.parseAsync(['recipes:promote', generateBody.recipeId], { from: 'user' });
    const cliOutput = stdoutChunks.join('');
    const promotedOutput = PromoteOutputSchema.parse(JSON.parse(cliOutput));
    expect(promotedOutput.recipeId).toBe(generateBody.recipeId);

    const ParseResponseSchema = z
      .object({
        product: z.object({
          title: z.string(),
          price: z.object({ amount: z.number() })
        })
      })
      .passthrough();
    const parseResponse = await server.inject({
      method: 'POST',
      url: '/parse',
      payload: { fixtureId: 'product-simple', htmlPath }
    });
    expect(parseResponse.statusCode).toBe(200);
    const parseBody = ParseResponseSchema.parse(parseResponse.json());

    expect(parseBody.product.title).toContain('Precision');
    expect(parseBody.product.price.amount).toBeGreaterThan(0);
  });
});
