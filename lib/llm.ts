import "server-only";
import { ChatOpenAI } from "@langchain/openai";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

required("API_URL");
required("API_KEY");
required("MODEL_ID");

export const llm = new ChatOpenAI({
  model: process.env.MODEL_ID!,
  apiKey: process.env.API_KEY!,
  configuration: { baseURL: process.env.API_URL! },
  temperature: 0,
});
