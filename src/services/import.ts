import type { Poem } from '../types/poem';
import { getDb } from '../db';
import { collectionForSource, importCollection, simplifiedTextKey } from './collectionImport';
import { domain, poemSource, tangSupplementUrls, formatter as defaultFormatter } from '../datas/poemSource';
import chineseS2T from 'chinese-s2t';

const { t2s } = chineseS2T;

/**
 * 将繁体字转换为简体中文
 */
export function convertToSimplified(text: string): string {
  if (!text) return text;
  return t2s(text);
}

/**
 * 转换诗词中的所有文本字段为简体中文
 */
export function convertPoemToSimplified(poem: Poem): Poem {
  const converted: Poem = { ...poem };

  // 转换字符串字段
  if (converted.title) converted.title = convertToSimplified(converted.title);
  if (converted.author) converted.author = convertToSimplified(converted.author);
  if (converted.rhythmic) converted.rhythmic = convertToSimplified(converted.rhythmic);
  if (converted.chapter) converted.chapter = convertToSimplified(converted.chapter);
  if (converted.content) converted.content = convertToSimplified(converted.content);
  if (converted.volume) converted.volume = convertToSimplified(converted.volume);
  if (converted.biography) converted.biography = convertToSimplified(converted.biography);
  if (converted.section) converted.section = convertToSimplified(converted.section);
  if (converted.prologue) converted.prologue = convertToSimplified(converted.prologue);
  if (converted.origin) converted.origin = convertToSimplified(converted.origin);
  if (converted.source) converted.source = convertToSimplified(converted.source);
  if (converted.cover) converted.cover = convertToSimplified(converted.cover);

  // 转换数组字段
  if (Array.isArray(converted.paragraphs)) {
    converted.paragraphs = converted.paragraphs.map(p => convertToSimplified(p));
  }
  if (Array.isArray(converted.tags)) {
    converted.tags = converted.tags.map(t => convertToSimplified(t));
  }
  if (Array.isArray(converted.groups)) {
    converted.groups = converted.groups.map(g => convertToSimplified(g));
  }
  if (Array.isArray(converted.notes)) {
    converted.notes = converted.notes.map(n => convertToSimplified(n));
  }
  if (Array.isArray(converted.comment)) {
    converted.comment = converted.comment.map(c => convertToSimplified(c));
  }

  return converted;
}

/**
 * 批量转换诗词为简体中文
 */
export function convertPoemsToSimplified(poems: Poem[]): Poem[] {
  return poems.map(poem => convertPoemToSimplified(poem));
}

export interface ImportResult {
  total: number;
  imported: number;
  failed: number;
  duplicate: number;
  skipped: number;
}

export interface SourceInfo {
  url: string;
  groups: string[];
  [key: string]: unknown;
}

export interface ImportProgress {
  current: number;
  total: number;
}

// 下载并解析JSON (带重试机制)
export async function downloadAndParseJson(
  url: string,
  maxRetries: number = 3
): Promise<Poem[]> {
  const fullUrl = `${domain}${url}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Downloading ${fullUrl} (attempt ${attempt}/${maxRetries})`);
      const response = await fetch(fullUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        if (typeof data === 'object') {
          return [data];
        }
        throw new Error('Invalid JSON format: expected an array');
      }

      return data;
    } catch (error) {
      lastError = error as Error;
      console.error(`Download attempt ${attempt} failed:`, error);

      // 如果不是最后一次尝试,等待后重试
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(`Failed to download after ${maxRetries} attempts: ${lastError?.message}`);
}

// 并发下载多个URL
export interface DownloadResult {
  url: string;
  poems: Poem[];
  success: boolean;
  error?: string;
}

export async function downloadMultipleUrls(
  urls: string[],
  maxRetries: number = 3
): Promise<DownloadResult[]> {
  console.log(`🔄 开始并发下载 ${urls.length} 个 URL:`, urls);

  const downloadPromises = urls.map(async (url, index): Promise<DownloadResult> => {
    const startTime = Date.now();
    console.log(`[${index + 1}/${urls.length}] 🚀 开始下载: ${url}`);

    try {
      const poems = await downloadAndParseJson(url, maxRetries);
      const duration = Date.now() - startTime;
      console.log(`[${index + 1}/${urls.length}] ✅ 下载完成: ${url} (${duration}ms, ${poems.length} 首诗词)`);
      return { url, poems, success: true };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${index + 1}/${urls.length}] ❌ 下载失败: ${url} (${duration}ms)`, error);
      return {
        url,
        poems: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  const results = await Promise.all(downloadPromises);
  console.log(`🎉 并发下载完成: ${urls.length} 个 URL`);
  return results;
}

// 格式化诗词数据
export function formatPoems(
  poems: Poem[],
  source: SourceInfo,
  customFormatter?: (data: Poem[], source: SourceInfo) => Poem[]
): Poem[] {
  const formatter = customFormatter || defaultFormatter;
  return formatter(poems, source);
}

/**
 * 批量检查已存在的ID
 */
async function batchCheckExisting(db: any, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) {
    return new Set();
  }

  const existingIds = new Set<number>();

  // SQLite 的 IN 语句有限制，分批查询（每批1000个）
  const QUERY_BATCH_SIZE = 1000;
  for (let i = 0; i < ids.length; i += QUERY_BATCH_SIZE) {
    const batch = ids.slice(i, i + QUERY_BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(',');

    try {
      const existing = await db.select(
        `SELECT id FROM poems WHERE id IN (${placeholders})`,
        batch
      ) as { id: number }[];
      existing.forEach((row: { id: number }) => existingIds.add(row.id));
    } catch (error) {
      console.error('Failed to check existing IDs:', error);
    }
  }

  return existingIds;
}

/**
 * 批量插入诗词
 */
async function batchInsertPoems(db: any, poems: Poem[]): Promise<{ success: number; failed: number }> {
  if (poems.length === 0) {
    return { success: 0, failed: 0 };
  }

  const BATCH_SIZE = 100; // 每批插入100条
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < poems.length; i += BATCH_SIZE) {
    const batch = poems.slice(i, i + BATCH_SIZE);

    try {
      // 区分有ID和无ID的诗词
      const poemsWithId = batch.filter(p => p.id);
      const poemsWithoutId = batch.filter(p => !p.id);

      // 批量插入有ID的诗词
      if (poemsWithId.length > 0) {
        const values = poemsWithId.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const params = poemsWithId.flatMap(poem => {
          const title = poem.rhythmic || poem.title;
          return [
            Number(poem.id), // 确保ID是数字类型
            title,
            poem.author,
            JSON.stringify(poem.paragraphs || []),
            JSON.stringify(poem.tags || []),
            JSON.stringify(poem.groups || []),
            poem.cover || null,
            JSON.stringify(poem.notes || []),
            poem.rhythmic || null,
            poem.chapter || null,
            poem.content || null,
            JSON.stringify(poem.comment || []),
            poem.volume || null,
            poem.biography || null,
            poem.section || null,
            poem.prologue || null,
            poem.origin || null,
            poem.source || null,
          ];
        });

        await db.execute(
          `INSERT INTO poems (
            id, title, author, paragraphs, tags, groups, cover,
            notes, rhythmic, chapter, content, comment,
            volume, biography, section, prologue, origin, source
          ) VALUES ${values}`,
          params
        );
        successCount += poemsWithId.length;
      }

      // 批量插入无ID的诗词（使用自增）
      if (poemsWithoutId.length > 0) {
        const values = poemsWithoutId.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const params = poemsWithoutId.flatMap(poem => {
          const title = poem.rhythmic || poem.title;
          return [
            title,
            poem.author,
            JSON.stringify(poem.paragraphs || []),
            JSON.stringify(poem.tags || []),
            JSON.stringify(poem.groups || []),
            poem.cover || null,
            JSON.stringify(poem.notes || []),
            poem.rhythmic || null,
            poem.chapter || null,
            poem.content || null,
            JSON.stringify(poem.comment || []),
            poem.volume || null,
            poem.biography || null,
            poem.section || null,
            poem.prologue || null,
            poem.origin || null,
            poem.source || null,
          ];
        });

        await db.execute(
          `INSERT INTO poems (
            title, author, paragraphs, tags, groups, cover,
            notes, rhythmic, chapter, content, comment,
            volume, biography, section, prologue, origin, source
          ) VALUES ${values}`,
          params
        );
        successCount += poemsWithoutId.length;
      }
    } catch (error) {
      console.error('Failed to batch insert poems:', error);
      failedCount += batch.length;
    }
  }

  return { success: successCount, failed: failedCount };
}

// 导入诗词到数据库（批量优化版）
export async function importPoemsToDb(
  poems: Poem[],
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    total: poems.length,
    imported: 0,
    failed: 0,
    duplicate: 0,
    skipped: 0,
  };

  const db = await getDb();

  console.log(`🚀 开始批量导入 ${poems.length} 首诗词...`);

  // 1. 数据预处理和验证
  const validPoems: Poem[] = [];
  const idsToCheck: number[] = [];

  for (const poem of poems) {
    const title = poem.rhythmic || poem.title;
    const author = poem.author;

    // 验证必要字段
    if (!title || !author) {
      result.skipped++;
      continue;
    }

    validPoems.push(poem);

    // 收集需要查重的ID
    if (poem.id) {
      idsToCheck.push(poem.id);
    }
  }

  console.log(`✅ 验证完成: ${validPoems.length} 首有效, ${result.skipped} 首跳过`);

  // 2. 批量查重
  const existingIds = await batchCheckExisting(db, idsToCheck);
  result.duplicate = existingIds.size;
  console.log(`✅ 查重完成: 发现 ${existingIds.size} 首重复`);

  // 3. 过滤掉重复的诗词
  const poemsToInsert = validPoems.filter(poem => {
    if (poem.id && existingIds.has(poem.id)) {
      return false;
    }
    return true;
  });

  console.log(`💾 准备插入 ${poemsToInsert.length} 首诗词...`);

  // 4. 批量插入
  const PROGRESS_BATCH_SIZE = 100;
  for (let i = 0; i < poemsToInsert.length; i += PROGRESS_BATCH_SIZE) {
    const batch = poemsToInsert.slice(i, i + PROGRESS_BATCH_SIZE);

    const { success, failed } = await batchInsertPoems(db, batch);
    result.imported += success;
    result.failed += failed;

    // 更新进度
    if (onProgress) {
      const currentProgress = Math.min(i + batch.length, poemsToInsert.length);
      onProgress({ current: currentProgress, total: poemsToInsert.length });
    }
  }

  console.log(`✅ 导入完成: 成功 ${result.imported} 首, 失败 ${result.failed} 首`);

  return result;
}

// 同卷重新导入时，保护两份 v0.1.2 中本来就属于全唐诗的补充来源。
let protectedTang: Promise<Set<string>> | undefined;
function loadProtectedTang() {
  if (!protectedTang) {
    protectedTang = Promise.all(tangSupplementUrls.map(url => downloadAndParseJson(url)))
      .then(files => {
        if (files.some(file => !file.length || file.some(poem => !poem?.author || !Array.isArray(poem.paragraphs) || !poem.paragraphs.length || poem.paragraphs.some(line => typeof line !== 'string')))) {
          throw new Error('无法校验唐诗补充来源，暂不修改旧标签');
        }
        return new Set(files.flatMap(file => file.flatMap(poem => [
          simplifiedTextKey(poem),
          ...(!poem.title ? [simplifiedTextKey({ ...poem, title: '无题' })] : []),
        ])));
      })
      .catch(error => {
        protectedTang = undefined;
        throw error;
      });
  }
  return protectedTang;
}

async function importDownloadedPoems(
  raw: Poem[],
  source: SourceInfo,
  customFormatter?: (data: Poem[], source: SourceInfo) => Poem[],
  onProgress?: (progress: ImportProgress) => void,
  simplify = false,
) {
  const collection = collectionForSource(source.url);
  if (collection) {
    // 保留原始上游 ID，尤其不要把旧格式化器的数字回退哈希当成 UUID。
    const poems = source.url === tangSupplementUrls[0]
      ? raw.map(poem => ({ ...poem, title: poem.title || '无题' }))
      : raw;
    return importCollection(await getDb(), collection, poems, loadProtectedTang, onProgress);
  }
  return importPoemsToDb(formatPoems(simplify ? convertPoemsToSimplified(raw) : raw, source, customFormatter), onProgress);
}

// 完整的导入流程
export async function importFromSource(
  source: SourceInfo,
  customFormatter?: (data: Poem[], source: SourceInfo) => Poem[],
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  try {
    const rawPoems = await downloadAndParseJson(source.url);
    return await importDownloadedPoems(rawPoems, source, customFormatter, onProgress);
  } catch (error) {
    console.error('Import from source failed:', error);
    throw error;
  }
}

// 批量导入多个源（并发下载 + 批量插入）
export interface BatchImportSource extends SourceInfo {
  sourceKey: string;
  sourceName: string;
}

export interface BatchImportProgress {
  currentBatch: number;
  totalBatches: number;
  currentDownload: number;
  totalDownload: number;
  downloadedPoems: number;
  importedPoems: number;
  currentSourceName: string;
}

export interface SourceImportResult {
  sourceKey: string;
  sourceName: string;
  url: string;
  poemCount: number;
  success: boolean;
  error?: string;
}

export async function importFromSourcesBatch(
  sources: BatchImportSource[],
  options: {
    concurrentDownloads?: number;
    customFormatter?: (data: Poem[], source: SourceInfo) => Poem[];
    onProgress?: (progress: BatchImportProgress) => void;
    onBatchComplete?: (batchIndex: number, results: ImportResult[], sourceResults: SourceImportResult[]) => void | Promise<void>;
  } = {}
): Promise<ImportResult> {
  const {
    concurrentDownloads = 3,
    customFormatter,
    onProgress,
    onBatchComplete
  } = options;

  const totalResult: ImportResult = {
    total: 0,
    imported: 0,
    failed: 0,
    duplicate: 0,
    skipped: 0,
  };

  // 计算总诗词数（估算）
  const totalBatches = Math.ceil(sources.length / concurrentDownloads);
  const sourceName = sources[0]?.sourceName || 'Unknown';

  console.log(`🚀 开始批量导入 ${sources.length} 个文件，每批 ${concurrentDownloads} 个并发下载...`);

  // 按批次处理
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * concurrentDownloads;
    const batchSources = sources.slice(batchStart, batchStart + concurrentDownloads);

    console.log(`📥 批次 ${batchIndex + 1}/${totalBatches}: 下载 ${batchSources.length} 个文件...`);

    // 1. 并发下载当前批次的所有URL
    const urls = batchSources.map(s => s.url);
    const downloadResults = await downloadMultipleUrls(urls);

    // 逐卷记录实际写入结果；下载成功不代表 SQLite 写入成功。
    const results: ImportResult[] = [];
    const sourceResults: SourceImportResult[] = [];
    for (let i = 0; i < downloadResults.length; i++) {
      const download = downloadResults[i];
      const source = batchSources[i];
      const { sourceKey, sourceName, url } = source;
      try {
        if (!download.success) throw new Error(download.error || '下载失败');
        const sourceFormatter = poemSource.find(config => config.name === sourceName)?.formatter as
          ((data: Poem[], source: SourceInfo) => Poem[]) | undefined;
        const formatter = customFormatter ?? sourceFormatter;
        const result = await importDownloadedPoems(download.poems, source, formatter, undefined, true);
        results.push(result);
        totalResult.total += result.total;
        totalResult.imported += result.imported;
        totalResult.duplicate += result.duplicate;
        totalResult.skipped += result.skipped;
        totalResult.failed += result.failed;
        sourceResults.push({
          sourceKey, sourceName, url,
          poemCount: result.imported + result.duplicate,
          success: result.failed === 0,
          error: result.failed ? `${result.failed} 首诗词写入失败，可重试` : undefined,
        });
      } catch (error) {
        totalResult.failed += download.poems.length || 1;
        sourceResults.push({
          sourceKey, sourceName, url, poemCount: 0, success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 4. 更新进度
    if (onProgress) {
      onProgress({
        currentBatch: batchIndex + 1,
        totalBatches,
        currentDownload: Math.min((batchIndex + 1) * concurrentDownloads, sources.length),
        totalDownload: sources.length,
        downloadedPoems: totalResult.total,
        importedPoems: totalResult.imported,
        currentSourceName: sourceName,
      });
    }

    // 5. 批次完成回调
    if (onBatchComplete) {
      await onBatchComplete(batchIndex, results, sourceResults);
    }
  }

  console.log(`✅ 批量导入完成: 共 ${totalResult.total} 首, 成功 ${totalResult.imported} 首`);

  return totalResult;
}
