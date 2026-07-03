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

## Notes

- `eng.traineddata` is a local OCR asset and is intentionally ignored by Git.
- If you switch providers or models, update `.env.local` first.
- The graph builder needs embedded chunks, not just uploaded documents.
