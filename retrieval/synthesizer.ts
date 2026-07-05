import { getOpenAI } from "@/lib/openai";
import { CONSTANTS } from "@/lib/constants";
import type { RetrievedChunk, AskResponse, QuizQuestion } from "@/types";

function extractAnswerFallback(raw: string): string {
  // If JSON parsing failed (usually because the response got cut off by the
  // token limit before the closing brace), pull just the "answer" text out
  // instead of showing the raw broken JSON to the user.
  const match = raw.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return raw;

  let text = match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  if (!/[.!?]["')\]]?$/.test(text.trim())) {
    text = text.trim() + "…";
  }
  return text;
}

export async function synthesize(
  question: string,
  chunks: RetrievedChunk[],
  memoryContext: string = ""
): Promise<AskResponse> {
  const openai = getOpenAI();

  const context = chunks
    .map(
      (c, i) =>
        `[SOURCE ${i + 1}] Section: "${c.section}" | Page: ${c.page_num} | Doc: ${c.doc_id}\n${c.text}`
    )
    .join("\n\n---\n\n");

  const memoryBlock = memoryContext
    ? `ADDITIONAL CONTEXT FROM COGNEE MEMORY (may include the student's prior questions and/or concept relationships Cognee extracted from the notes; may be partial):
${memoryContext}

Use this to build on what the student already knows and to surface non-obvious connections between concepts, but do not force it in if it isn't relevant.
`
    : "";

  const prompt = `You are a study assistant helping a student understand their own lecture notes and academic documents.

STRICT RULES:
1. Answer ONLY using information from the provided sources
2. If the answer is not found in sources, say exactly: "I couldn't find this in your notes. Try uploading more documents on this topic."
3. Every factual claim must cite [SOURCE N] inline
4. After the answer, list 2-3 related topics to explore next
5. Keep the answer focused and complete — prefer a tight, well-organized answer (a short paragraph plus a few bullet points if needed) over an exhaustive one. Always finish your sentences and close the JSON properly; a shorter complete answer is better than a long cut-off one.

${memoryBlock}
Respond with valid JSON ONLY — no markdown fences, no explanation:
{
  "answer": "Your answer with [SOURCE N] citations inline...",
  "citations": [{"sourceNum": 1, "section": "...", "pageNum": 1, "docId": "...", "chunkId": "..."}],
  "relatedTopics": ["Topic A", "Topic B"]
}

STUDENT QUESTION: ${question}

SOURCES FROM STUDENT'S NOTES:
${context}`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENROUTER_CHAT_MODEL ?? CONSTANTS.OPENROUTER_CHAT_MODEL,
    max_tokens: CONSTANTS.OPENROUTER_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as {
      answer: string;
      citations: { sourceNum: number; section: string; pageNum: number; docId: string }[];
      relatedTopics: string[];
    };

    const citations = parsed.citations.map((c) => {
      const matchedChunk = chunks[c.sourceNum - 1];
      return {
        chunkId: matchedChunk?.id ?? "",
        section: c.section,
        pageNum: c.pageNum,
        docId: c.docId || matchedChunk?.doc_id || "",
        sourceNum: c.sourceNum,
      };
    });

    return {
      answer: parsed.answer,
      citations,
      relatedTopics: parsed.relatedTopics ?? [],
    };
  } catch {
    return { answer: extractAnswerFallback(raw), citations: [], relatedTopics: [] };
  }
}

export async function generateQuiz(
  topicName: string,
  chunks: RetrievedChunk[]
): Promise<QuizQuestion[]> {
  const openai = getOpenAI();
  const context = chunks.map((c) => c.text).join("\n\n").slice(0, 3000);

  const prompt = `Generate 3 multiple choice questions testing genuine understanding of "${topicName}".
Base them ONLY on the study notes below.

Respond with valid JSON ONLY:
{
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "Brief explanation of why this is correct"
    }
  ]
}

STUDY NOTES:
${context}`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENROUTER_CHAT_MODEL ?? CONSTANTS.OPENROUTER_CHAT_MODEL,
    max_tokens: 256,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { questions: QuizQuestion[] };
    return parsed.questions;
  } catch {
    return [];
  }
}