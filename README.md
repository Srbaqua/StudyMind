# StudyMind

StudyMind is a Next.js app for turning lecture notes, PDFs, slide decks, and images into a searchable study workspace. It ingests documents, extracts text, chunks and embeds it, builds a topic graph, and lets you ask questions grounded in your own notes.

## Features

- Upload PDFs, PPTX files, and images
- OCR fallback for image-based notes
- Chunking and embedding pipeline backed by Supabase
- Semantic + keyword retrieval with reranking
- Knowledge graph generation and topic browsing
- Chat-style Q&A with inline citations
- Quiz generation from uploaded material
- Evaluation endpoint for the built-in dataset

## Memory & Knowledge Graph Layer (Cognee)

StudyMind uses [Cognee](https://www.cognee.ai) to add two things the base RAG pipeline
doesn't have on its own: memory of the learner across sessions, and relationship-level
structure over the notes content.

### Why this matters
The existing pipeline (`chunks` → embeddings → pgvector → UMAP/DBSCAN topic clusters)
is excellent at finding *which chunks are semantically similar* and grouping them into
topic blobs. What it cannot do is represent *how concepts relate to each other*
(e.g. "Dijkstra's algorithm relies on a priority queue", "DFS and topological sort are
connected"), and it has no memory of the individual student between questions — every
call to `/api/ask` was previously stateless except for the document content itself.
Cognee fills both gaps by building an actual knowledge graph via LLM-driven entity and
relationship extraction, on top of a graph + vector store.

### Two datasets, two purposes

| Dataset | What goes in | What it's for |
|---|---|---|
| `learner_memory` | Every question asked, the answer given, and related topics; plus a note each time a document is uploaded | Cross-session memory of *this student* — what they've asked, what they seem to still be confused about |
| `course_content` | The full extracted text of every uploaded document, section by section | A concept-relationship graph over *the material itself*, extracted by Cognee's LLM-driven graph construction — separate from and complementary to the UMAP/DBSCAN topic clusters |

### The four Cognee lifecycle operations, as used here

- **remember** (`lib/cognee.ts` → `rememberInteraction`) — implemented as `POST /api/v1/add`
  (ingest raw text into a dataset) followed by `POST /api/v1/cognify` (turn it into graph
  structure: entities + relationships). Called:
  - after every `/api/ask` response, to store the Q&A into `learner_memory`
  - after every successful document upload, to store both an upload-event note in
    `learner_memory` and the full document text in `course_content`
- **recall** (`recallMemory`) — implemented as `POST /api/v1/recall` with
  `search_type: GRAPH_COMPLETION`, which lets Cognee traverse the graph rather than
  just do nearest-neighbor lookup. Called twice per question, in parallel, against both
  datasets, and the results are merged into the prompt sent to the LLM in
  `retrieval/synthesizer.ts`.
- **improve** — Cognee runs enrichment as part of `cognify` automatically; a manual
  `improve`/memify pass can be triggered periodically (e.g. via a cron hitting
  `/api/v1/cognify` again on `learner_memory`) to re-weight the graph as more
  interactions accumulate. *(Stretch goal — not wired to a UI button in this build.)*
- **forget** (`forgetMemory`) — implemented as `DELETE /api/v1/datasets/{name}`.
  Exposed via `DELETE /api/memory` and the "Forget my learning history" button in the
  chat sidebar, so a student can wipe their memory graph once a subject/exam is done.

### Request flow for `POST /api/ask`

1. Hybrid retrieval (vector + keyword) → graph-hop expansion over the `topics` table → rerank — unchanged.
2. In parallel: `recallMemory(question, "learner_memory")` and `recallMemory(question, "course_content")`.
3. Both are merged into a single context block and passed into `synthesize()`, so the
   final answer can (a) build on what the student has asked before instead of repeating
   itself, and (b) surface concept relationships Cognee found that pure vector search
   would miss.
4. The Q&A is written back into `learner_memory` via `remember()` for next time.

### Environment variables

```bash
COGNEE_SERVICE_URL=https://your-instance.cognee.ai
COGNEE_API_KEY=ck_your_cognee_api_key
COGNEE_DATASET_NAME=learner_memory   # optional, defaults to learner_memory
```

StudyMind builds two separate graphs:

1. **Document knowledge graph** (`topics`/`chunks`, UMAP + DBSCAN) — a map of what's *in your notes*.
2. **Learner memory graph** (Cognee) — a map of *you*: what you've asked, what you've been told before,
   and what you keep coming back to.

Every `/api/ask` call now:
- calls `recall()` on the learner's memory before answering, so the model can build on prior
  questions instead of repeating itself,
- calls `remember()` after answering, storing the interaction into the learner's memory graph.

`GET /api/memory` summarizes the learner's memory graph for the "Your Learning Memory" panel.
`DELETE /api/memory` calls `forget()` to wipe it (e.g. once a subject/exam is done).

Requires `COGNEE_SERVICE_URL` and `COGNEE_API_KEY` — see Environment Variables.

## Tech Stack

- Next.js 14 App Router
- React 18 + TypeScript
- Supabase Postgres with pgvector
- OpenAI SDK pointed at OpenRouter-compatible endpoints
- Cohere rerank
- D3, UMAP, and DBSCAN for graph generation

## Prerequisites

- Node.js 18 or newer
- A Supabase project
- OpenRouter API key
- Cohere API key

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create a local env file.

```bash
copy .env.local.example .env.local
```

3. Fill in the required environment variables in `.env.local`.

4. Run the Supabase schema from [supabase/schema.sql](supabase/schema.sql).

5. Start the app.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

The app expects these values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_CHAT_MODEL=openai/gpt-oss-120b
OPENROUTER_SITE_URL=
OPENROUTER_APP_TITLE=StudyMind
COHERE_API_KEY=
```

## Supabase Schema

Run [supabase/schema.sql](supabase/schema.sql) to create:

- `documents`
- `chunks`
- `topics`
- `topic_edges`
- `query_logs`
- `vector_search` RPC

## Main Flow

1. Upload a document from the home page.
2. The upload API detects the file type and extracts text.
3. Text is chunked and embedded.
4. Chunks are stored in Supabase.
5. The knowledge graph can be built from embedded chunks.
6. The chat API retrieves relevant chunks, expands through graph links, reranks them, and generates an answer with citations.

## API Routes

- `POST /api/upload` - upload and process a document
- `GET /api/documents` - list all documents
- `GET /api/documents/[id]` - read one document
- `DELETE /api/documents/[id]` - delete one document
- `POST /api/ask` - answer a question from uploaded notes
- `POST /api/build-graph` - build the knowledge graph
- `GET /api/graph-status` - get graph counts and build status
- `GET /api/topics` - list topics
- `GET /api/topics/[id]` - get one topic and neighbors
- `GET /api/topics/[id]/chunks` - get chunks for a topic
- `POST /api/generate-quiz` - generate quiz questions
- `GET /api/eval` - run the evaluation dataset

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

