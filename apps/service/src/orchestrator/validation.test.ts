import { describe, expect, it } from 'vitest';

import { loadProductSimpleFixture } from '@mercator/fixtures';

import { buildRecipeFromRuleSet } from './recipe-synthesis.js';
import { validateRecipeAgainstDocument } from './validation.js';
import { createProductSimpleRuleSet } from './__fixtures__/product-simple.js';

describe('validateRecipeAgainstDocument', () => {
  const ruleSet = createProductSimpleRuleSet();
  const fixture = loadProductSimpleFixture();
  const now = new Date('2024-01-01T00:00:00Z');
  const { recipe } = buildRecipeFromRuleSet({ ruleSet, now });

  it('returns a passing validation report for the fixture recipe', () => {
    const result = validateRecipeAgainstDocument({
      html: fixture.html,
      recipe,
      expected: ruleSet.expectedProduct
    });

    expect(result.status).toBe('pass');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.stopReason).toBeUndefined();
    expect(result.fieldResults.every((field) => field.status === 'pass')).toBe(true);
  });

  it('flags critical failures when selectors diverge from expected data', () => {
    const brokenRecipe = {
      ...recipe,
      target: {
        ...recipe.target,
        fields: recipe.target.fields.map((field) =>
          field.fieldId === 'title'
            ? {
                ...field,
                selectorSteps: field.selectorSteps.map((step, index) =>
                  index === 0 ? { ...step, value: '.product__subtitle' } : step
                )
              }
            : field
        )
      }
    };

    const result = validateRecipeAgainstDocument({
      html: fixture.html,
      recipe: brokenRecipe,
      expected: ruleSet.expectedProduct
    });

    expect(result.status).toBe('fail');
    expect(result.stopReason).toContain('title');
    const titleField = result.fieldResults.find((entry) => entry.fieldId === 'title');
    expect(titleField).toBeDefined();
    if (!titleField) {
      throw new Error('Title field result missing');
    }
    expect(titleField.status).toBe('fail');
  });
});
