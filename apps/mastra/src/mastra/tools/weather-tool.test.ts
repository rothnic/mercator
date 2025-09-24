import { describe, expect, test } from "vitest";

import { RuntimeContext } from "@mastra/core/runtime-context";

import { weatherTool } from "./weather-tool";

describe("weatherTool", () => {
	test("returns a sunny outlook for the provided location", async () => {
		const runtimeContext = new RuntimeContext();

		const result = await weatherTool.execute({
			context: { location: "Paris" },
			runtimeContext,
		});

		expect(result.outlook).toContain("Paris");
	});
});
