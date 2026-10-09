/**
 * Turns textbook files into structured catalog entries.
 *
 * SCERT Kerala (board "scert") encodes everything in the file name:
 *   STD_09_Physics_English_Medium_Vol1.pdf
 *   → { classLevel: 9, subject: 'Physics', medium: 'English', volume: 1 }
 *
 * NCERT (board "ncert") uses folders + book names:
 *   Class_11/Physics/Physics_Part-I.pdf
 *   → { classLevel: 11, subject: 'Physics', bookTitle: 'Physics Part-I', volume: 1 }
 */
import type { DriveFile } from './drive';

export type CatalogBook = {
  driveId: string;
  fileName: string;
  classLevel: number;
  /** Display subject name stored on Subject/RagDocument, e.g. "Basic Science". */
  subject: string;
  /** Teaching medium, e.g. "English", "Malayalam". */
  medium: string;
  volume: number;
  /** Absent in manifests cached before NCERT support; treat as "scert". */
  board?: 'scert' | 'ncert';
  /** NCERT book name, e.g. "Ganita Prakash Part-I". */
  bookTitle?: string;
};

const FILE_RE = /^STD_(\d{1,2})_(.+?)_([A-Za-z]+)_Medium(?:_Vol(\d+))?\.pdf$/i;

// File-name tokens that read better expanded.
// Kerala HSE ships the same NCERT Biology PDF as both "Botany" and "Zoology".
const SUBJECT_ALIASES: Record<string, string> = {
  Maths: 'Mathematics',
  Botany: 'Biology',
  Zoology: 'Biology',
};

export function normalizeSubject(subject: string): string {
  return SUBJECT_ALIASES[subject] ?? subject;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseBookFileName(file: DriveFile): CatalogBook | null {
  const m = FILE_RE.exec(file.name.trim());
  if (!m) {
    return null;
  }
  const rawSubject = m[2].replace(/_/g, ' ').trim();
  return {
    driveId: file.id,
    fileName: file.name.trim(),
    classLevel: Number(m[1]),
    subject: normalizeSubject(rawSubject),
    medium: m[3][0].toUpperCase() + m[3].slice(1).toLowerCase(),
    volume: m[4] ? Number(m[4]) : 1,
  };
}

// Regional-language NCERT translations are tagged in the file name, e.g.
// "Joyful-Mathematics_(Tamil).pdf", "Khel_Yoga(Bodo)_ebdky1.pdf".
const NCERT_TRANSLATION_RE =
  /\(\s*_?\s*(Assamese|Bengali|Bodo|Dogri|Gujarati|Gujrati|Hindi|Kannada|Kashmiri|Konkani|Maithili|Maithli|Maithali|Malayalam|Manipuri|Marathi|Nepali|Oriya|Odia|Punjabi|Sanskrit|Santhali|Sindhi|Tamil|Telugu|Urdu)\s*\)|[-_]Urdu\b/i;

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3 };

export function parseNcertFile(file: DriveFile): CatalogBook | null {
  const classMatch = /^Class_(\d{1,2})$/i.exec(file.path[0] ?? '');
  const name = file.name.trim();
  if (!classMatch || !file.path[1] || !/\.pdf$/i.test(name) || NCERT_TRANSLATION_RE.test(name)) {
    return null;
  }
  const bookTitle = name
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // "Physics Part-I", "Chemistry-II", "Ganit-I", "Antral Bhag 2"
  const vol = /(?:^|[\s-])(I{1,3}|[123])$/i.exec(bookTitle);
  return {
    driveId: file.id,
    fileName: name,
    classLevel: Number(classMatch[1]),
    subject: normalizeSubject(file.path[1].replace(/_/g, ' ').replace(/\s+/g, ' ').trim()),
    medium: 'English',
    volume: vol ? ROMAN[vol[1].toUpperCase()] ?? Number(vol[1]) : 1,
    board: 'ncert',
    bookTitle,
  };
}

/** Stable key for one book volume; used for ids and cache file names. */
export function bookKey(b: CatalogBook): string {
  if (b.board === 'ncert') {
    return `std${String(b.classLevel).padStart(2, '0')}-${slugify(b.subject)}-${slugify(b.bookTitle ?? '')}`;
  }
  return `std${String(b.classLevel).padStart(2, '0')}-${slugify(b.subject)}-${slugify(
    b.medium,
  )}-v${b.volume}`;
}
