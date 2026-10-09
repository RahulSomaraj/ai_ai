/**
 * Chapter boundaries from a textbook's table of contents.
 *
 * TOC layouts differ per book (dotted leaders, page ranges, wrapped titles,
 * numbers on separate lines), so the first pages are read by the chat model and
 * the result is checked against the body: each chapter title must actually
 * appear near the PDF page we compute for it.
 */
import OpenAI from 'openai';
import type { PageText } from './extract';

export type TocChapter = { number: number; title: string; startPage: number };

export type ChapterRange = {
  number: number;
  title: string;
  /** Inclusive PDF page indices (1-based). */
  fromPage: number;
  toPage: number;
};

const TOC_SCAN_PAGES = 30;
const FRONT_MATTER_PAGES = 30;
const TOC_CHAR_LIMIT = 24_000;

/** How much a page looks like a table of contents: lines ending in page numbers. */
function contentsScore(text: string): number {
  const numbered = text.split('\n').filter((l) => /\s\d{1,3}\s*$/.test(l)).length;
  return numbered + (/contents|chapter|lesson|unit/i.test(text) ? 5 : 0);
}

/**
 * Picks the front pages most likely to hold the contents (plus the page after
 * each, for TOCs that run over). Long forewords would otherwise push the
 * contents past the prompt limit, e.g. NCERT books list chapters on page ~19.
 */
function pickTocPages(pages: PageText[]): PageText[] {
  const scan = pages.slice(0, TOC_SCAN_PAGES);
  const scores = scan.map((p) => contentsScore(p.text));
  const best = Math.max(0, ...scores);
  if (best < 5) return scan.slice(0, 20);
  const keep = new Set<number>();
  scores.forEach((s, i) => {
    if (s >= best * 0.5) {
      keep.add(i);
      if (i + 1 < scan.length) keep.add(i + 1);
    }
  });
  return [...keep].sort((a, b) => a - b).map((i) => scan[i]);
}

export async function extractTocWithLlm(
  pages: PageText[],
  opts: { apiKey: string; model: string; bookLabel: string },
): Promise<TocChapter[]> {
  const front = pickTocPages(pages)
    .map((p) => `[[PDF page ${p.num}]]\n${p.text}`)
    .join('\n\n')
    .slice(0, TOC_CHAR_LIMIT);

  const openai = new OpenAI({ apiKey: opts.apiKey });
  const res = await openai.chat.completions.create({
    model: opts.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You read the front pages of a school textbook and return its table of contents as JSON. ' +
          'Return {"chapters":[{"number":1,"title":"...","startPage":7}]} where startPage is the PRINTED ' +
          'start page number shown in the contents (for a range like "07-24" use 7). Join titles that ' +
          'wrap onto two lines. Include only chapters/units/lessons, not prefaces, anthems or appendices. ' +
          'Use only titles that appear in the given text; never fill in chapters from memory. ' +
          'If there is no table of contents, return {"chapters":[]}.',
      },
      { role: 'user', content: `Book: ${opts.bookLabel}\n\n${front}` },
    ],
  });

  let parsed: { chapters?: unknown } = {};
  try {
    parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.chapters)) {
    return [];
  }
  return parsed.chapters
    .map((c: any, i: number) => ({
      number: Number.isFinite(Number(c?.number)) ? Number(c.number) : i + 1,
      title: String(c?.title ?? '').replace(/\s+/g, ' ').trim(),
      startPage: Number(c?.startPage),
    }))
    .filter((c) => c.title && Number.isInteger(c.startPage) && c.startPage > 0);
}

const titleWords = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 5);

function titleOnPage(text: string, title: string): boolean {
  const words = titleWords(title);
  if (!words.length) return false;
  return words.filter((w) => text.includes(w)).length / words.length >= 0.6;
}

function titleAppearsNear(
  pages: PageText[],
  title: string,
  pdfPage: number,
  ignore: Set<number>,
): boolean {
  const words = titleWords(title);
  if (!words.length) return false;
  for (const p of [pdfPage, pdfPage + 1]) {
    if (ignore.has(p)) continue;
    const text = pages[p - 1]?.text.toLowerCase();
    if (!text) continue;
    const hits = words.filter((w) => text.includes(w)).length;
    if (hits / words.length >= 0.6) return true;
  }
  return false;
}

/**
 * Converts printed TOC pages into PDF page ranges. Printed and PDF page numbers
 * usually match in these books, but a cover/insert can shift them, so the
 * offset that best matches chapter titles in the body wins. Returns null when
 * the TOC can't be trusted (caller falls back to one document per volume).
 */
export function resolveChapterRanges(pages: PageText[], toc: TocChapter[]): ChapterRange[] | null {
  const chapters = [...toc].sort((a, b) => a.startPage - b.startPage);
  if (chapters.length < 2) return null; // a one-entry TOC is a misread, not a chapter split

  // Contents pages list every title, so they would "confirm" any offset.
  // Only front matter counts: body pages of books with generic titles
  // ("... Music") can also mention several titles.
  const contentsPages = new Set(
    pages
      .filter((p) => {
        if (p.num > FRONT_MATTER_PAGES) return false;
        const text = p.text.toLowerCase();
        return chapters.filter((c) => titleOnPage(text, c.title)).length >= 3;
      })
      .map((p) => p.num),
  );

  // Try offsets nearest to 0 first so ties keep printed == PDF numbering.
  const offsets = Array.from({ length: 45 }, (_, i) => i - 4).sort((a, b) => Math.abs(a) - Math.abs(b));
  let best = { offset: 0, score: -1 };
  for (const offset of offsets) {
    const score = chapters.filter((c) =>
      titleAppearsNear(pages, c.title, c.startPage + offset, contentsPages),
    ).length;
    if (score > best.score) best = { offset, score };
  }
  if (best.score < Math.max(1, Math.ceil(chapters.length * 0.5))) {
    return null;
  }

  const ranges: ChapterRange[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const fromPage = chapters[i].startPage + best.offset;
    const toPage =
      i + 1 < chapters.length ? chapters[i + 1].startPage + best.offset - 1 : pages.length;
    if (fromPage < 1 || fromPage > pages.length || toPage < fromPage) {
      return null;
    }
    ranges.push({ number: chapters[i].number, title: chapters[i].title, fromPage, toPage });
  }
  // Mostly one-page "chapters" means the start pages were misread (e.g. the
  // contents page's own line positions). Short books can have a few.
  const onePage = ranges.slice(0, -1).filter((r) => r.toPage === r.fromPage).length;
  if (onePage > (ranges.length - 1) / 2) {
    return null;
  }
  return ranges;
}
