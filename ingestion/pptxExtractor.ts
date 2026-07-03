import JSZip from "jszip";
import { parseStringPromise } from "xml2js";
import type { TextBlock } from "@/types";

interface SlideShape {
  "p:sp"?: unknown[];
}

export async function extractPptx(buffer: Buffer): Promise<{ blocks: TextBlock[]; pageCount: number }> {
  const zip = await JSZip.loadAsync(buffer);
  const blocks: TextBlock[] = [];

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0]);
      const numB = parseInt(b.match(/\d+/)![0]);
      return numA - numB;
    });

  const pageCount = slideFiles.length;

  for (let slideIndex = 0; slideIndex < slideFiles.length; slideIndex++) {
    const slideXml = await zip.files[slideFiles[slideIndex]].async("string");
    const parsed = await parseStringPromise(slideXml, { explicitArray: true });

    const spTree = parsed?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0] as SlideShape | undefined;
    if (!spTree || !spTree["p:sp"]) continue;

    for (const shape of spTree["p:sp"] as unknown[]) {
      const sp = shape as Record<string, unknown>;
      const nvSpPr = (sp["p:nvSpPr"] as unknown[])?.[0] as Record<string, unknown> | undefined;
      const ph = ((nvSpPr?.["p:nvPr"] as unknown[])?.[0] as Record<string, unknown>)?.[
        "p:ph"
      ] as unknown[];

      const isTitle =
        ph &&
        ph[0] &&
        ((ph[0] as Record<string, Record<string, string>>)["$"]?.["type"] === "title" ||
          (ph[0] as Record<string, Record<string, string>>)["$"]?.["idx"] === "0" ||
          !(ph[0] as Record<string, Record<string, string>>)["$"]?.["idx"]);

      const txBody = (sp["p:txBody"] as unknown[])?.[0] as Record<string, unknown> | undefined;
      if (!txBody) continue;

      const paragraphs = (txBody["a:p"] as unknown[]) ?? [];
      for (const para of paragraphs) {
        const p = para as Record<string, unknown>;
        const runs = (p["a:r"] as unknown[]) ?? [];
        const textParts: string[] = [];
        let fontSize = isTitle ? 28 : 16;
        let isBold = isTitle ? true : false;

        for (const run of runs) {
          const r = run as Record<string, unknown>;
          const rPr = (r["a:rPr"] as unknown[])?.[0] as Record<string, Record<string, string>> | undefined;
          const t = (r["a:t"] as string[])?.[0] ?? "";
          textParts.push(t);

          if (rPr?.["$"]) {
            const szStr = rPr["$"]["sz"];
            if (szStr) fontSize = parseInt(szStr) / 100;
            if (rPr["$"]["b"] === "1") isBold = true;
          }
        }

        const text = textParts.join("").trim();
        if (text.length < 2) continue;
        blocks.push({ text, fontSize, isBold, pageNum: slideIndex + 1 });
      }
    }
  }

  return { blocks, pageCount };
}
