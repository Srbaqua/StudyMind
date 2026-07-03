import { CONSTANTS } from "@/lib/constants";
import type { TextBlock } from "@/types";

interface RawChunk {
  sectionHeading: string;
  text: string;
  pageNum: number;
  chunkIndex: number;
}

export interface ProcessedChunk {
  sectionHeading: string;
  text: string;
  pageNum: number;
  chunkIndex: number;
  wordCount: number;
}

function detectHeadingThreshold(blocks: TextBlock[]): number {
  const sizes = blocks
    .filter((b) => b.text.trim().length > 0 && b.fontSize > 0)
    .map((b) => b.fontSize);

  if (sizes.length < 3) return 16;

  const sorted = [...sizes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median * CONSTANTS.HEADING_SIZE_MULTIPLIER;
}

function isHeadingBlock(block: TextBlock, threshold: number): boolean {
  const wordCount = block.text.trim().split(/\s+/).length;
  const sizeQualifies =
    block.fontSize >= threshold ||
    (block.isBold && block.fontSize >= threshold * 0.9);
  return sizeQualifies && wordCount <= CONSTANTS.MAX_HEADING_WORDS && block.text.length >= 3;
}

function splitLongChunk(chunk: RawChunk): RawChunk[] {
  const words = chunk.text.split(/\s+/);
  if (words.length <= CONSTANTS.MAX_CHUNK_WORDS) return [chunk];

  const result: RawChunk[] = [];
  let start = 0;
  let subIndex = 0;

  while (start < words.length) {
    const end = Math.min(start + CONSTANTS.MAX_CHUNK_WORDS, words.length);
    result.push({
      ...chunk,
      text: words.slice(start, end).join(" "),
      chunkIndex: chunk.chunkIndex + subIndex * 0.01,
    });
    start += CONSTANTS.MAX_CHUNK_WORDS - CONSTANTS.CHUNK_OVERLAP_WORDS;
    subIndex++;
  }

  return result;
}

export function chunkDocument(blocks: TextBlock[]): ProcessedChunk[] {
  const threshold = detectHeadingThreshold(blocks);
  const rawChunks: RawChunk[] = [];

  let currentHeading = "Introduction";
  let bodyBuffer: string[] = [];
  let currentPage = 1;
  let chunkIndex = 0;

  function flushSection() {
    const text = bodyBuffer.join(" ").trim();
    if (text.length >= CONSTANTS.MIN_CHUNK_CHARS) {
      rawChunks.push({
        sectionHeading: currentHeading,
        text,
        pageNum: currentPage,
        chunkIndex: chunkIndex++,
      });
    }
    bodyBuffer = [];
  }

  for (const block of blocks) {
    if (!block.text.trim()) continue;

    if (isHeadingBlock(block, threshold)) {
      flushSection();
      currentHeading = block.text.trim();
      currentPage = block.pageNum;
    } else {
      bodyBuffer.push(block.text);
      currentPage = block.pageNum;
    }
  }

  flushSection();

  const finalChunks: ProcessedChunk[] = rawChunks
    .flatMap(splitLongChunk)
    .filter((c) => c.text.trim().length >= CONSTANTS.MIN_CHUNK_CHARS)
    .map((c) => ({
      ...c,
      wordCount: c.text.split(/\s+/).length,
    }));

  return finalChunks;
}
