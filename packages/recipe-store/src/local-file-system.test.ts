import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  RecipeSchema,
  getDefaultTolerance,
  type Recipe,
  type RecipeFieldId
} from '@mercator/core';

import { LocalFileSystemRecipeStore } from './local-file-system.js';

const REQUIRED_FIELDS: RecipeFieldId[] = ['title', 'canonicalUrl', 'price', 'images'];

const createBaseRecipe = (timestamp: Date): Recipe => {
  const iso = timestamp.toISOString();
  return RecipeSchema.parse({
    name: 'demo-product',
    version: '1.0.0',
    description: 'Demonstration recipe for tests.',
    createdAt: iso,
    updatedAt: iso,
    createdBy: 'tester@mercator',
    updatedBy: 'tester@mercator',
    target: {
      documentType: 'product',
      schema: {
        title: 'Test Product',
        canonicalUrl: 'https://demo.mercator.sh/products/test',
        price: { amount: 129, currencyCode: 'USD', precision: 2, raw: '$129.00' },
        images: ['https://demo.mercator.sh/assets/test.jpg']
      },
      fields: REQUIRED_FIELDS.map((fieldId) => ({
        fieldId,
        selectorSteps: [
          {
            strategy: 'css',
            value: `#${fieldId}`
          }
        ],
        tolerance: getDefaultTolerance(fieldId),
        transforms: [],
        validators: [],
        metrics: { sampleCount: 0, passCount: 0, failCount: 0 }
      }))
    },
    lifecycle: {
      state: 'draft',
      since: iso,
      history: [
        {
          state: 'draft',
          at: iso,
          actor: 'tester@mercator',
          notes: 'Initial draft generated for testing.'
        }
      ]
    },
    provenance: []
  });
};

describe('LocalFileSystemRecipeStore', () => {
  let directory: string;
  const timestamps: Date[] = [
    new Date('2024-01-01T00:00:00Z'),
    new Date('2024-01-01T00:05:00Z'),
    new Date('2024-01-01T00:10:00Z')
  ];
  let clock = 0;

  const nextTime = () => timestamps[Math.min(clock++, timestamps.length - 1)];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'recipe-store-'));
    clock = 0;
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('persists draft recipes to disk with generated identifiers', async () => {
    const store = new LocalFileSystemRecipeStore({ directory, now: nextTime });
    const recipe = createBaseRecipe(timestamps[0]);
    const document = { domain: 'demo.mercator.sh', path: '/products/test' } as const;

    const stored = await store.createDraft(recipe, { document });

    expect(stored.id).toMatch(/[0-9a-f-]{36}/i);
    expect(stored.recipe.id).toBe(stored.id);
    expect(stored.recipe.lifecycle.state).toBe('draft');
    expect(stored.updatedAt.toISOString()).toBe(timestamps[0].toISOString());
    expect(stored.document).toEqual(document);

    const files = await readdir(directory);
    expect(files).toContain(`${stored.id}.json`);
  });

  it('promotes draft recipes to stable and records lifecycle history', async () => {
    const store = new LocalFileSystemRecipeStore({ directory, now: nextTime });
    const recipe = createBaseRecipe(timestamps[0]);
    const document = { domain: 'demo.mercator.sh', path: '/products/test' } as const;

    const draft = await store.createDraft(recipe, { document });
    const promoted = await store.promote(draft.id, { actor: 'qa@mercator' });

    expect(promoted.recipe.lifecycle.state).toBe('stable');
    const lastHistory = promoted.recipe.lifecycle.history.at(-1);
    expect(lastHistory?.state).toBe('stable');
    expect(lastHistory?.actor).toBe('qa@mercator');
    expect(promoted.promotedAt?.toISOString()).toBe(timestamps[1].toISOString());
    expect(promoted.document).toEqual(document);
  });

  it('lists recipes filtered by lifecycle state and returns latest stable entry', async () => {
    const store = new LocalFileSystemRecipeStore({ directory, now: nextTime });
    const recipe = createBaseRecipe(timestamps[0]);

    const draft = await store.createDraft(recipe);
    const entriesBeforePromotion = await store.list();
    expect(entriesBeforePromotion).toHaveLength(1);
    expect(entriesBeforePromotion[0]?.recipe.lifecycle.state).toBe('draft');

    await store.promote(draft.id, { notes: 'Ready for execution.' });
    const allEntries = await store.list();
    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]?.recipe.lifecycle.state).toBe('stable');

    const stableEntries = await store.list({ state: 'stable' });
    expect(stableEntries).toHaveLength(1);

    const latestStable = await store.getLatestStable();
    expect(latestStable?.id).toBe(draft.id);
  });

  it('throws when promoting non-existent or already stable recipes', async () => {
    const store = new LocalFileSystemRecipeStore({ directory, now: nextTime });
    const recipe = createBaseRecipe(timestamps[0]);

    await expect(store.promote('missing')).rejects.toThrow(/not found/i);

    const draft = await store.createDraft(recipe);
    await store.promote(draft.id);

    await expect(store.promote(draft.id)).rejects.toThrow(/already stable/i);
  });
});
