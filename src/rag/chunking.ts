export type BuiltChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  section?: string | null;
  pageNo?: number | null;
};

const WORDS_PER_TOKEN = 0.75;

export const estimateTokens = (text: string): number =>
  Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / WORDS_PER_TOKEN);

export const normalizeText = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function buildChunks(
  sourceText: string,
  targetTokens = 450,
  overlapTokens = 80,
): BuiltChunk[] {
  const clean = normalizeText(sourceText);
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: BuiltChunk[] = [];
  let currentParts: string[] = [];
  let currentTokens = 0;
  let chunkIndex = 0;

  const flush = () => {
    if (!currentParts.length) {
      return;
    }

    const content = currentParts.join('\n\n').trim();
    if (!content) {
      return;
    }

    chunks.push({
      chunkIndex: chunkIndex++,
      content,
      tokenCount: estimateTokens(content),
      section: null,
      pageNo: null,
    });

    const words = content.split(/\s+/).filter(Boolean);
    const overlapWordCount = Math.ceil(overlapTokens * WORDS_PER_TOKEN);
    const tail = words.slice(-overlapWordCount).join(' ').trim();

    currentParts = tail ? [tail] : [];
    currentTokens = tail ? estimateTokens(tail) : 0;
  };

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokens(paragraph);

    if (paragraphTokens > targetTokens) {
      const sentences = paragraph.split(/(?<=[.?!])\s+/).filter(Boolean);
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokens(sentence);
        if (currentTokens + sentenceTokens > targetTokens) {
          flush();
        }
        currentParts.push(sentence);
        currentTokens += sentenceTokens;
      }
      continue;
    }

    if (currentTokens + paragraphTokens > targetTokens) {
      flush();
    }

    currentParts.push(paragraph);
    currentTokens += paragraphTokens;
  }

  flush();
  return chunks;
}
