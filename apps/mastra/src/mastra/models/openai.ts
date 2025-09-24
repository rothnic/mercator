import { createOpenAI } from "@ai-sdk/openai";
import { config } from "dotenv";

config();

const openai = createOpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
})(process.env.DEFAULT_MODEL || "gpt-4.1-mini");

export default openai;
