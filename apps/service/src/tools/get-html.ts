import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface GetHtmlInput {
	url: string;
	fixturesDir?: string;
}

export interface GetHtmlResult {
	html: string;
	source: "fixture" | "generic";
	fixtureId?: string;
}

const defaultFixturesDir = resolve(
	fileURLToPath(new URL("../../../../", import.meta.url)),
	"fixtures",
);

const fallbackHtml = `<!doctype html><html><body><main><h1>Example Product</h1><p class="price">$1.00 USD</p></main></body></html>`;

const fixtureMap: readonly {
	match: RegExp;
	fixtureId: string;
	file: string;
}[] = [
	{
		match: /demo\.mercator\.sh\/products\/precision-pour-over-kettle/i,
		fixtureId: "product-simple",
		file: "product-simple.html",
	},
];

const findFixture = (url: string) => {
	for (const candidate of fixtureMap) {
		if (candidate.match.test(url)) {
			return candidate;
		}
	}
	return undefined;
};

export async function getHtml({
	url,
	fixturesDir,
}: GetHtmlInput): Promise<GetHtmlResult> {
	const directory = fixturesDir ?? defaultFixturesDir;
	const fixture = findFixture(url);

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
