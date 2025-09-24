import { RuntimeContext } from "@mastra/core/runtime-context";
import { describe, expect, test } from "vitest";

import { weatherTool } from "./weather-tool";

describe("weatherTool", () => {
  test("returns a sunny outlook for the provided location", async () => {
    const runtimeContext = new RuntimeContext();

    const result = await weatherTool.execute({
      context: { location: "Paris" },
      runtimeContext,
      suspend: () => Promise.resolve(undefined),
    });

    // Assert the type of result to include 'outlook'
    expect(result.outlook).toContain("Paris");
  });
});
