import { describe, expect, it } from "vitest";

import { runCheerioExtraction } from "./execute-cheerio-script.tool";

const sampleHtml = `
  <html>
    <body>
      <h1 class="product-title">Mercator Mug</h1>
      <p class="product-price">$12.34</p>
    </body>
  </html>
`;

const workingScript = `
export const extract = ($) => {
  const title = $(".product-title").text().trim();
  const priceText = $(".product-price").text().replace(/[^0-9.]/g, "");
  return { title, price: Number(priceText) };
};
`;

describe("executeCheerioScriptTool", () => {
	it("returns structured output when the script resolves", async () => {
		const result = await runCheerioExtraction({
			html: sampleHtml,
			script: workingScript,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.result.title).toBe("Mercator Mug");
			expect(result.result.price).toBe(12.34);
		}
	});

	it("returns the error message when the script throws", async () => {
		const result = await runCheerioExtraction({
			html: sampleHtml,
			script: "throw new Error('boom');",
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("boom");
		}
	});
});
