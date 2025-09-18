import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { FixtureId } from '../recipes/fixtures.js';
import { RecipeWorkflowService } from '../recipes/service.js';

const FixtureIdSchema = z.enum(['product-simple']);

export interface CreateServerOptions {
  readonly service: RecipeWorkflowService;
}

export const createServer = (options: CreateServerOptions): FastifyInstance => {
  const app = Fastify({ logger: false });
  const service = options.service;

  const parseFixtureId = (value: string | undefined): FixtureId => {
    if (!value) {
      return 'product-simple';
    }
    const parsed = FixtureIdSchema.parse(value);
    return parsed;
  };

  app.post('/recipes/generate', async (request, reply) => {
    const schema = z
      .object({
        fixtureId: z.string().optional(),
        htmlPath: z.string().optional(),
        actor: z.string().optional(),
        url: z.string().url().optional()
      })
      .strict();

    const body = schema.parse(request.body ?? {});
    const documentUrl = body.url?.trim();
    const fixtureId = documentUrl ? undefined : parseFixtureId(body.fixtureId);
    const result = await service.generateRecipe({
      url: documentUrl,
      fixtureId,
      htmlPath: body.htmlPath,
      actor: body.actor
    });

    return reply.send({
      recipeId: result.stored.id,
      lifecycle: result.stored.recipe.lifecycle,
      orchestration: result.orchestration,
      document: result.document
    });
  });

  app.post('/recipes/promote', async (request, reply) => {
    const schema = z
      .object({
        recipeId: z.string().min(1),
        actor: z.string().optional(),
        notes: z.string().optional()
      })
      .strict();

    const body = schema.parse(request.body ?? {});
    const promoted = await service.promoteRecipe(body.recipeId, {
      actor: body.actor,
      notes: body.notes
    });

    return reply.send({
      recipeId: promoted.id,
      lifecycle: promoted.recipe.lifecycle
    });
  });

  app.post('/parse', async (request, reply) => {
    const schema = z
      .object({
        fixtureId: z.string().optional(),
        htmlPath: z.string().optional(),
        url: z.string().url().optional()
      })
      .strict();

    const body = schema.parse(request.body ?? {});
    const documentUrl = body.url?.trim();
    const fixtureId = documentUrl ? undefined : parseFixtureId(body.fixtureId);
    const result = await service.parseDocument({
      url: documentUrl,
      fixtureId,
      htmlPath: body.htmlPath
    });

    return reply.send({
      recipeId: result.recipe.id,
      product: result.product,
      fieldValues: Object.fromEntries(result.fieldValues),
      document: result.document
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join('; ') : error.message;
    reply.status(statusCode).send({ error: message });
  });

  return app;
};
