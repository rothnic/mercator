import { RecipeSchema } from '@mercator/core';
import type { RecipeEvidenceRow, RecipeSynthesisSummary } from '@mercator/core/agents';

import type { DocumentRuleSet, FieldRuleDefinition } from './rule-repository.js';

const buildEvidenceRow = (definition: FieldRuleDefinition): RecipeEvidenceRow => {
  return {
    fieldId: definition.recipe.fieldId,
    source: definition.source,
    selectors: definition.recipe.selectorSteps.map((step) => step.value),
    chunkId: definition.chunkId,
    notes: definition.notes ?? definition.recipe.selectorSteps[0]?.note
  };
};

export interface RecipeSynthesisOptions {
  readonly ruleSet: DocumentRuleSet;
  readonly now: Date;
}

export const buildRecipeFromRuleSet = (options: RecipeSynthesisOptions): RecipeSynthesisSummary => {
  const { ruleSet, now } = options;
  const fields = ruleSet.fieldRules.map((definition) => definition.recipe);
  const evidenceMatrix = ruleSet.fieldRules.map((definition) => buildEvidenceRow(definition));
  const fieldLookup = new Map(ruleSet.fieldRules.map((definition) => [definition.recipe.fieldId, definition]));

  const timestamp = now.toISOString();

  const recipe = RecipeSchema.parse({
    name: ruleSet.ruleMetadata.name,
    version: ruleSet.version,
    description: ruleSet.ruleMetadata.description,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: ruleSet.ruleMetadata.createdBy,
    updatedBy: ruleSet.ruleMetadata.updatedBy,
    target: {
      documentType: ruleSet.documentType,
      schema: ruleSet.expectedProduct,
      fields
    },
    lifecycle: {
      state: 'draft',
      since: timestamp,
      history: [
        {
          state: 'draft',
          at: timestamp,
          actor: ruleSet.ruleMetadata.createdBy,
          notes: 'Initial recipe synthesized from rule configuration.'
        }
      ]
    },
    provenance: evidenceMatrix.map((row) => ({
      fieldId: row.fieldId,
      evidence: row.selectors.join(' | '),
      confidence: fieldLookup.get(row.fieldId)?.confidence ?? 0.6,
      notes: row.notes
    }))
  });

  return {
    recipe,
    evidenceMatrix
  };
};
