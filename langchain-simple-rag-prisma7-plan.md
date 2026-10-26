# Improved Simple RAG — Prisma 7 + LangChain (Ollama OpenAI-compatible) + Next.js + pgvector

## 1. Goal & what changes vs `instructions.md`

Build the same Simple RAG (`langchain_simple_rag` DB) but improved:

| Original weakness | Improved plan |
|---|---|
| Prisma 6 + manual `vector(1536)` + raw `$queryRaw`/`$executeRaw` for vectors | Prisma **7** for metadata only; vectors fully via LangChain **`@langchain/pgvector` PGVectorStore** (`initialize`, `addDocuments`, `similaritySearch`, `delete`, `createHnswIndex`) |
| OpenAI cloud only (`OPENAI_API_KEY`, `text-embedding-3-small`, `gpt-4.1-mini`) | Ollama-local OpenAI-compatible via **4 env vars**: `DATABASE_URL`, `API_URL`, `API_KEY`, `MODEL_ID`. `ChatOpenAI` uses `baseURL: API_URL` + `model: MODEL_ID`; `OpenAIEmbeddings` uses `baseURL: API_URL` |
| Pasted text only, no files | Text input **plus single/multi file upload** (`.pdf`, `.docx`, `.txt`, `.md`) via UI, parsed with LangChain document loaders |
| No library, re-index by title string, sequential inserts, dead `SourceAnnotation` | Full document library: list / re-index by stable ID / delete per document, batched embeddings, transactional metadata write, clean LangGraph `retrieve → generate` |
| Types inline in `page.tsx` / `documents.ts` | All shared types/interfaces in separate **`types/`** folder, imported everywhere |
| Plain `globals.css`, no install steps for PG/Ollama/Tailwind | Complete installation process (Node, Next, Tailwind, PG18+pgvector, Ollama models, Prisma 7 migrate) |

User decisions locked in: **Ollama local** · **PGVectorStore** · **Full library UI** · **Tailwind CSS**.

## 2. Tech stack (target versions)

- Node.js 20+, Next.js 15 (App Router, `runtime = "nodejs"` for all API routes)
- TypeScript strict, Tailwind CSS, `server-only` for all `lib/*` server modules
- `pg` + `@langchain/pgvector` (modern `PGVectorStore`, not legacy `langchain-community` PGVector)
- `@langchain/openai`, `@langchain/core`, `@langchain/textsplitters`, `@langchain/langgraph`
- `@langchain/community` (only for `PDFLoader` / `DocxLoader`), `mammoth` / `pdf-parse` come transitively — no custom parsing
- `prisma@7`, `@prisma/client@7`, `dotenv`
- PostgreSQL 18 + pgvector extension, DB name **`langchain_simple_rag`** (PG user `postgres`, password `admin`)
- Ollama serving OpenAI-compatible API at `http://localhost:11434/v1`, chat model `qwen3.5:9b` (via `MODEL_ID`), embedding model `nomic-embed-text`

## 3. Environment — exactly 4 required vars

File: `.env` (gitignored):

```env
DATABASE_URL="postgresql://postgres:admin@localhost:5432/langchain_simple_rag?schema=public"
API_URL="http://localhost:11434/v1"
API_KEY="ollama"
MODEL_ID="qwen3.5:9b"
```

- `API_URL` → passed as `baseURL`/`openAIApiBase` to both `ChatOpenAI` and `OpenAIEmbeddings`. Works for Ollama today, vLLM/LM Studio tomorrow without code change.
- `API_KEY` → Ollama ignores value but OpenAI SDK requires one; keep `ollama`.
- `MODEL_ID` → chat/completion model ID sent to the OpenAI-compatible endpoint (`qwen3.5:9b` on Ollama). Changing the chat model requires only a `.env` change + `ollama pull <new-id>` + restart — no code change.
- Embedding model stays a **code default, not env** (keeps chat model configurable without touching vector dims): `nomic-embed-text` (768 dims). If operator pulls a different embed model, update one constant in `lib/embeddings.ts` + HNSW dims in `lib/vector-store.ts`.
- `prisma.config.ts` reads `DATABASE_URL` via `import "dotenv/config"` + `env("DATABASE_URL")`.

## 4. Target project structure

```
./
├── app/
│   ├── api/
│   │   ├── documents/route.ts          # POST {source,content} text ingest; GET library list
│   │   ├── documents/upload/route.ts   # POST multipart FormData, multi-file pdf/docx/txt/md
│   │   ├── documents/[id]/route.ts     # DELETE one document (Prisma + vector delete)
│   │   └── chat/route.ts               # POST {question} → askRag
│   ├── layout.tsx
│   ├── page.tsx                        # composes client components, no inline types
│   └── globals.css                     # tailwind directives only
├── components/
│   ├── TextIngestForm.tsx
│   ├── FileUploadForm.tsx              # <input multiple accept=".pdf,.docx,.txt,.md">
│   ├── DocumentLibrary.tsx             # list + delete + chunk counts
│   └── ChatPanel.tsx                   # ask + answer + sources
├── lib/
│   ├── prisma.ts                       # Prisma 7 singleton (globalThis cache)
│   ├── embeddings.ts                   # OpenAIEmbeddings({model: nomic-embed-text, baseURL: API_URL})
│   ├── llm.ts                          # ChatOpenAI({model: MODEL_ID, baseURL: API_URL, temperature:0})
│   ├── vector-store.ts                 # PGVectorStore.initialize singleton + createHnswIndex
│   ├── chunking.ts                     # RecursiveCharacterTextSplitter(1000/150)
│   ├── loaders.ts                      # LangChain PDFLoader/DocxLoader → {text, fileName}
│   └── rag-service.ts                  # ingestText, ingestFiles, listDocuments, deleteDocument, askRag
│   └── rag-graph.ts                    # LangGraph StateGraph retrieve→generate (uses retriever)
├── types/
│   ├── document.types.ts               # DocumentItem, IngestResult, FileKind
│   ├── rag.types.ts                    # RetrievedSource, ChatResult, RAGState
│   ├── api.types.ts                    # API error/success envelopes
│   └── index.ts                        # barrel re-export
├── prisma/
│   ├── schema.prisma                   # Document metadata model only (no vector column)
│   └── migrations/                     # 0001_init: CREATE EXTENSION vector + documents table
├── prisma.config.ts                    # Prisma 7 defineConfig (schema path, migrations path, datasource url)
├── .env
└── package.json / tsconfig.json (alias @/*)
```

Why this split: Prisma owns `documents` table (library UI needs fast list/delete without vector scan). `PGVectorStore` owns `langchain_pg_collection` + `langchain_pg_embedding` tables (auto-created by `.initialize()`). Join key = `documentId` stored in vector metadata + Prisma row `id`. Never model the vector column in Prisma schema.

## 5. Complete installation process (plan must execute in this order)

1. **Prereqs**: Node 20+ (`node -v`), PostgreSQL 18 running, Ollama installed & serving (`ollama serve` → `http://localhost:11434`).
2. **Ollama models** (must match `.env` `MODEL_ID`):
   ```
   ollama pull nomic-embed-text
   ollama pull qwen3.5:9b
   curl http://localhost:11434/v1/models -H "Authorization: Bearer ollama"
   ```
   Confirm `qwen3.5:9b` appears in the models list — that is the value `lib/llm.ts` will send. Note dims: `nomic-embed-text` = 768. All vector dims in plan assume 768.
3. **Postgres + pgvector** (password `admin`, DB `langchain_simple_rag`):
   ```sql
   CREATE DATABASE langchain_simple_rag;
   \c langchain_simple_rag
   CREATE EXTENSION IF NOT EXISTS vector;
   SELECT * FROM pg_extension WHERE extname='vector';
   ```
   Connect as user `postgres` with password `admin` (matches `DATABASE_URL`). If `vector is not available`, install pgvector build matching PG18 before continuing — Prisma cannot fix this.
4. **Scaffold Next.js** (in empty `E:\RAG\langchain-simple-rag` or new subfolder; repo currently has only `instructions.md`):
   ```
   npx create-next-app@latest . --typescript --app --tailwind --eslint --src-dir=false
   ```
   If dir non-empty, scaffold to `simple-rag/` then move, or use `--tailwind` flag as above.
5. **Install deps**:
   ```
   npm install @langchain/core @langchain/openai @langchain/textsplitters @langchain/langgraph @langchain/pgvector @langchain/community pg server-only
   npm install @prisma/client@7
   npm install -D prisma@7 dotenv @types/pg @types/node
   npx prisma init
   ```
6. **Write `.env`** with the 4 vars (§3), `DATABASE_URL` pointing to `langchain_simple_rag` with password `admin`, `MODEL_ID="qwen3.5:9b"`.
7. **Prisma 7 config** — overwrite generated `prisma.config.ts`:
   ```ts
   import "dotenv/config";
   import { defineConfig, env } from "prisma/config";
   export default defineConfig({
     schema: "prisma/schema.prisma",
     migrations: { path: "prisma/migrations" },
     datasource: { url: env("DATABASE_URL") },
   });
   ```
8. **Prisma schema** (`prisma/schema.prisma`) — metadata only:
   ```prisma
   generator client { provider = "prisma-client-js" }
   // NOTE: Prisma 7 datasource URL lives in prisma.config.ts, not here
   model Document {
     id         String   @id @default(uuid()) @db.Uuid
     source     String   @unique
     fileType   String   // text | pdf | docx | txt | md
     sizeBytes  Int
     chunkCount Int      @default(0)
     createdAt  DateTime @default(now()) @map("created_at")
     @@map("documents")
   }
   ```
   Migration `0001_init/migration.sql`: `CREATE EXTENSION IF NOT EXISTS vector;` + `CREATE TABLE documents (...)`. LangChain embedding tables are created at runtime by `PGVectorStore.initialize()` — do NOT create them in Prisma migration.
9. **Apply**: `npx prisma migrate dev --name init && npx prisma generate`.
10. **Tailwind check**: `app/globals.css` has `@tailwind base; @tailwind components; @tailwind utilities;`, `tailwind.config.ts` content covers `app/`, `components/`.
11. **Run**: `npm run dev` → `http://localhost:3000`. Verify §9 test flow.

## 6. Implementation details per file

### 6.1 `types/` (no logic, only interfaces — imported by lib, routes, components)
- `types/document.types.ts`: `FileKind = "text"|"pdf"|"docx"|"txt"|"md"`, `DocumentItem {id, source, fileType, sizeBytes, chunkCount, createdAt}`, `IngestResult {documentId, source, chunksCreated}`, `UploadResult {results: IngestResult[], errors: {file, error}[]}`.
- `types/rag.types.ts`: `RetrievedSource {id, source, content, distance}`, `ChatResult {answer, sources: RetrievedSource[]}`, `RAGState {question, context, sources, answer}`.
- `types/api.types.ts`: `ApiError {error: string}`, `ApiOk<T> = T & {message?: string}`.
- `types/index.ts`: barrel. Rule: no component/route defines its own duplicate `Source` type — always import from `@/types`.

### 6.2 `lib/prisma.ts` — reuse instructions.md singleton pattern verbatim (globalThis cache, dev only).

### 6.3 `lib/embeddings.ts` + `lib/llm.ts` — LangChain OpenAI-compatible
```ts
// embeddings.ts
import "server-only";
import { OpenAIEmbeddings } from "@langchain/openai";
export const embeddings = new OpenAIEmbeddings({
  model: "nomic-embed-text",
  baseURL: process.env.API_URL!,   // http://localhost:11434/v1
  apiKey: process.env.API_KEY!,    // "ollama"
  dimensions: 768,                 // must match nomic-embed-text
});
// llm.ts
import { ChatOpenAI } from "@langchain/openai";
export const llm = new ChatOpenAI({
  model: process.env.MODEL_ID!,    // "qwen3.5:9b" from .env
  baseURL: process.env.API_URL!,
  apiKey: process.env.API_KEY!,
  temperature: 0,
});
```
Fail fast if `API_URL` / `API_KEY` / `MODEL_ID` missing (throw at import). Do NOT hardcode `qwen3.5:9b` in code — it must come from `MODEL_ID` so a model swap is a `.env`-only change.

### 6.4 `lib/vector-store.ts` — PGVectorStore singleton (the core improvement)
```ts
import "server-only";
import { PGVectorStore } from "@langchain/pgvector";
import { embeddings } from "@/lib/embeddings";
let cached: PGVectorStore | null = null;
export async function getVectorStore() {
  if (cached) return cached;
  const store = await PGVectorStore.initialize(embeddings, {
    postgresConnectionOptions: { connectionString: process.env.DATABASE_URL! },
    tableName: "langchain_pg_embedding",
    collectionTableName: "langchain_pg_collection",
    collectionName: "documents",
    columns: { idColumnName: "id", vectorColumnName: "vector", contentColumnName: "content", metadataColumnName: "metadata" },
    distanceStrategy: "cosine",
  });
  await store.createHnswIndex({ dimensions: 768, m: 16, efConstruction: 64 }).catch(()=>{});
  cached = store; return store;
}
```
Use `connectionString` (single `DATABASE_URL` with `postgres:admin`) rather than host/port/user split. Reuse across requests; call `store.end()` only on process exit.

### 6.5 `lib/chunking.ts` — keep `RecursiveCharacterTextSplitter({chunkSize:1000, chunkOverlap:150})` + `\r\n` normalize from instructions.md; export `chunkText(text: string): Promise<string[]>`.

### 6.6 `lib/loaders.ts` — LangChain file parsing (new vs original)
- Route by extension: `.pdf` → `PDFLoader` (`@langchain/community/document_loaders/fs/pdf`), `.docx` → `DocxLoader` (`.../fs/docx`), `.txt`/`.md` → `TextLoader`.
- Accept `Buffer` from `FormData.file.arrayBuffer()`; write to temp file or use loader's `blob` mode. Return concatenated `pageContent` + per-page metadata preserved into chunk metadata.
- Enforce: max 10 files/request, each ≤15MB, total text ≤200k chars (same cap as original text route).

### 6.7 `lib/rag-service.ts` — replaces `lib/documents.ts` raw SQL
- `ingestText(source, text)`: chunk → `store.addDocuments(docs with metadata {documentId, source, chunkIndex, totalChunks})` in one batch → `prisma.document.upsert({where:{source}, create/update chunkCount})`. No manual UUID loop, no `$executeRaw`.
- `ingestFiles(files)`: for each file → `loaders.ts` → `ingestText(filename, text)`; collect per-file success/error (multi-upload never fails whole batch on one bad file).
- `listDocuments()`: `prisma.document.findMany({orderBy:{createdAt:"desc"}})` — no vector scan.
- `deleteDocument(id)`: `store.delete({filter:{documentId:id}})` + `prisma.document.delete({where:{id}})`.
- `searchSimilar(question, k=4)`: `store.similaritySearchWithScore(question, k)` → map to `RetrievedSource` (score→distance). Optionally `store.asRetriever({k})` for graph use.

### 6.8 `lib/rag-graph.ts` — LangGraph, cleaned
- Remove dead `SourceAnnotation`. Single `RAGState` Annotation (`question, context, sources, answer`).
- `retrieve`: `getVectorStore().then(s => s.similaritySearchWithScore(state.question, 4))`, build `[Source N: name]` context string.
- `generate`: same system prompt as instructions.md (answer only from context, admit insufficiency, cite `[Source N]`), `llm.invoke` (model resolved from `MODEL_ID=qwen3.5:9b`).
- `new StateGraph(RAGState).addNode("retrieve").addNode("generate").addEdge(START,"retrieve").addEdge("retrieve","generate").addEdge("generate",END).compile()`, export `askRag(question)`.

### 6.9 API routes
- `POST /api/documents` (JSON `{source, content}`): validate non-empty, 200k cap → `ingestText` → `{message, documentId, source, chunksCreated}`. Status 400/413/500 with `{error}`.
- `POST /api/documents/upload` (multipart): `await request.formData()`, `getAll("files")`, validate count/size/type → `ingestFiles` → `{message, results, errors}` (207 if partial). `runtime="nodejs"`, no JSON body parsing.
- `GET /api/documents`: `listDocuments()` → `{documents: DocumentItem[]}` for library UI.
- `DELETE /api/documents/[id]`: `deleteDocument` → `{message, id}`.
- `POST /api/chat` (JSON `{question}`): trim, non-empty, 4000 cap → `askRag` → `ChatResult`. Keep thin.

### 6.10 UI (Tailwind, client components, imports types from `@/types`)
- `app/page.tsx` (server): header + grid `TextIngestForm | FileUploadForm`, `DocumentLibrary`, `ChatPanel`; no `useState` here.
- `TextIngestForm.tsx`: title + textarea → `fetch POST /api/documents` JSON; busy/status states.
- `FileUploadForm.tsx`: `<input type="file" multiple accept=".pdf,.docx,.txt,.md">` + selected file list + size check → `FormData.append("files", f)` → `POST /api/documents/upload`; show per-file results/errors, refresh library.
- `DocumentLibrary.tsx`: `useEffect GET /api/documents`, table/cards with source, type badge, chunks, date, Delete button → `DELETE`; refresh after any ingest.
- `ChatPanel.tsx`: question textarea → `POST /api/chat` → answer (`whitespace-pre-wrap`) + sources list with `distance.toFixed(4)`.
- Styling: Tailwind panels (`bg-white rounded-xl border p-6`), no custom `globals.css` classes from original except tailwind directives.

## 7. Verification

1. `npx prisma migrate dev`, `npx tsc --noEmit`, `npm run dev` all green.
2. Text flow: ingest `employee-policy.txt` (20 days leave sample from instructions.md §15) → `Indexed 1 chunk(s)` → ask `How many days of annual leave do employees get?` → answer cites 20 days + `[Source 1]` visible (generated by `MODEL_ID=qwen3.5:9b`).
3. File flow: upload a 2-page PDF + a DOCX together (multi) → both appear in library with correct `chunkCount` → ask a question answerable only from PDF → correct source filename shown → DELETE one doc → `GET /api/documents` no longer lists it and its chunks no longer retrieve (ask again → insufficient-context message).
4. DB checks in `psql langchain_simple_rag` (connect as `postgres` / `admin`): `SELECT COUNT(*) FROM documents;` ≥3; `SELECT collection_name FROM langchain_pg_collection;` has `documents`; `SELECT vector_dims(vector) FROM langchain_pg_embedding LIMIT 1;` = 768.
5. Negative: empty question → 400, oversized doc → 413, bad file type → per-file error, Ollama down or wrong `MODEL_ID` → 500 `{error:"Failed to answer..."}` not stack leak.

## 8. Out of scope / follow-ups (do not implement now)

Auth/rate-limit, hybrid BM25 search (`PGVectorStore` supports it — enable later), query-rewriting/conditional routing in graph, streaming, chat history, observability. Note dims coupling: switching embed model requires `DROP TABLE langchain_pg_embedding` + re-ingest (document in README).

Sources:
- [PGVectorStore integration - Docs by LangChain](https://docs.langchain.com/oss/javascript/integrations/vectorstores/pgvector)
- [Reference documentation for the prisma config file (Prisma ORM v7)](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [How to Use Ollama's OpenAI-Compatible API - ML Journey](https://mljourney.com/how-to-use-ollamas-openai-compatible-api/)
