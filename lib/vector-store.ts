import "server-only";
import { PGVectorStore } from "@langchain/pgvector";
import { embeddings, EMBEDDING_DIMENSIONS } from "@/lib/embeddings";

let cached: PGVectorStore | null = null;

export async function getVectorStore(): Promise<PGVectorStore> {
  if (cached) return cached;
  const store = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: {
      connectionString: process.env.DATABASE_URL!,
    },
    tableName: "langchain_pg_embedding",
    collectionTableName: "langchain_pg_collection",
    collectionName: "documents",
    columns: {
      idColumnName: "id",
      vectorColumnName: "vector",
      contentColumnName: "content",
      metadataColumnName: "metadata",
    },
    distanceStrategy: "cosine",
  });
  await store
    .createHnswIndex({ dimensions: EMBEDDING_DIMENSIONS, m: 16, efConstruction: 64 })
    .catch(() => {});
  cached = store;
  return store;
}
