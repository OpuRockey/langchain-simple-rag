import "server-only";

import { prisma } from "@/lib/prisma";
import { chunkText } from "@/lib/chunking";
import { getVectorStore } from "@/lib/vector-store";
import { parseFileBuffer, isSupported } from "@/lib/loaders";
import type {
  DocumentItem,
  FileKind,
  IngestResult,
  UploadResult,
  RetrievedSource,
} from "@/types";

const MAX_CHARS = 200_000;

function kindFor(source: string, explicit?: FileKind): FileKind {
  if (explicit) return explicit;
  const lower = source.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".md")) return "md";
  return "text";
}

export async function ingestText(
  source: string,
  text: string,
  fileType?: FileKind,
): Promise<IngestResult> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) throw new Error("The document contains no usable text.");
  if (normalized.length > MAX_CHARS) {
    throw new Error("Document content exceeds the 200,000-character limit.");
  }
  const chunks = await chunkText(normalized);
  if (chunks.length === 0) {
    throw new Error("The document contains no usable text.");
  }

  const existing = await prisma.document.findUnique({ where: { source } });
  const documentId = existing?.id ?? crypto.randomUUID();

  const store = await getVectorStore();
  if (existing) {
    await store.delete({ filter: { documentId } });
  }
  await store.addDocuments(
    chunks.map((pageContent, i) => ({
      pageContent,
      metadata: {
        documentId,
        source,
        chunkIndex: i,
        totalChunks: chunks.length,
      },
    })),
  );

  const kind = kindFor(source, fileType);
  const record = await prisma.document.upsert({
    where: { source },
    create: {
      id: documentId,
      source,
      fileType: kind,
      sizeBytes: Buffer.byteLength(normalized, "utf-8"),
      chunkCount: chunks.length,
    },
    update: {
      fileType: kind,
      sizeBytes: Buffer.byteLength(normalized, "utf-8"),
      chunkCount: chunks.length,
    },
  });

  return {
    documentId: record.id,
    source: record.source,
    chunksCreated: chunks.length,
  };
}

export interface IncomingFile {
  fileName: string;
  buffer: Buffer;
  size: number;
}

export async function ingestFiles(files: IncomingFile[]): Promise<UploadResult> {
  const results: IngestResult[] = [];
  const errors: UploadResult["errors"] = [];
  for (const file of files) {
    try {
      if (!isSupported(file.fileName)) {
        throw new Error(
          `Unsupported file type. Allowed: .pdf, .docx, .txt, .md`,
        );
      }
      const parsed = await parseFileBuffer(file.fileName, file.buffer);
      const result = await ingestText(parsed.fileName, parsed.text);
      results.push(result);
    } catch (error) {
      errors.push({
        file: file.fileName,
        error: error instanceof Error ? error.message : "Ingestion failed.",
      });
    }
  }
  return { results, errors };
}

export async function listDocuments(): Promise<DocumentItem[]> {
  const rows = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    fileType: row.fileType as FileKind,
    sizeBytes: row.sizeBytes,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function deleteDocument(id: string): Promise<void> {
  const store = await getVectorStore();
  await store.delete({ filter: { documentId: id } });
  await prisma.document.delete({ where: { id } });
}

export async function searchSimilar(
  question: string,
  limit = 4,
): Promise<RetrievedSource[]> {
  const store = await getVectorStore();
  const safeLimit = Math.max(1, Math.min(limit, 10));
  const pairs = await store.similaritySearchWithScore(question, safeLimit);
  return pairs.map(([doc, score]) => ({
    id: String(
      doc.id ?? doc.metadata?.documentId ?? `${doc.metadata?.source}-${doc.metadata?.chunkIndex ?? 0}`,
    ),
    source: String(doc.metadata?.source ?? "unknown"),
    content: doc.pageContent,
    distance: typeof score === "number" ? score : 0,
  }));
}
