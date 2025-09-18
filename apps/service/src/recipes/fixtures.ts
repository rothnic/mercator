import { readFile } from 'node:fs/promises';

import type { FixtureToolset } from '@mercator/agent-tools';
import { loadProductSimpleFixture } from '@mercator/fixtures';

import {
  createProductSimpleDocument,
  createProductSimpleRuleSet,
  createProductSimpleToolset
} from '../orchestrator/__fixtures__/product-simple.js';
import type { DocumentRuleSet } from '../orchestrator/rule-repository.js';
import type { DocumentSnapshot } from '../orchestrator/index.js';

export type FixtureId = 'product-simple';

export interface FixtureDefinition {
  readonly id: FixtureId;
  readonly domain: string;
  readonly path: string;
  readonly defaultHtml: string;
  readonly htmlPath: string;
  createToolset(): FixtureToolset;
  createRuleSet(): DocumentRuleSet;
}

const loadProductSimpleDefinition = (): FixtureDefinition => {
  const fixture = loadProductSimpleFixture();
  const document = createProductSimpleDocument();
  return {
    id: 'product-simple',
    domain: document.domain,
    path: document.path,
    defaultHtml: fixture.html,
    htmlPath: fixture.paths.html,
    createToolset: () => createProductSimpleToolset(),
    createRuleSet: () => createProductSimpleRuleSet()
  } satisfies FixtureDefinition;
};

const FIXTURE_CACHE: Record<FixtureId, FixtureDefinition> = {
  'product-simple': loadProductSimpleDefinition()
};

export const getFixtureDefinition = (id: FixtureId = 'product-simple'): FixtureDefinition => {
  const definition = FIXTURE_CACHE[id];
  if (!definition) {
    throw new Error(`Unsupported fixture id: ${id}`);
  }
  return {
    ...definition,
    createToolset: () => definition.createToolset(),
    createRuleSet: () => definition.createRuleSet()
  };
};

export const readFixtureDocument = async (
  fixtureId: FixtureId,
  htmlPath?: string
): Promise<DocumentSnapshot> => {
  const definition = getFixtureDefinition(fixtureId);
  const path = htmlPath ?? definition.htmlPath;
  const html = htmlPath ? await readFile(path, 'utf-8') : definition.defaultHtml;
  return {
    domain: definition.domain,
    path: definition.path,
    html
  };
};
