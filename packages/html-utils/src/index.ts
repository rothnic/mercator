import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type FixtureSource = "fixture" | "generic";

export interface FixtureMatch {
  readonly match: RegExp;
  readonly fixtureId: string;
  readonly file: string;
}

export interface LoadHtmlForUrlOptions {
  readonly url: string;
  readonly fixturesDir?: string;
}

export interface LoadHtmlForUrlResult {
  readonly html: string;
  readonly source: FixtureSource;
  readonly fixtureId?: string;
}

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const defaultFixturesDir = resolve(repositoryRoot, "fixtures");

const fallbackHtml = `<!doctype html><html><body><main><h1>Example Product</h1><p class="price">$1.00 USD</p></main></body></html>`;

const fixtureCatalog: readonly FixtureMatch[] = [
  {
    match: /demo\.mercator\.sh\/products\/precision-pour-over-kettle/i,
    fixtureId: "product-simple",
    file: "product-simple.html",
  },
];

export const getFixtureCatalog = () => fixtureCatalog;

const findFixtureMatch = (url: string): FixtureMatch | undefined => {
  for (const fixture of fixtureCatalog) {
    if (fixture.match.test(url)) {
      return fixture;
    }
  }
  return undefined;
};

export async function loadHtmlForUrl({
  url,
  fixturesDir,
}: LoadHtmlForUrlOptions): Promise<LoadHtmlForUrlResult> {
  const directory = fixturesDir ?? defaultFixturesDir;
  const fixture = findFixtureMatch(url);

  if (fixture) {
    const html = await readFile(resolve(directory, fixture.file), "utf8");
    return {
      html,
      source: "fixture",
      fixtureId: fixture.fixtureId,
    };
  }

  return {
    html: fallbackHtml,
    source: "generic",
  };
}

export const getFallbackHtml = () => fallbackHtml;
