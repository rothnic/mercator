import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";

import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: "file:./mastra.db",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "warn",
  }),
  agents: {
    weatherAgent,
  },
});
