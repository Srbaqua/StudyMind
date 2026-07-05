const BASE_URL = process.env.COGNEE_SERVICE_URL ?? "";
const API_KEY = process.env.COGNEE_API_KEY ?? "";
const DEFAULT_DATASET = process.env.COGNEE_DATASET_NAME ?? "learner_memory";
export const CONTENT_DATASET = "course_content";

const isCloud = BASE_URL.includes("aws.cognee.ai") || BASE_URL.includes("api.cognee.ai");

const REMEMBER_RETRY_ATTEMPTS = 4;
const REMEMBER_RETRY_BASE_MS = 1000;

function jitter(ms: number) {
  return ms + Math.floor(Math.random() * 500);
}

function isRememberRetryableError(status: number, body: string) {
  if (status === 409) return true;
  if (status === 500 && /ProgrammingError|RetryError|database is locked/i.test(body)) return true;
  return false;
}

async function cogneeFetch(path: string, init: RequestInit): Promise<any> {
  if (!BASE_URL) {
    throw new Error("Cognee not configured: set COGNEE_SERVICE_URL");
  }

  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> || {}),
  };

  if (API_KEY && API_KEY.trim() !== "") {
    headers["X-Api-Key"] = API_KEY;
    if (!isCloud) {
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

async function cogneeFetchWithRetry(path: string, init: RequestInit): Promise<any> {
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt < REMEMBER_RETRY_ATTEMPTS; attempt++) {
    try {
      return await cogneeFetch(path, init);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const message = String(err);
      const match = message.match(/failed: (\d{3})(?: (.+))?$/);
      const status = match ? Number(match[1]) : 0;
      const body = match ? (match[2] || "") : message;

      if (!isRememberRetryableError(status, body) || attempt >= REMEMBER_RETRY_ATTEMPTS - 1) {
        throw error;
      }

      const delayMs = jitter(REMEMBER_RETRY_BASE_MS * 2 ** attempt);
      console.warn(`[cognee] remember retry ${attempt + 1}/${REMEMBER_RETRY_ATTEMPTS} in ${delayMs}ms: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      lastErr = error;
    }
  }

  throw lastErr ?? new Error("cogneeFetchWithRetry failed with no error captured");
}

/**
 * Write text into a Cognee dataset and turn it into graph structure.
 * `remember` automatically processes the text into the graph. Do not call
 * `cognify` immediately afterward to prevent SQLite database lock errors.
 */
export async function rememberInteraction(text: string, dataset: string = DEFAULT_DATASET): Promise<void> {
  // Get or create the mutex lock for this dataset
  const lock = getMemoryLock(dataset);
  
  const release = await lock.acquire();
  try {
    const form = new FormData();
    const blob = new Blob([text], { type: "text/plain" });
    
    form.append("data", blob, "interaction.txt");
    form.append("datasetName", dataset);

    const result = await cogneeFetchWithRetry("/api/v1/remember", {
      method: "POST",
      body: form,
    });
    
    console.log(`[cognee] remember → dataset="${dataset}":`, JSON.stringify(result));
  } finally {
    release();
  }
}

// Simple mutex for serializing memory operations per dataset
let memoryLocks: Map<string, { locked: boolean; waitQueue: (() => void)[] }> = new Map();

function getMemoryLock(dataset: string) {
  let lock = memoryLocks.get(dataset);
  if (!lock) {
    lock = { locked: false, waitQueue: [] };
    memoryLocks.set(dataset, lock);
  }
  
  return {
    acquire: () => new Promise<() => void>((resolve) => {
      if (!lock.locked) {
        lock.locked = true;
        resolve(() => {
          lock.locked = false;
          const next = lock.waitQueue.shift();
          if (next) next();
        });
      } else {
        lock.waitQueue.push(() => {
          lock.locked = true;
          resolve(() => {
            lock.locked = false;
            const next = lock.waitQueue.shift();
            if (next) next();
          });
        });
      }
    })
  };
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
  // Get list of datasets to find the ID for our dataset
  let listRaw: unknown;
  try {
    listRaw = await cogneeFetch("/api/v1/datasets", { method: "GET" });
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes("failed: 409") || errMsg.includes("failed: 500")) {
      await new Promise((r) => setTimeout(r, 2000));
      listRaw = await cogneeFetch("/api/v1/datasets", { method: "GET" });
    } else {
      throw err;
    }
  }

  const rawDatasets: unknown = Array.isArray(listRaw) ? listRaw : (listRaw as Record<string, unknown>)?.datasets ?? (listRaw as Record<string, unknown>)?.data;
   
  const datasets: unknown[] = Array.isArray(rawDatasets) ? rawDatasets : [];

  const match = datasets.find((d) => {
    if (d && typeof d === "object") {
      const obj = d as Record<string, unknown>;
      return obj.name === dataset || obj.dataset_name === dataset || obj.datasetName === dataset;
    }
    return false;
  }) as Record<string, unknown> | undefined;

  if (!match) {
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