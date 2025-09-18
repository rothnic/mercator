import { describe, expect, it } from 'vitest';

import { createFixtureToolset } from '@mercator/agent-tools';
import { loadProductSimpleFixture } from '@mercator/fixtures';
import type { FieldRecipe, RecipeFieldId } from '@mercator/core';

import { buildRecipeFromRuleSet } from './recipe-synthesis.js';
import { createProductSimpleRuleSet } from './__fixtures__/product-simple.js';

describe('buildRecipeFromRuleSet', () => {
  const ruleSet = createProductSimpleRuleSet();
  const now = new Date('2024-01-01T00:00:00Z');

  it('produces a candidate recipe covering expected fields', () => {
    const { recipe, evidenceMatrix } = buildRecipeFromRuleSet({ ruleSet, now });

    expect(recipe.name).toBe(ruleSet.ruleMetadata.name);
    expect(recipe.target.fields.map((field) => field.fieldId)).toEqual(
      expect.arrayContaining([
        'title',
        'price',
        'images',
        'thumbnail',
        'canonicalUrl',
        'description',
        'aggregateRating',
        'breadcrumbs',
        'brand',
        'sku'
      ])
    );
    expect(evidenceMatrix.length).toBe(recipe.target.fields.length);
  });

  it('maps selectors to DOM nodes with expected values', async () => {
    const { recipe } = buildRecipeFromRuleSet({ ruleSet, now });
    const toolset = createFixtureToolset();
    const fixture = loadProductSimpleFixture();
    const getField = (fieldId: RecipeFieldId): FieldRecipe => {
      const match = recipe.target.fields.find(
        (candidate): candidate is FieldRecipe => candidate.fieldId === fieldId
      );
      if (!match) {
        throw new Error(`${fieldId} field missing from recipe`);
      }
      return match;
    };

    const titleField = getField('title');
    const titleQuery = await toolset.html.query({ selector: titleField.selectorSteps[0].value });
    const titleMatch = titleQuery.matches[0];
    expect(titleMatch).toBeDefined();
    expect(titleMatch?.text.trim()).toBe(fixture.expected.product.title);

    const priceField = getField('price');
    const priceQuery = await toolset.html.query({ selector: priceField.selectorSteps[0].value });
    const priceMatch = priceQuery.matches[0];
    expect(priceMatch).toBeDefined();
    expect(priceMatch?.text.replace(/\s+/g, ' ').trim()).toContain('149.00');

    const imagesField = getField('images');
    const imageQuery = await toolset.html.query({ selector: imagesField.selectorSteps[0].value, attribute: 'src' });
    const imageSources = imageQuery.matches.map((match) => {
      const value = match.attributeValue ?? match.attributes.src;
      if (!value) {
        throw new Error('Image match missing src attribute');
      }
      return value;
    });
    expect(imageSources).toEqual(fixture.expected.product.images);

    const breadcrumbField = getField('breadcrumbs');
    const breadcrumbQuery = await toolset.html.query({ selector: breadcrumbField.selectorSteps[0].value });
    const breadcrumbLabels = breadcrumbQuery.matches.map((match) => match.text.replace(/\s+/g, ' ').trim());
    expect(breadcrumbLabels[breadcrumbLabels.length - 1]).toBe('Precision Pour-Over Kettle');
  });
});
