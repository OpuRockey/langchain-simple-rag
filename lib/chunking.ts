import "server-only";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

export async function chunkText(text: string): Promise<string[]> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  return splitter.splitText(normalized);
}
