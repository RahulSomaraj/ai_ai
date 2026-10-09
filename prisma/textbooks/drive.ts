/**
 * Minimal Google Drive access for PUBLIC ("anyone with the link") folders.
 * No API key / OAuth: folder listings come from the `embeddedfolderview` page and
 * files from the `drive.usercontent.google.com` download endpoint.
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type DriveFile = {
  id: string;
  name: string;
  /** Folder names from the crawl root down to the file's parent. */
  path: string[];
};

const ENTRY_RE =
  /https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/([A-Za-z0-9_-]+)[\s\S]*?flip-entry-title">([^<]+)</g;

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function listFolderOnce(folderId: string) {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`);
  if (!res.ok) {
    throw new Error(`Drive folder ${folderId}: HTTP ${res.status} (is it shared publicly?)`);
  }
  const html = await res.text();
  const entries: { kind: 'file' | 'folder'; id: string; name: string }[] = [];
  for (const m of html.matchAll(ENTRY_RE)) {
    entries.push({
      kind: m[1] === 'file/d' ? 'file' : 'folder',
      id: m[2],
      name: decodeHtml(m[3]),
    });
  }
  return entries;
}

/** Recursively lists every file under a public Drive folder. */
export async function crawlDriveFolder(
  rootId: string,
  opts: { includeFolder?: (path: string[]) => boolean } = {},
): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  const walk = async (folderId: string, path: string[]) => {
    for (const entry of await listFolderOnce(folderId)) {
      if (entry.kind === 'folder') {
        const childPath = [...path, entry.name];
        if (!opts.includeFolder || opts.includeFolder(childPath)) {
          await walk(entry.id, childPath);
        }
      } else {
        out.push({ id: entry.id, name: entry.name, path });
      }
    }
  };
  await walk(rootId, []);
  return out;
}

/** Downloads a public Drive file to `dest` (skipped when already present). */
export async function downloadDriveFile(fileId: string, dest: string): Promise<void> {
  if (existsSync(dest) && statSync(dest).size > 0) {
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/html')) {
        throw new Error('Drive returned an HTML page instead of the file (quota or permissions)');
      }
      const tmp = `${dest}.part`;
      await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp));
      renameSync(tmp, dest);
      return;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error(`Download failed for Drive file ${fileId}: ${String(lastErr)}`);
}
