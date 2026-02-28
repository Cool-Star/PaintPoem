import Database from '@tauri-apps/plugin-sql';
import { appDataDir, join } from '@tauri-apps/api/path';
import { writeFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { FontData } from '../types/font';
import type { PoemData } from '../types/poem';

let db: Database | null = null;

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:poe-mart.db');
  }
  return db;
}

export async function initDb() {
  const database = await getDb();

  // 创建诗词表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS poems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      author TEXT,
      paragraphs TEXT,
      tags TEXT,
      groups TEXT,
      cover TEXT,
      notes TEXT,
      rhythmic TEXT,
      chapter TEXT,
      content TEXT,
      comment TEXT,
      volume TEXT,
      biography TEXT,
      section TEXT,
      prologue TEXT,
      origin TEXT,
      source TEXT
    );
  `);

  // 迁移逻辑：为现有表添加新字段
  console.log('开始数据库迁移，检查并添加缺失字段...');
  try {
    // 检查并添加缺失的列
    const columnsToAdd = [
      { name: 'notes', type: 'TEXT' },
      { name: 'rhythmic', type: 'TEXT' },
      { name: 'chapter', type: 'TEXT' },
      { name: 'content', type: 'TEXT' },
      { name: 'comment', type: 'TEXT' },
      { name: 'volume', type: 'TEXT' },
      { name: 'biography', type: 'TEXT' },
      { name: 'section', type: 'TEXT' },
      { name: 'prologue', type: 'TEXT' },
      { name: 'origin', type: 'TEXT' },
      { name: 'source', type: 'TEXT' },
      { name: 'translation', type: 'TEXT' },
      { name: 'ai_optimized', type: 'INTEGER DEFAULT 0' },
      { name: 'original_paragraphs', type: 'TEXT' },
      { name: 'pinyin', type: 'TEXT' },
    ];

    for (const column of columnsToAdd) {
      try {
        await database.execute(
          `ALTER TABLE poems ADD COLUMN ${column.name} ${column.type}`
        );
        console.log(`✅ Added column: ${column.name}`);
      } catch (error: any) {
        // 如果列已存在，会报错，忽略即可
        if (!error.message?.includes('duplicate column name')) {
          console.warn(`⚠️ Warning adding column ${column.name}:`, error.message);
        }
      }
    }
    console.log('✅ 数据库迁移完成');
  } catch (error) {
    console.error('❌ Migration error:', error);
  }

  // 创建导入记录表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS imported_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT UNIQUE NOT NULL,
      source_name TEXT,
      url TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      poem_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed'
    );
  `);

  // 创建字体表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS fonts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      format TEXT NOT NULL,
      family TEXT,
      is_builtin INTEGER DEFAULT 0,
      is_global_default INTEGER DEFAULT 0,
      is_print_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 初始化内置字体（思源宋体）
  await initBuiltinFont(database);

  // 创建设置表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  console.log('Database initialized');

  // 初始化配图表、收藏表和全局背景图表
  await initPoemCoversTable(database);
  await initFavoritesTable(database);
  await initGlobalBackgroundTable(database);
}

// 设置相关操作
export interface Settings {
  llmUrl?: string;
  llmKey?: string;
  llmModel?: string;
  imageModel?: string;
  imageApiKey?: string;
  imageBaseURL?: string;
}

export async function getSettings(): Promise<Settings> {
  const database = await getDb();
  const results = await database.select<{ key: string; value: string }[]>(
    'SELECT key, value FROM settings'
  );

  const settings: Settings = {};
  results.forEach(row => {
    settings[row.key as keyof Settings] = row.value as any;
  });

  return settings;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.execute(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}

export async function saveSettings(settings: Settings): Promise<void> {
  const database = await getDb();

  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) {
      await database.execute(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    }
  }
}

export async function deleteAllPoems(): Promise<void> {
  const database = await getDb();
  // 删除所有诗词数据
  await database.execute('DELETE FROM poems');
  // 同时清空导入记录，允许重新导入
  await database.execute('DELETE FROM imported_sources');
  console.log('✅ 已删除所有诗词数据和导入记录');
}

// 导入记录相关操作
export interface ImportedSource {
  id?: number;
  source_key: string;
  source_name: string;
  url: string;
  imported_at: string;
  poem_count: number;
  status: 'completed' | 'failed';
}

export async function getImportedSources(): Promise<ImportedSource[]> {
  const database = await getDb();
  return await database.select<ImportedSource[]>(
    'SELECT * FROM imported_sources'
  );
}

export async function checkSourceImported(sourceKey: string): Promise<boolean> {
  const database = await getDb();
  const result = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM imported_sources WHERE source_key = ?',
    [sourceKey]
  );
  return result[0].count > 0;
}

export async function markSourceAsImported(
  sourceKey: string,
  sourceName: string,
  url: string,
  poemCount: number,
  status: 'completed' | 'failed' = 'completed'
): Promise<void> {
  const database = await getDb();
  await database.execute(
    'INSERT OR REPLACE INTO imported_sources (source_key, source_name, url, imported_at, poem_count, status) VALUES (?, ?, ?, ?, ?, ?)',
    [sourceKey, sourceName, url, new Date().toISOString(), poemCount, status]
  );
}

export async function deleteImportedSource(sourceKey: string): Promise<void> {
  const database = await getDb();
  await database.execute(
    'DELETE FROM imported_sources WHERE source_key = ?',
    [sourceKey]
  );
}

// 字体相关操作
async function initBuiltinFont(database: Database): Promise<void> {
  // 检查是否已存在内置字体
  const existing = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM fonts WHERE is_builtin = 1'
  );

  if (existing[0].count === 0) {
    try {
      // 将内置字体文件复制到 appData/fonts 目录
      const appData = await appDataDir();
      const fontsDir = await join(appData, 'fonts');
      const fontPath = await join(fontsDir, 'SourceHanSerifCN-Regular.otf');

      // 确保 fonts 目录存在
      await mkdir('fonts', { baseDir: BaseDirectory.AppData, recursive: true });

      // 使用 fetch 获取字体文件（通过相对路径）
      const response = await fetch('/src/assets/SourceHanSerifCN-Regular-1.otf');
      if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.status}`);
      }
      const fontData = new Uint8Array(await response.arrayBuffer());

      // 写入到 appData/fonts
      await writeFile(fontPath, fontData);
      console.log('✅ 内置字体文件已复制到:', fontPath);

      // 添加内置字体记录（使用绝对路径）
      await database.execute(
        `INSERT INTO fonts (name, path, format, family, is_builtin, is_global_default, is_print_default) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['思源宋体', fontPath, 'otf', 'SourceHanSerifCN', 1, 1, 1]
      );
      console.log('✅ 内置字体初始化完成');
    } catch (error) {
      console.error('❌ 内置字体初始化失败:', error);
      // 如果复制失败，使用特殊标记，让 PDF 生成时使用 fetch 直接加载
      await database.execute(
        `INSERT INTO fonts (name, path, format, family, is_builtin, is_global_default, is_print_default) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['思源宋体', 'builtin://SourceHanSerifCN-Regular-1.otf', 'otf', 'SourceHanSerifCN', 1, 1, 1]
      );
    }
  }
}

export async function getFonts(): Promise<FontData[]> {
  const database = await getDb();
  return await database.select<FontData[]>('SELECT * FROM fonts ORDER BY is_builtin DESC, created_at DESC');
}

export async function getFontById(id: number): Promise<FontData | null> {
  const database = await getDb();
  const results = await database.select<FontData[]>('SELECT * FROM fonts WHERE id = ?', [id]);
  return results[0] || null;
}

export async function addFont(font: Omit<FontData, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const database = await getDb();
  const result = await database.execute(
    `INSERT INTO fonts (name, path, format, family, is_builtin, is_global_default, is_print_default) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [font.name, font.path, font.format, font.family || null, font.isBuiltin, font.isGlobalDefault, font.isPrintDefault]
  );
  return result.lastInsertId as number;
}

export async function updateFont(id: number, updates: Partial<FontData>): Promise<void> {
  const database = await getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.path !== undefined) { fields.push('path = ?'); values.push(updates.path); }
  if (updates.format !== undefined) { fields.push('format = ?'); values.push(updates.format); }
  if (updates.family !== undefined) { fields.push('family = ?'); values.push(updates.family); }
  if (updates.isGlobalDefault !== undefined) { fields.push('is_global_default = ?'); values.push(updates.isGlobalDefault); }
  if (updates.isPrintDefault !== undefined) { fields.push('is_print_default = ?'); values.push(updates.isPrintDefault); }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  await database.execute(
    `UPDATE fonts SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteFont(id: number): Promise<void> {
  const database = await getDb();
  await database.execute('DELETE FROM fonts WHERE id = ? AND is_builtin = 0', [id]);
}

export async function setGlobalDefaultFont(id: number | null): Promise<void> {
  const database = await getDb();
  // 先清除所有全局默认
  await database.execute('UPDATE fonts SET is_global_default = 0');
  // 设置新的全局默认
  if (id !== null) {
    await database.execute('UPDATE fonts SET is_global_default = 1 WHERE id = ?', [id]);
  }
}

export async function setPrintDefaultFont(id: number | null): Promise<void> {
  const database = await getDb();
  // 先清除所有打印默认
  await database.execute('UPDATE fonts SET is_print_default = 0');
  // 设置新的打印默认
  if (id !== null) {
    await database.execute('UPDATE fonts SET is_print_default = 1 WHERE id = ?', [id]);
  }
}

export async function getGlobalDefaultFont(): Promise<FontData | null> {
  const database = await getDb();
  const results = await database.select<FontData[]>('SELECT * FROM fonts WHERE is_global_default = 1 LIMIT 1');
  return results[0] || null;
}

export async function getPrintDefaultFont(): Promise<FontData | null> {
  const database = await getDb();
  const results = await database.select<FontData[]>('SELECT * FROM fonts WHERE is_print_default = 1 LIMIT 1');
  return results[0] || null;
}

// ==================== 诗词配图相关 ====================

export interface PoemCover {
  id: number;
  poem_id: number;
  cover_path: string;
  is_active: number;
  created_at: string;
}

async function initPoemCoversTable(database: Database): Promise<void> {
  // 创建配图表
  await database.execute(`
    CREATE TABLE IF NOT EXISTS poem_covers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poem_id INTEGER NOT NULL,
      cover_path TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (poem_id) REFERENCES poems(id) ON DELETE CASCADE
    );
  `);

  // 创建索引
  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_poem_covers_poem_id ON poem_covers(poem_id);
  `);

  // 迁移现有数据：将 poems.cover 迁移到 poem_covers 表
  try {
    const poemsWithCover = await database.select<{ id: number; cover: string }[]>(
      'SELECT id, cover FROM poems WHERE cover IS NOT NULL AND cover != ""'
    );

    for (const poem of poemsWithCover) {
      // 检查是否已迁移
      const existing = await database.select<{ count: number }[]>(
        'SELECT COUNT(*) as count FROM poem_covers WHERE poem_id = ? AND cover_path = ?',
        [poem.id, poem.cover]
      );

      if (existing[0].count === 0) {
        await database.execute(
          'INSERT INTO poem_covers (poem_id, cover_path, is_active) VALUES (?, ?, 1)',
          [poem.id, poem.cover]
        );
      }
    }
    console.log('✅ 配图数据迁移完成');
  } catch (error) {
    console.error('配图数据迁移失败:', error);
  }
}

export async function getPoemCovers(poemId: number): Promise<PoemCover[]> {
  const database = await getDb();
  return await database.select<PoemCover[]>(
    'SELECT * FROM poem_covers WHERE poem_id = ? ORDER BY is_active DESC, created_at DESC',
    [poemId]
  );
}

export async function addPoemCover(poemId: number, coverPath: string): Promise<number> {
  const database = await getDb();

  // 如果是第一张配图，自动设为生效
  const existingCovers = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM poem_covers WHERE poem_id = ?',
    [poemId]
  );
  const isFirstCover = existingCovers[0].count === 0;

  const result = await database.execute(
    'INSERT INTO poem_covers (poem_id, cover_path, is_active) VALUES (?, ?, ?)',
    [poemId, coverPath, isFirstCover ? 1 : 0]
  );

  return result.lastInsertId as number;
}

export async function deletePoemCover(coverId: number): Promise<void> {
  const database = await getDb();

  // 获取被删除的配图信息
  const cover = await database.select<PoemCover[]>(
    'SELECT * FROM poem_covers WHERE id = ?',
    [coverId]
  );

  if (cover.length === 0) return;

  const poemId = cover[0].poem_id;
  const wasActive = cover[0].is_active === 1;

  // 删除配图
  await database.execute('DELETE FROM poem_covers WHERE id = ?', [coverId]);

  // 如果删除的是生效配图，自动将最新的配图设为生效
  if (wasActive) {
    const remainingCovers = await database.select<PoemCover[]>(
      'SELECT * FROM poem_covers WHERE poem_id = ? ORDER BY created_at DESC LIMIT 1',
      [poemId]
    );

    if (remainingCovers.length > 0) {
      await database.execute(
        'UPDATE poem_covers SET is_active = 1 WHERE id = ?',
        [remainingCovers[0].id]
      );
    }
  }
}

export async function setActiveCover(poemId: number, coverId: number): Promise<void> {
  const database = await getDb();

  // 先将该诗词的所有配图设为非生效
  await database.execute(
    'UPDATE poem_covers SET is_active = 0 WHERE poem_id = ?',
    [poemId]
  );

  // 再将指定配图设为生效
  await database.execute(
    'UPDATE poem_covers SET is_active = 1 WHERE id = ? AND poem_id = ?',
    [coverId, poemId]
  );
}

export async function getActiveCover(poemId: number): Promise<PoemCover | null> {
  const database = await getDb();
  const results = await database.select<PoemCover[]>(
    'SELECT * FROM poem_covers WHERE poem_id = ? AND is_active = 1 LIMIT 1',
    [poemId]
  );
  return results[0] || null;
}

// ==================== 收藏功能相关 ====================

export interface Favorite {
  id: number;
  poem_id: number;
  created_at: string;
}

async function initFavoritesTable(database: Database): Promise<void> {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poem_id INTEGER NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (poem_id) REFERENCES poems(id) ON DELETE CASCADE
    );
  `);

  // 创建索引
  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_favorites_poem_id ON favorites(poem_id);
  `);
}

export async function addFavorite(poemId: number): Promise<void> {
  const database = await getDb();
  try {
    await database.execute(
      'INSERT INTO favorites (poem_id) VALUES (?)',
      [poemId]
    );
  } catch (error: any) {
    // 如果已存在，忽略错误
    if (!error.message?.includes('UNIQUE constraint failed')) {
      throw error;
    }
  }
}

export async function removeFavorite(poemId: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    'DELETE FROM favorites WHERE poem_id = ?',
    [poemId]
  );
}

export async function getFavorites(): Promise<Favorite[]> {
  const database = await getDb();
  return await database.select<Favorite[]>(
    'SELECT * FROM favorites ORDER BY created_at DESC'
  );
}

export async function isFavorite(poemId: number): Promise<boolean> {
  const database = await getDb();
  const results = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM favorites WHERE poem_id = ?',
    [poemId]
  );
  return results[0].count > 0;
}

export async function getFavoritePoems(): Promise<PoemData[]> {
  const database = await getDb();
  return await database.select<PoemData[]>(`
    SELECT p.* FROM poems p
    INNER JOIN favorites f ON p.id = f.poem_id
    ORDER BY f.created_at DESC
  `);
}

// ==================== 全局背景图持久化 ====================

export interface GlobalBackground {
  id: number;
  poem_id: number | null;
  cover_id: number | null;
  cover_path: string | null;
  updated_at: string;
}

export async function initGlobalBackgroundTable(database: Database): Promise<void> {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS global_background (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      poem_id INTEGER,
      cover_id INTEGER,
      cover_path TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 初始化默认记录
  const existing = await database.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM global_background WHERE id = 1'
  );
  if (existing[0].count === 0) {
    await database.execute(
      'INSERT INTO global_background (id, poem_id, cover_id, cover_path) VALUES (1, NULL, NULL, NULL)'
    );
  }
}

export async function saveGlobalBackground(
  poemId: number | null,
  coverId: number | null,
  coverPath: string | null
): Promise<void> {
  const database = await getDb();
  await database.execute(
    'INSERT OR REPLACE INTO global_background (id, poem_id, cover_id, cover_path, updated_at) VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)',
    [poemId, coverId, coverPath]
  );
}

export async function getGlobalBackground(): Promise<GlobalBackground | null> {
  const database = await getDb();
  const results = await database.select<GlobalBackground[]>(
    'SELECT * FROM global_background WHERE id = 1'
  );
  return results[0] || null;
}
