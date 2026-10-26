import "server-only";
import { OpenAIEmbeddings } from "@langchain/openai";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

required("API_URL");
required("API_KEY");

export const EMBEDDING_MODEL = "nomic-embed-text";
export const EMBEDDING_DIMENSIONS = 768;

export const embeddings = new OpenAIEmbeddings({
  model: EMBEDDING_MODEL,
  apiKey: process.env.API_KEY!,
  configuration: { baseURL: process.env.API_URL! },
  dimensions: EMBEDDING_DIMENSIONS,
});
