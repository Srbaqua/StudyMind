export interface Document {
  id: string;
  filename: string;
  subject: string;
  file_type: "pdf" | "pptx" | "image";
  page_count: number | null;
  status: "pending" | "processing" | "ready" | "error";
  error_msg: string | null;
  uploaded_at: string;
}

export interface TextBlock {
  text: string;
  fontSize: number;
  isBold: boolean;
  pageNum: number;
}

export interface Chunk {
  id: string;
  doc_id: string;
  section: string;
  text: string;
  page_num: number;
  chunk_index: number;
  word_count: number;
  embedding?: number[];
  topic_ids: string[];
  documents?: { filename: string; subject: string };
}

export interface Topic {
  id: string;
  name: string;
  summary: string;
  chunk_count: number;
  x2d?: number;
  y2d?: number;
  created_at: string;
}

export interface TopicEdge {
  from_id: string;
  to_id: string;
  weight: number;
}

export interface GraphNode extends Topic {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

export interface Citation {
  chunkId: string;
  section: string;
  pageNum: number;
  docId: string;
  filename?: string;
  sourceNum: number;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  relatedTopics: string[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  relatedTopics?: string[];
  timestamp: Date;
}

export interface GraphStatus {
  topicsCount: number;
  edgesCount: number;
  chunksCount: number;
  lastBuilt: string | null;
  isBuilding: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface RetrievedChunk extends Chunk {
  score: number;
  rerankScore?: number;
  source: "vector" | "keyword" | "graph";
}

export interface EvalResult {
  faithfulness: number;
  answerRelevancy: number;
  questionCount: number;
  evaluatedAt: string;
}
