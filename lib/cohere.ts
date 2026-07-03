export async function cohereRerank(
  query: string,
  documents: string[],
  topN: number
): Promise<{ index: number; relevanceScore: number }[]> {
  const response = await fetch("https://api.cohere.com/v1/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "rerank-english-v3.0",
      query,
      documents,
      top_n: topN,
      return_documents: false,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cohere rerank failed: ${err}`);
  }
  const data = await response.json();
  return data.results.map((r: { index: number; relevance_score: number }) => ({
    index: r.index,
    relevanceScore: r.relevance_score,
  }));
}
