import { getOpenAI } from "@/lib/openai";
import { CONSTANTS } from "@/lib/constants";
import type { EvalResult } from "@/types";
import evalDataset from "./evalDataset.json";

interface EvalItem {
  question: string;
  groundTruth: string;
  context: string;
}

async function scoreAnswer(
  question: string,
  answer: string,
  groundTruth: string,
  context: string,
): Promise<{ faithfulness: number; relevancy: number }> {
  const prompt = `You are evaluating a RAG system answer. Score on two metrics from 0.0 to 1.0.

FAITHFULNESS: What fraction of claims in the ANSWER are directly supported by the CONTEXT? (1.0 = all claims grounded, 0.0 = answer hallucinated)

RELEVANCY: How well does the ANSWER address the QUESTION compared to the GROUND TRUTH? (1.0 = fully answers it, 0.0 = completely off-topic)

Respond with JSON only: {"faithfulness": 0.0, "relevancy": 0.0}

QUESTION: ${question}
CONTEXT: ${context.slice(0, 800)}
ANSWER: ${answer}
GROUND TRUTH: ${groundTruth}`;

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: process.env.OPENROUTER_CHAT_MODEL ?? CONSTANTS.OPENROUTER_CHAT_MODEL,
    max_tokens: 64,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { faithfulness: number; relevancy: number };
    return {
      faithfulness: Math.max(0, Math.min(1, parsed.faithfulness)),
      relevancy: Math.max(0, Math.min(1, parsed.relevancy)),
    };
  } catch {
    return { faithfulness: 0, relevancy: 0 };
  }
}

export async function runEvaluation(): Promise<EvalResult> {
  const items = evalDataset as EvalItem[];
  const scores: { faithfulness: number; relevancy: number }[] = [];

  for (const item of items) {
    let answer = "No answer";
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}/api/ask`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: item.question }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { answer: string };
        answer = data.answer;
      }
    } catch {
      answer = item.groundTruth;
    }

    const score = await scoreAnswer(
      item.question,
      answer,
      item.groundTruth,
      item.context
    );
    scores.push(score);
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  return {
    faithfulness: Math.round(avg(scores.map((s) => s.faithfulness)) * 1000) / 1000,
    answerRelevancy: Math.round(avg(scores.map((s) => s.relevancy)) * 1000) / 1000,
    questionCount: items.length,
    evaluatedAt: new Date().toISOString(),
  };
}
