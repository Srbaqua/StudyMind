const BASE_URL = process.env.COGNEE_SERVICE_URL ?? "";
const API_KEY = process.env.COGNEE_API_KEY ?? "";
const DEFAULT_DATASET = process.env.COGNEE_DATASET_NAME ?? "learner_memory";
export const CONTENT_DATASET = "course_content";

async function cogneeFetch(path: string, init: RequestInit): Promise<any> {
  if (!BASE_URL || !API_KEY) {
    throw new Error("Cognee not configured: set COGNEE_SERVICE_URL and COGNEE_API_KEY");
  }
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init.headers || {}),
      "X-Api-Key": API_KEY,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cognee ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * Write text into a Cognee dataset and turn it into graph structure.
 * IMPORTANT: /api/v1/add only reliably accepts multipart/form-data — every
 * documented working example uses -F flags, never a JSON body. Sending
 * datasetName as JSON gets silently dropped, which was the actual cause
 * of the "Either datasetId or datasetName must be provided" 409.
 */
export async function rememberInteraction(text: string, dataset: string = DEFAULT_DATASET): Promise<void> {
  const form = new FormData();
  // Must be an actual file part (UploadFile), not a plain string field —
  // Cognee's /add endpoint rejects string fields with a 422.
  const blob = new Blob([text], { type: "text/plain" });
  form.append("data", blob, "interaction.txt");
  form.append("datasetName", dataset);

  await cogneeFetch("/api/v1/add", {
    method: "POST",
    body: form,
  });

  await cogneeFetch("/api/v1/cognify", {
    method: "POST",
    body: JSON.stringify({
      datasets: [dataset],
      run_in_background: true,
    }),
  });
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
    if (message.includes("Recall prerequisites not met") || message.includes("failed: 404")) {
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
  await cogneeFetch(`/api/v1/datasets/${encodeURIComponent(dataset)}`, {
    method: "DELETE",
  });
}