/**
 * PDF → cleaned per-page text, plus a quality check so scanned or badly encoded
 * books are skipped instead of polluting the vector store with garbage.
 */
import { PDFParse } from 'pdf-parse';
import { buildChunks, normalizeText, type BuiltChunk } from '../../src/rag/chunking';

export type PageText = { num: number; text: string };

export type QualityReport = {
  ok: boolean;
  reason?: string;
  pages: number;
  avgCharsPerPage: number;
  emptyPageRatio: number;
  garbageCharRatio: number;
  wordLikeRatio: number;
};

// Symbol-font glyphs that pdf.js leaves in the private-use area (U+F0xx).
const SYMBOL_FONT_MAP: Record<number, string> = {
  0xf0b4: '×',
  0xf0b8: '÷',
  0xf0b7: '•',
  0xf0bb: '≈',
  0xf0d0: '∠',
  0xf0b0: '°',
  0xf0b1: '±',
  0xf0a3: '≤',
  0xf0b3: '≥',
  0xf0b9: '≠',
  0xf0d6: '√',
};

/**
 * Repairs two encoding quirks seen in these PDFs:
 *  - fonts mapped to U+F020–U+F0FF (ASCII + 0xF000, e.g. U+F065 = "e");
 *  - letters byte-swapped into U+XX00 (e.g. U+6600 = "f"), seen in some primary books.
 */
export function repairPdfText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    // Symbol-font bracket pieces (tall matrix/brace parts) carry no text.
    .replace(/[\uF8E5-\uF8FF]/g, '')
    .replace(/[\uF020-\uF0FF]/g, (ch) => {
      const code = ch.charCodeAt(0);
      if (code <= 0xf07e) return String.fromCharCode(code - 0xf000);
      return SYMBOL_FONT_MAP[code] ?? '';
    })
    .replace(/[\u4100-\u5A00\u6100-\u7A00]/g, (ch) => {
      const code = ch.charCodeAt(0);
      return (code & 0xff) === 0 ? String.fromCharCode(code >> 8) : ch;
    });
}

export async function readPdfPages(buffer: Buffer): Promise<PageText[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({ num: p.num, text: repairPdfText(p.text ?? '') }));
  } finally {
    await parser.destroy();
  }
}

const squash = (line: string) => line.replace(/\s+/g, ' ').trim();

/**
 * Text layers in these books repeat decorative running headers on every page,
 * sometimes as letter-by-letter garbage ("ys ys yy iic icss SSSta ... Ph Ph Phyyyy").
 */
function isGarbledHeaderLine(line: string): boolean {
  const tokens = squash(line).split(' ').filter(Boolean);
  if (tokens.length < 6) {
    return false;
  }
  const shortRatio = tokens.filter((t) => t.length <= 2).length / tokens.length;
  let adjacentDupes = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) adjacentDupes++;
  }
  const tripled = tokens.some((t) => /([A-Za-z])\1\1/.test(t));
  return shortRatio > 0.5 && (adjacentDupes >= 2 || tripled);
}

/** Removes page numbers, running headers/footers and garbled header lines. */
export function cleanPages(pages: PageText[]): PageText[] {
  const lineCounts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set(page.text.split('\n').map(squash).filter(Boolean));
    for (const line of seen) {
      lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
    }
  }
  const repeatThreshold = Math.max(4, Math.ceil(pages.length * 0.2));

  return pages.map((page) => {
    const kept = page.text.split('\n').filter((raw) => {
      const line = squash(raw);
      if (!line) return true; // keep blank lines: they mark paragraph breaks
      if (/^[\d\s.\-–|]+$/.test(line)) return false; // page numbers
      if (line.length <= 60 && (lineCounts.get(line) ?? 0) >= repeatThreshold) return false;
      return !isGarbledHeaderLine(line);
    });
    return { num: page.num, text: normalizeText(kept.join('\n')) };
  });
}

// CJK, Hangul, private-use and replacement characters only show up in these
// books when a non-Unicode Indic font was decoded wrongly.
const GARBAGE_RE = /[\u2E80-\u9FFF\uAC00-\uD7AF\uE000-\uF8FF\uFFFD]/g;
const INDIC_RE = /[\u0900-\u0DFF]/g;

/**
 * `strictIndic` adds checks for legacy Indic font garbage. Only enable it for
 * non-English-medium books: English books trip it on symbol/ligature glyphs.
 * `requireEnglish` rejects other-language editions (Hindi/Urdu/Sanskrit books
 * that share a folder with the English edition).
 */
export function assessQuality(
  pages: PageText[],
  opts: { strictIndic?: boolean; requireEnglish?: boolean } = {},
): QualityReport {
  const total = pages.length || 1;
  const all = pages.map((p) => p.text).join('\n');
  const nonSpace = all.replace(/\s/g, '');
  const chars = nonSpace.length || 1;

  const emptyPageRatio = pages.filter((p) => p.text.trim().length < 50).length / total;
  const avgCharsPerPage = Math.round(nonSpace.length / total);
  const garbageCharRatio = (nonSpace.match(GARBAGE_RE)?.length ?? 0) / chars;
  const indicRatio = (nonSpace.match(INDIC_RE)?.length ?? 0) / chars;

  const tokens = all.split(/\s+/).filter((t) => /[A-Za-z]/.test(t));
  const wordLike = tokens.filter((t) => /^[A-Za-z'’-]{2,}[.,;:!?)"’]*$/.test(t) && /[aeiouy]/i.test(t));
  const wordLikeRatio = tokens.length ? wordLike.length / tokens.length : 0;

  const report: QualityReport = {
    ok: true,
    pages: pages.length,
    avgCharsPerPage,
    emptyPageRatio: Number(emptyPageRatio.toFixed(2)),
    garbageCharRatio: Number(garbageCharRatio.toFixed(4)),
    wordLikeRatio: Number(wordLikeRatio.toFixed(2)),
  };

  if (emptyPageRatio > 0.5 || avgCharsPerPage < 150) {
    return { ...report, ok: false, reason: 'little or no text layer (scanned/image-only PDF)' };
  }
  if (opts.requireEnglish) {
    const letters = nonSpace.match(/\p{L}/gu)?.length ?? 0;
    const latin = nonSpace.match(/[A-Za-z]/g)?.length ?? 0;
    if (!letters || latin / letters < 0.85 || wordLikeRatio < 0.75) {
      return { ...report, ok: false, reason: 'not an English-language edition' };
    }
  }
  // Legacy Tamil/Kannada/Malayalam fonts decode into Indic letters interleaved
  // with Latin letters inside words, or into Latin Extended-A ("Ĥ@8^!").
  const indicChars = nonSpace.match(INDIC_RE)?.length ?? 0;
  const mixedJoins = nonSpace.match(/[\u0900-\u0DFF][A-Za-z]|[A-Za-z][\u0900-\u0DFF]/g)?.length ?? 0;
  // Legacy-font soup made of Latin-1/modifier symbols ("w¸ ™²³O²l [ ³{"), e.g. Syriac books.
  const symbolSoupRatio = (nonSpace.match(/[\u00A1-\u00BF\u02C0-\u02FF\u2122]/g)?.length ?? 0) / chars;
  const latinExtRatio = (nonSpace.match(/[\u0100-\u017F]/g)?.length ?? 0) / chars;
  if (
    garbageCharRatio > 0.005 ||
    symbolSoupRatio > 0.01 ||
    (opts.strictIndic &&
      (latinExtRatio > 0.005 || (indicChars > 0 && mixedJoins / indicChars > 0.02)))
  ) {
    return { ...report, ok: false, reason: 'text layer uses a legacy font encoding (garbled characters)' };
  }
  if (indicRatio < 0.3 && wordLikeRatio < 0.6) {
    return { ...report, ok: false, reason: 'extracted text does not look like readable words' };
  }
  return report;
}

/**
 * Chunks a page range with the shared RAG chunker and tags each chunk with the
 * PDF page its body starts on (located by whitespace-insensitive search).
 */
export function chunkPagesWithPageNo(pages: PageText[]): BuiltChunk[] {
  const parts: string[] = [];
  const pageStarts: { num: number; at: number }[] = [];
  let flatLen = 0;
  for (const page of pages) {
    const flat = squash(page.text);
    if (!flat) continue;
    pageStarts.push({ num: page.num, at: flatLen });
    parts.push(flat);
    flatLen += flat.length + 1;
  }
  const flatText = parts.join(' ');
  const text = pages
    .map((p) => p.text)
    .filter((t) => t.trim())
    .join('\n\n');

  const chunks = buildChunks(text);
  let cursor = 0;
  return chunks.map((chunk) => {
    const flat = squash(chunk.content);
    const probeAt = Math.min(Math.floor(flat.length / 3), Math.max(0, flat.length - 60));
    const probe = flat.slice(probeAt, probeAt + 60);
    let pos = flatText.indexOf(probe, cursor);
    if (pos < 0) pos = flatText.indexOf(probe);
    if (pos >= 0) cursor = pos;
    let pageNo: number | null = null;
    if (pos >= 0) {
      for (const ps of pageStarts) {
        if (ps.at <= pos) pageNo = ps.num;
        else break;
      }
    }
    return { ...chunk, pageNo };
  });
}
