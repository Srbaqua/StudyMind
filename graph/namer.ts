import { getOpenAI } from "@/lib/openai";
import { CONSTANTS } from "@/lib/constants";

interface ChunkForNaming {
  text: string;
  section: string;
}

export async function nameTopic(
  centralChunks: ChunkForNaming[]
): Promise<{ name: string; summary: string }> {
  const openai = getOpenAI();

  const excerpts = centralChunks
    .slice(0, 3)
    .map((c, i) => `EXCERPT ${i + 1} (${c.section}):\n${c.text.slice(0, 400)}`)
    .join("\n\n");

  const prompt = `You are analyzing student study notes. The following are excerpts from notes that are all about the same academic topic.
Give this topic:
1. A concise name (3-7 words, like a textbook chapter heading)
2. A one-sentence summary (max 20 words) of what this topic covers

Respond with valid JSON ONLY — no markdown, no explanation, no code fences:
{"name": "...", "summary": "..."}

${excerpts}`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENROUTER_CHAT_MODEL ?? CONSTANTS.OPENROUTER_CHAT_MODEL,
      max_tokens: 96,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as { name: string; summary: string };
    return {
      name: parsed.name || "Unnamed Topic",
      summary: parsed.summary || "",
    };
  } catch {
    return {
      name: centralChunks[0]?.section?.slice(0, 40) || "Unnamed Topic",
      summary: "",
    };
  }
}
