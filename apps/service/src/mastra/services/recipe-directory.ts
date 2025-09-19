import { resolve } from 'node:path';

import type { StoredRecipe } from '@mercator/recipe-store';
import { LocalFileSystemRecipeStore } from '@mercator/recipe-store';

interface RecipeSummary {
  readonly id: string;
  readonly state: StoredRecipe['recipe']['lifecycle']['state'];
  readonly name: string;
  readonly updatedAt: string;
  readonly promotedAt?: string;
  readonly document?: StoredRecipe['document'];
  readonly fieldCount: number;
}

const getStoreDirectory = (): string => {
  return process.env.MERCATOR_RECIPES_DIR ?? resolve(process.cwd(), '.recipes');
};

let store: LocalFileSystemRecipeStore | undefined;

const getStore = (): LocalFileSystemRecipeStore => {
  if (!store) {
    store = new LocalFileSystemRecipeStore({ directory: getStoreDirectory() });
  }
  return store;
};

const summarizeRecipe = (recipe: StoredRecipe): RecipeSummary => ({
  id: recipe.id,
  state: recipe.recipe.lifecycle.state,
  name: recipe.recipe.name,
  updatedAt: recipe.updatedAt.toISOString(),
  promotedAt: recipe.promotedAt?.toISOString(),
  document: recipe.document ? { ...recipe.document } : undefined,
  fieldCount: recipe.recipe.target.fields.length
});

const normalizePath = (value: string): string => {
  if (!value) {
    return '/';
  }
  return value.startsWith('/') ? value : `/${value}`;
};

export interface RecipeDirectoryLookup {
  readonly stable?: RecipeSummary;
  readonly drafts: readonly RecipeSummary[];
}

export const findRecipesForDocument = async (domain: string, path: string): Promise<RecipeDirectoryLookup> => {
  const normalizedPath = normalizePath(path);
  const recipeStore = getStore();
  const [drafts, stable] = await Promise.all([
    recipeStore.list({ state: 'draft' }).then((results) =>
      results.filter((entry) => entry.document?.domain === domain && entry.document?.path === normalizedPath)
    ),
    recipeStore
      .list({ state: 'stable' })
      .then((results) => results.find((entry) => entry.document?.domain === domain && entry.document?.path === normalizedPath))
  ]);

  return {
    stable: stable ? summarizeRecipe(stable) : undefined,
    drafts: drafts.map((entry) => summarizeRecipe(entry))
  };
};

export const findRecipesForUrl = async (url: string): Promise<RecipeDirectoryLookup | undefined> => {
  try {
    const parsed = new URL(url);
    return findRecipesForDocument(parsed.hostname, parsed.pathname || '/');
  } catch {
    return undefined;
  }
};
