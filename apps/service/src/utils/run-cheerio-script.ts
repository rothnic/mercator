import type { CheerioAPI } from 'cheerio';
import * as cheerio from 'cheerio';

export interface RunCheerioScriptInput {
  code: string;
  html: string;
}

export interface RunCheerioScriptResult {
  raw: unknown;
  error?: string;
}

const forbiddenTokens = [
  'require(',
  'import ',
  'process.',
  'fs.',
  'while(true)'
];

const containsForbiddenToken = (code: string): string | undefined => {
  return forbiddenTokens.find((token) => code.includes(token));
};

const executeScript = (code: string, html: string, api: typeof cheerio & { load: CheerioAPI['load'] }) => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const runner = new Function('cheerio', 'html', `'use strict';\nreturn ${code};`);
  return runner(api, html);
};

export function runCheerioScript({ code, html }: RunCheerioScriptInput): RunCheerioScriptResult {
  const forbidden = containsForbiddenToken(code);
  if (forbidden) {
    return {
      raw: null,
      error: `Script rejected: contains forbidden token "${forbidden}".`
    };
  }

  try {
    const raw = executeScript(code, html, cheerio);
    return { raw };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      raw: null,
      error: message
    };
  }
}
