import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface DomainScriptEntry {
  pathRegex: string;
  script: string;
  lastUpdatedAt: string;
  notes?: string;
}

export interface DomainKnowledge {
  resourceId: string;
  scripts: DomainScriptEntry[];
}

export const createDomainKnowledgePath = (dir: string, resourceId: string) =>
  join(dir, `${resourceId}.json`);

const createDefaultKnowledge = (resourceId: string): DomainKnowledge => ({
  resourceId,
  scripts: []
});

export const loadDomainKnowledge = async (dir: string, resourceId: string): Promise<DomainKnowledge> => {
  const path = createDomainKnowledgePath(dir, resourceId);
  try {
    const contents = await readFile(path, 'utf8');
    const parsed = JSON.parse(contents) as DomainKnowledge;
    if (!parsed.resourceId) {
      return createDefaultKnowledge(resourceId);
    }
    return parsed;
  } catch {
    return createDefaultKnowledge(resourceId);
  }
};

export const saveDomainKnowledge = async (dir: string, knowledge: DomainKnowledge) => {
  const path = createDomainKnowledgePath(dir, knowledge.resourceId);
  await writeFile(path, `${JSON.stringify(knowledge, null, 2)}\n`, 'utf8');
};

export const upsertScriptEntry = (
  knowledge: DomainKnowledge,
  entry: DomainScriptEntry
): DomainKnowledge => {
  const existingIndex = knowledge.scripts.findIndex((candidate) => candidate.pathRegex === entry.pathRegex);
  if (existingIndex >= 0) {
    const nextScripts = [...knowledge.scripts];
    nextScripts[existingIndex] = entry;
    return {
      ...knowledge,
      scripts: nextScripts
    };
  }

  return {
    ...knowledge,
    scripts: [...knowledge.scripts, entry]
  };
};

export const findMatchingScript = (
  knowledge: DomainKnowledge,
  path: string
): DomainScriptEntry | undefined => {
  for (const candidate of knowledge.scripts) {
    try {
      const pattern = new RegExp(candidate.pathRegex);
      if (pattern.test(path)) {
        return candidate;
      }
    } catch {
      continue;
    }
  }
  return undefined;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createExactPathRegex = (path: string) => `^${escapeRegExp(path)}$`;
