import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { RecipeSchema, type LifecycleState, type Recipe } from '@mercator/core';

import type {
  CreateDraftOptions,
  PromotionOptions,
  RecipeStore,
  StoredRecipe
} from './types.js';

interface FileRecord {
  readonly id: string;
  readonly recipe: Recipe;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly promotedAt?: string;
}

const isLifecycleState = (value: unknown): value is LifecycleState => {
  return value === 'draft' || value === 'candidate' || value === 'stable' || value === 'retired';
};

const normalizeHistory = (
  history: Recipe['lifecycle']['history']
): Recipe['lifecycle']['history'] => history.map((event) => ({
  ...event,
  at: new Date(event.at)
}));

export interface LocalFileSystemRecipeStoreOptions {
  readonly directory: string;
  readonly now?: () => Date;
}

export class LocalFileSystemRecipeStore implements RecipeStore {
  private readonly directory: string;
  private readonly now: () => Date;
  private readonly ready: Promise<void>;

  constructor(options: LocalFileSystemRecipeStoreOptions) {
    this.directory = options.directory;
    this.now = options.now ?? (() => new Date());
    this.ready = mkdir(this.directory, { recursive: true });
  }

  async createDraft(recipe: Recipe, options: CreateDraftOptions = {}): Promise<StoredRecipe> {
    await this.ready;

    const candidate = RecipeSchema.parse(recipe);
    if (candidate.lifecycle.state !== 'draft') {
      throw new Error('Only draft recipes may be stored.');
    }

    const id = candidate.id ?? randomUUID();
    const now = options.when ?? this.now();

    const history = normalizeHistory(candidate.lifecycle.history);
    const lastEvent = history.at(-1);
    const draftHistory =
      lastEvent && lastEvent.state === 'draft'
        ? history
        : [
            ...history,
            {
              state: 'draft' as const,
              at: now,
              actor: options.actor,
              notes: options.notes ?? 'Recipe stored as draft'
            }
          ];

    const normalized = RecipeSchema.parse({
      ...candidate,
      id,
      updatedAt: now,
      lifecycle: {
        state: 'draft',
        since: candidate.lifecycle.state === 'draft' ? candidate.lifecycle.since : now,
        history: draftHistory
      }
    });

    const record: FileRecord = {
      id,
      recipe: normalized,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await this.writeRecord(record);

    return this.hydrate(record);
  }

  async list(options: { state?: LifecycleState } = {}): Promise<readonly StoredRecipe[]> {
    await this.ready;
    const entries = await readdir(this.directory, { withFileTypes: true });
    const recipes: StoredRecipe[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }

      const record = await this.readRecord(entry.name);
      if (!record) {
        continue;
      }

      if (options.state && record.recipe.lifecycle.state !== options.state) {
        continue;
      }

      recipes.push(record);
    }

    return recipes.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  }

  async getById(id: string): Promise<StoredRecipe | undefined> {
    await this.ready;
    const record = await this.readRecord(`${id}.json`);
    return record;
  }

  async promote(id: string, options: PromotionOptions = {}): Promise<StoredRecipe> {
    await this.ready;
    const record = await this.readRecord(`${id}.json`);

    if (!record) {
      throw new Error(`Recipe ${id} not found.`);
    }

    if (record.recipe.lifecycle.state === 'stable') {
      throw new Error('Recipe is already stable.');
    }

    if (record.recipe.lifecycle.state !== 'draft') {
      throw new Error('Only draft recipes can be promoted.');
    }

    const now = options.when ?? this.now();
    const history = normalizeHistory(record.recipe.lifecycle.history);
    const promotedHistory = [
      ...history,
      {
        state: 'stable' as const,
        at: now,
        actor: options.actor,
        notes: options.notes ?? 'Promoted to stable'
      }
    ];

    const updatedRecipe = RecipeSchema.parse({
      ...record.recipe,
      updatedAt: now,
      updatedBy: options.actor ?? record.recipe.updatedBy,
      lifecycle: {
        state: 'stable',
        since: now,
        history: promotedHistory
      }
    });

    const next: FileRecord = {
      ...record,
      recipe: updatedRecipe,
      updatedAt: now.toISOString(),
      promotedAt: now.toISOString()
    };

    await this.writeRecord(next);
    return this.hydrate(next);
  }

  async getLatestStable(): Promise<StoredRecipe | undefined> {
    const entries = await this.list({ state: 'stable' });
    return entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  }

  private async readRecord(fileName: string): Promise<StoredRecipe | undefined> {
    const filePath = join(this.directory, fileName);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }

    const parsed = JSON.parse(raw) as Partial<FileRecord> & { recipe?: unknown };
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Invalid recipe record in ${fileName}`);
    }

    if (!parsed.id || typeof parsed.id !== 'string') {
      throw new Error(`Recipe record ${fileName} is missing an id.`);
    }

    if (!parsed.createdAt || !parsed.updatedAt) {
      throw new Error(`Recipe record ${fileName} is missing timestamps.`);
    }

    if (!parsed.recipe) {
      throw new Error(`Recipe record ${fileName} is missing recipe data.`);
    }

    const recipe = RecipeSchema.parse(parsed.recipe);
    return {
      id: parsed.id,
      recipe,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      promotedAt: parsed.promotedAt ? new Date(parsed.promotedAt) : undefined
    } satisfies StoredRecipe;
  }

  private async writeRecord(record: FileRecord): Promise<void> {
    const filePath = join(this.directory, `${record.id}.json`);
    const serialized = JSON.stringify(
      {
        ...record,
        recipe: {
          ...record.recipe,
          createdAt: record.recipe.createdAt.toISOString(),
          updatedAt: record.recipe.updatedAt.toISOString(),
          lifecycle: {
            ...record.recipe.lifecycle,
            since: record.recipe.lifecycle.since.toISOString(),
            history: record.recipe.lifecycle.history.map((event) => ({
              ...event,
              at: event.at.toISOString()
            }))
          }
        }
      },
      null,
      2
    );

    await writeFile(filePath, `${serialized}\n`, 'utf-8');
  }

  private hydrate(record: FileRecord): StoredRecipe {
    const recipe = RecipeSchema.parse(record.recipe);
    const lifecycle = {
      ...recipe.lifecycle,
      history: normalizeHistory(recipe.lifecycle.history)
    };

    return {
      id: record.id,
      recipe: {
        ...recipe,
        lifecycle
      },
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      promotedAt: record.promotedAt ? new Date(record.promotedAt) : undefined
    };
  }
}

export function isValidLifecycleState(state: unknown): state is LifecycleState {
  return isLifecycleState(state);
}
