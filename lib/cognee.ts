const BASE_URL = process.env.COGNEE_SERVICE_URL ?? "";
const API_KEY = process.env.COGNEE_API_KEY ?? "";
const DATASET = process.env.COGNEE_DATASET_NAME ?? "learner_memory";

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

/** Store a piece of the student's learning history in the memory graph. */
export async function rememberInteraction(text: string, dataset: string = DATASET): Promise<void> {
  await cogneeFetch("/api/v1/add", {
    method: "POST",
    body: JSON.stringify({
      data: text,
    }),
  });

  await cogneeFetch("/api/v1/cognify", {
    method: "POST",
    body: JSON.stringify({
      datasets: [dataset],
    }),
  });
}

/**
 * Query the memory graph. Returns a flattened text block ready to drop into a prompt.
 * NOTE: the exact JSON shape of /recall can vary slightly by Cognee version — this
 * defensively handles the common shapes (array of strings, array of {text}, {results: [...]}).
 * If it comes back empty but you know memory exists, console.log(raw) once and adjust below.
 */
export async function recallMemory(query: string, dataset: string = DATASET): Promise<string> {
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

/** Wipe the learner's memory graph, e.g. after a subject/exam is done. */
export async function forgetMemory(dataset: string = DATASET): Promise<void> {
  await cogneeFetch(`/api/v1/datasets/${encodeURIComponent(dataset)}`, {
    method: "DELETE",
  });
}