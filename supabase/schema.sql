-- StudyMind Supabase Schema
-- Run this complete SQL block in the Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT NOT NULL,
  subject     TEXT DEFAULT '',
  file_type   TEXT CHECK (file_type IN ('pdf', 'pptx', 'image')),
  page_count  INT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','error')),
  error_msg   TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section     TEXT DEFAULT '',
  text        TEXT NOT NULL,
  page_num    INT DEFAULT 1,
  chunk_index FLOAT DEFAULT 0,
  word_count  INT DEFAULT 0,
  embedding   VECTOR(1536),
  topic_ids   UUID[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  summary     TEXT DEFAULT '',
  embedding   VECTOR(1536),
  chunk_count INT DEFAULT 0,
  x2d         FLOAT,
  y2d         FLOAT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topic_edges (
  from_id  UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  to_id    UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  weight   FLOAT NOT NULL CHECK (weight BETWEEN 0 AND 1),
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS query_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT,
  latency_ms  INT,
  chunks_used INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS chunks_fts_idx
  ON chunks USING GIN (TO_TSVECTOR('english', text));

CREATE INDEX IF NOT EXISTS chunks_doc_id_idx ON chunks (doc_id);
CREATE INDEX IF NOT EXISTS chunks_topic_ids_idx ON chunks USING GIN (topic_ids);
CREATE INDEX IF NOT EXISTS edges_from_idx ON topic_edges (from_id);
CREATE INDEX IF NOT EXISTS edges_to_idx ON topic_edges (to_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_chunks" ON chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_topics" ON topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_edges" ON topic_edges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_logs" ON query_logs FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION vector_search(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 20
)
RETURNS TABLE(
  id UUID, text TEXT, section TEXT,
  page_num INT, doc_id UUID,
  topic_ids UUID[], score FLOAT
)
LANGUAGE SQL STABLE AS $$
  SELECT
    id, text, section, page_num, doc_id, topic_ids,
    1 - (embedding <=> query_embedding) AS score
  FROM chunks
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
