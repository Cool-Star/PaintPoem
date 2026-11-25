import type Database from '@tauri-apps/plugin-sql';
import { tangSupplementUrls } from '../datas/poemSource';
import type { Poem } from '../types/poem';
import type { ImportProgress, ImportResult } from './import';
import chineseS2T from 'chinese-s2t';

const { t2s } = chineseS2T;

const TANG = '全唐诗';
const SONG = '全宋诗';
const TANG_GROUP = JSON.stringify([TANG]);
const SONG_GROUP = JSON.stringify([SONG]);

export function collectionForSource(url: string): typeof TANG | typeof SONG | null {
  if (/^\/全唐诗\/poet\.song\.\d+\.json$/.test(url)) return SONG;
  if (/^\/全唐诗\/poet\.tang\.\d+\.json$/.test(url) || tangSupplementUrls.includes(url)) return TANG;
  return null;
}

type TextKey = [string, string, string[]];

function textKey(poem: Poem, simplify = false): TextKey {
  const normalize = simplify ? t2s : (s: string) => s;
  return [
    normalize(poem.rhythmic || poem.title || ''),
    normalize(poem.author || ''),
    (poem.paragraphs || []).map(normalize),
  ];
}

export function simplifiedTextKey(poem: Poem): string {
  return JSON.stringify(textKey(poem, true));
}

type LegacyRow = {
  id: number;
  title: string;
  author: string;
  groups: string;
  paragraphs: string | null;
  original_paragraphs: string | null;
};

function rowTextKey(row: LegacyRow): string | null {
  try {
    const paragraphs = JSON.parse(row.original_paragraphs || row.paragraphs || 'null');
    if (!Array.isArray(paragraphs) || !paragraphs.every(p => typeof p === 'string')) return null;
    return simplifiedTextKey({ id: row.id, title: row.title, author: row.author, paragraphs });
  } catch {
    return null;
  }
}

export async function importCollection(
  db: Database,
  collection: typeof TANG | typeof SONG,
  poems: Poem[],
  loadProtectedTang: () => Promise<Set<string>>,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const result: ImportResult = { total: poems.length, imported: 0, duplicate: 0, skipped: 0, failed: 0 };
  const seen = new Set<string>();
  const group = collection === TANG ? TANG_GROUP : SONG_GROUP;
  for (let offset = 0; offset < poems.length; offset += 40) {
    const incoming = poems.slice(offset, offset + 40).flatMap(poem => {
      const raw = textKey(poem);
      const simplified = textKey(poem, true);
      if (!raw[0] || !raw[1] || !raw[2].length) {
        result.skipped++;
        return [];
      }
      const match = JSON.stringify(simplified);
      // 上游 UUID 是文本，不是 SQLite 自增主键。无 UUID 时以完整正文为依据。
      const identity = JSON.stringify([collection, poem.id ? ['id', String(poem.id)] : ['text', match]]);
      if (seen.has(identity)) {
        result.duplicate++;
        return [];
      }
      seen.add(identity);
      return [{ poem, raw, simplified, match, identity }];
    });

    if (incoming.length) {
      try {
        // 旧版批量导入用了简体，单文件导入则保留原文；两种都要能找到。
        const names = incoming.flatMap(({ raw, simplified }) => [raw.slice(0, 2), simplified.slice(0, 2)]);
        const old = await db.select<LegacyRow[]>(`
          WITH names AS (
            SELECT DISTINCT json_extract(value, '$[0]') title, json_extract(value, '$[1]') author
            FROM json_each(?)
          )
          SELECT p.id, p.title, p.author, p.groups, p.paragraphs, p.original_paragraphs
          FROM names JOIN poems p ON p.title = names.title AND p.author = names.author
          WHERE p.import_identity IS NULL AND p.groups IN (?, ?)
          ORDER BY p.id
        `, [JSON.stringify(names), group, TANG_GROUP]);
        const matches = new Map<string, LegacyRow[]>();
        for (const row of old) {
          const key = rowTextKey(row);
          if (!key) continue;
          const rows = matches.get(key) || [];
          rows.push(row);
          matches.set(key, rows);
        }
        const hasOldTangRows = collection === SONG && incoming.some(({ match }) =>
          matches.get(match)?.some(row => row.groups === TANG_GROUP)
        );
        const protectedTang = hasOldTangRows ? await loadProtectedTang() : null;
        const assignments: [number, string | null][] = [];
        const assignedRows = new Set<number>();

        for (const { identity, match } of incoming) {
          const rows = (matches.get(match) || [])
            .filter(row => !assignedRows.has(row.id) &&
              (row.groups === group || (collection === SONG && !protectedTang?.has(match))))
            .sort((a, b) => Number(b.groups === group) - Number(a.groups === group) || a.id - b.id);
          // 不删旧版重复行，收藏或封面可能引用其中任意一行。只给一行绑定导入键。
          for (const [index, row] of rows.entries()) {
            if (index > 0 && row.groups === group) continue;
            assignments.push([row.id, index === 0 ? identity : null]);
            assignedRows.add(row.id);
          }
        }

        if (assignments.length) {
          await db.execute(`
            WITH changes AS (
              SELECT json_extract(value, '$[0]') id, json_extract(value, '$[1]') identity FROM json_each(?)
            )
            UPDATE poems
            SET groups = ?, import_identity = (
              SELECT identity FROM changes c WHERE c.id = poems.id
                AND NOT EXISTS (SELECT 1 FROM poems existing WHERE existing.import_identity = c.identity)
            )
            WHERE id IN (SELECT id FROM changes) AND import_identity IS NULL
          `, [JSON.stringify(assignments), group]);
        }

        const values = incoming.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const params = incoming.flatMap(({ poem, simplified, identity }) => [
          identity, simplified[0], simplified[1], JSON.stringify(simplified[2]),
          JSON.stringify(poem.tags || []), group, poem.cover || null, JSON.stringify(Array.isArray(poem.notes) ? poem.notes : poem.notes ? [poem.notes] : []),
          poem.rhythmic || null, poem.chapter || null, poem.content || null, JSON.stringify(poem.comment || []),
          poem.volume || null, poem.biography || null, poem.section || null, poem.prologue || null,
          poem.origin || null, poem.source || null,
        ]);
        const { rowsAffected } = await db.execute(`
          INSERT INTO poems (import_identity, title, author, paragraphs, tags, groups, cover, notes,
            rhythmic, chapter, content, comment, volume, biography, section, prologue, origin, source)
          VALUES ${values} ON CONFLICT(import_identity) DO NOTHING
        `, params);
        result.imported += rowsAffected;
        result.duplicate += incoming.length - rowsAffected;
      } catch (error) {
        console.error('Failed to import poetry collection:', error);
        result.failed += incoming.length;
      }
    }
    onProgress?.({ current: Math.min(offset + 40, poems.length), total: poems.length });
  }
  return result;
}
