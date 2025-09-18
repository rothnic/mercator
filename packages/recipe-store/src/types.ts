import type { LifecycleState, Recipe } from '@mercator/core';

export interface StoredRecipe {
  readonly id: string;
  readonly recipe: Recipe;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly promotedAt?: Date;
}

export interface CreateDraftOptions {
  readonly actor?: string;
  readonly notes?: string;
  readonly when?: Date;
}

export interface PromotionOptions {
  readonly actor?: string;
  readonly notes?: string;
  readonly when?: Date;
}

export interface RecipeStore {
  createDraft(recipe: Recipe, options?: CreateDraftOptions): Promise<StoredRecipe>;
  list(options?: { state?: LifecycleState }): Promise<readonly StoredRecipe[]>;
  getById(id: string): Promise<StoredRecipe | undefined>;
  promote(id: string, options?: PromotionOptions): Promise<StoredRecipe>;
  getLatestStable(): Promise<StoredRecipe | undefined>;
}
