import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getFallbackHtml, getFixtureCatalog, loadHtmlForUrl } from "./index";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixturesDir = resolve(repoRoot, "fixtures");

describe("loadHtmlForUrl", () => {
	it("returns fixture html when url matches", async () => {
		const { html, source, fixtureId } = await loadHtmlForUrl({
			url: "https://demo.mercator.sh/products/precision-pour-over-kettle",
			fixturesDir,
		});

		expect(source).toBe("fixture");
		expect(fixtureId).toBe("product-simple");
		expect(html).toContain("Precision Pour-Over Kettle");
	});

	it("falls back to generic html when url has no fixture", async () => {
		const { html, source, fixtureId } = await loadHtmlForUrl({
			url: "https://example.com/unknown",
			fixturesDir,
		});

		expect(source).toBe("generic");
		expect(fixtureId).toBeUndefined();
		expect(html).toBe(getFallbackHtml());
	});
});

describe("getFixtureCatalog", () => {
	it("exposes configured fixtures", () => {
		const catalog = getFixtureCatalog();
		expect(Array.isArray(catalog)).toBe(true);
		expect(catalog.some((item) => item.fixtureId === "product-simple")).toBe(
			true,
		);
	});
});
