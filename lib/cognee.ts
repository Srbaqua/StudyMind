const BASE_URL = process.env.COGNEE_SERVICE_URL ?? "";
const API_KEY = process.env.COGNEE_API_KEY ?? "";
const DEFAULT_DATASET = process.env.COGNEE_DATASET_NAME ?? "learner_memory";
export const CONTENT_DATASET = "course_content";

async function cogneeFetch(path: string, init: RequestInit): Promise<any> {
  if (!BASE_URL) {
    throw new Error("Cognee not configured: set COGNEE_SERVICE_URL");
  }

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  
  // Safely construct headers
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> || {}),
  };

  // Only append auth headers if a key actually exists
  if (API_KEY && API_KEY.trim() !== "") {
    headers["X-Api-Key"] = API_KEY;
    if (!BASE_URL.includes("aws.cognee.ai") && !BASE_URL.includes("api.cognee.ai")) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cognee ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * Write text into a Cognee dataset and turn it into graph structure.
 * `remember` automatically processes the text into the graph. Do not call
 * `cognify` immediately afterward to prevent SQLite database lock errors.
 */
export async function rememberInteraction(text: string, dataset: string = DEFAULT_DATASET): Promise<void> {
  const form = new FormData();
  const blob = new Blob([text], { type: "text/plain" });
  
  form.append("data", blob, "interaction.txt");
  // Cognee's Python backend expects snake_case for this parameter
  form.append("dataset_name", dataset);

  const result = await cogneeFetch("/api/v1/remember", {
    method: "POST",
    body: form,
  });
  
  console.log(`[cognee] remember → dataset="${dataset}":`, JSON.stringify(result));
  
  // NOTE: The manual /api/v1/cognify fetch has been removed. 
  // Cognee automatically builds the graph during the `remember` process.
}

export async function recallMemory(query: string, dataset: string = DEFAULT_DATASET): Promise<string> {
  let raw: any;
  try {
    raw = await cogneeFetch("/api/v1/recall", {
      method: "POST",
      body: JSON.stringify({
        query,
        datasets: [dataset],
        search_type: "GRAPH_COMPLETION",
        top_k: 8,
      }),
    });
  } catch (err) {
    const message = String(err);
    // Treat "not met", 404, or 409 as an empty graph rather than a hard crash
    if (
      message.includes("Recall prerequisites not met") ||
      message.includes("failed: 404") ||
      message.includes("failed: 409")
    ) {
      return "";
    }
    throw err;
  }

  const items: unknown[] = Array.isArray(raw) ? raw : raw?.results ?? raw?.data ?? [];

  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        return (obj.text as string) ?? (obj.content as string) ?? (obj.answer as string) ?? JSON.stringify(obj);
      }
      return "";
    })
    .filter(Boolean)
    .join("\n---\n");
}

export async function forgetMemory(dataset: string = DEFAULT_DATASET): Promise<void> {
  const list = await cogneeFetch("/api/v1/datasets", { method: "GET" });
  const datasets: unknown[] = Array.isArray(list) ? list : list?.datasets ?? list?.data ?? [];

  const match = datasets.find((d) => {
    if (d && typeof d === "object") {
      const obj = d as Record<string, unknown>;
      return obj.name === dataset || obj.dataset_name === dataset || obj.datasetName === dataset;
    }
    return false;
  }) as Record<string, unknown> | undefined;

  if (!match) {
    // Nothing to forget — dataset doesn't exist yet, treat as a no-op success.
    return;
  }

  const datasetId = (match.id ?? match.dataset_id ?? match.datasetId) as string | undefined;
  if (!datasetId) {
    throw new Error(`Could not resolve an id for dataset "${dataset}" from Cognee's dataset list`);
  }

  await cogneeFetch(`/api/v1/datasets/${encodeURIComponent(datasetId)}`, {
    method: "DELETE",
  });
}