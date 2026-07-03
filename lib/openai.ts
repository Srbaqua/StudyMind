import OpenAI from "openai";

let _client: OpenAI | null = null;

function getOpenRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers["X-OpenRouter-Title"] = process.env.OPENROUTER_APP_TITLE;
  }

  return headers;
}

export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      defaultHeaders: getOpenRouterHeaders(),
    });
  }
  return _client;
}
