import { resolve } from 'node:path';

import { LocalFileSystemRecipeStore } from '@mercator/recipe-store';

import { RecipeWorkflowService } from './service.js';

export interface CreateWorkflowServiceOptions {
  readonly directory?: string;
  readonly now?: () => Date;
}

export const createWorkflowService = (
  options: CreateWorkflowServiceOptions = {}
): RecipeWorkflowService => {
  const directory = options.directory ?? process.env.MERCATOR_RECIPES_DIR ?? resolve(process.cwd(), '.recipes');
  const store = new LocalFileSystemRecipeStore({ directory, now: options.now });
  return new RecipeWorkflowService({ store, now: options.now });
};
