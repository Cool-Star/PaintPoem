import type Database from '@tauri-apps/plugin-sql';
import type { PoemData } from '../types/poem';
import { requestTextCompletion, type LLMSettings } from './textModel';
import { translationStyles, type TranslationStyle } from './translationStyles';

interface AIOptimizeResult {
  source: string;
  optimizedParagraphs: string[];
  translation: string;
  pinyin: string[];
}

function readParagraphs(value?: string): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((paragraph): paragraph is string =>
        typeof paragraph === 'string' && paragraph.trim().length > 0
      );
    }
    return typeof parsed === 'string' && parsed.trim() ? [parsed] : [];
  } catch {
    // 兼容以纯文本保存段落的旧记录。
    return [value];
  }
}

function describePoem(poem: PoemData, paragraphs: string[]): string {
  if (paragraphs.length === 0) throw new Error('这首诗暂无可处理的原文');
  return `标题：${poem.title || ''}
作者：${poem.author || ''}
原文段落：
${JSON.stringify(paragraphs)}`;
}

function parseModelJson(content: string): Record<string, unknown> {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  try {
    const value: unknown = JSON.parse(content.slice(start, end + 1));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // 错误提示统一由下面的异常提供。
  }
  throw new Error('模型未返回可识别的 JSON 结果');
}

function isParagraphList(value: unknown, length: number): value is string[] {
  return Array.isArray(value) && value.length === length &&
    value.every(item => typeof item === 'string' && item.trim().length > 0);
}

export async function optimizePoem(
  poem: PoemData,
  settings: LLMSettings,
  style: TranslationStyle
): Promise<AIOptimizeResult> {
  const originalParagraphs = readParagraphs(poem.original_paragraphs);
  const source = (originalParagraphs.length ? poem.original_paragraphs : poem.paragraphs) || '';
  const paragraphs = originalParagraphs.length ? originalParagraphs : readParagraphs(source);
  const description = describePoem(poem, paragraphs);

  const content = await requestTextCompletion(settings, [{
    role: 'user',
    content: `你是一位精通中国古典诗词的专家。请校正下面的诗词并生成现代汉语译文和拼音。

${description}

只返回一个 JSON 对象，包含 optimizedParagraphs、translation 和 pinyin。
1. optimizedParagraphs 是字符串数组。只做必要的繁简转换、错别字或标点修正，保留原意与段落数量。
2. translation 是现代汉语译文字符串，用换行保留段落结构。${translationStyles[style].instruction}
3. pinyin 是与 optimizedParagraphs 逐段对应的字符串数组。为每个字标注带声调拼音，保留校正后的标点，拼音与标点均用空格分隔，例如 "chéng qián ， lǐ jín 。"。`,
  }]);
  const { optimizedParagraphs, translation, pinyin } = parseModelJson(content);
  if (!isParagraphList(optimizedParagraphs, paragraphs.length) ||
      !isParagraphList(pinyin, paragraphs.length) ||
      typeof translation !== 'string' || !translation.trim()) {
    throw new Error('模型返回的诗词、译文或拼音不完整，请重试');
  }
  return { source, optimizedParagraphs, translation: translation.trim(), pinyin };
}

export async function translatePoem(
  poem: PoemData,
  settings: LLMSettings,
  style: TranslationStyle
): Promise<string> {
  const description = describePoem(poem, readParagraphs(poem.paragraphs));
  const content = await requestTextCompletion(settings, [{
    role: 'user',
    content: `你是一位精通中国古典诗词的译者。请将下面的诗词翻译成现代汉语。

${description}

保留诗意和段落结构，段落间使用换行。${translationStyles[style].instruction}
只返回包含 translation 字符串字段的 JSON 对象。`,
  }]);
  const { translation } = parseModelJson(content);
  if (typeof translation !== 'string' || !translation.trim()) {
    throw new Error('模型未返回完整译文，请重试');
  }
  return translation.trim();
}

export async function saveOptimizedPoem(
  poem: PoemData,
  result: AIOptimizeResult,
  db: Database
): Promise<Partial<PoemData>> {
  const paragraphs = JSON.stringify(result.optimizedParagraphs);
  const pinyin = JSON.stringify(result.pinyin);
  const { rowsAffected } = await db.execute(
    `UPDATE poems
     SET paragraphs = ?, translation = ?, ai_optimized = 1, original_paragraphs = ?, pinyin = ?
     WHERE id = ? AND paragraphs IS ? AND original_paragraphs IS ? AND translation IS ?`,
    [
      paragraphs, result.translation, result.source, pinyin, poem.id,
      poem.paragraphs ?? null, poem.original_paragraphs ?? null, poem.translation ?? null,
    ]
  );
  if (!rowsAffected) throw new Error('诗词已变更，请重新打开后再试');
  return {
    paragraphs,
    translation: result.translation,
    ai_optimized: 1,
    original_paragraphs: result.source,
    pinyin,
  };
}

export async function savePoemTranslation(poem: PoemData, translation: string, db: Database): Promise<void> {
  const { rowsAffected } = await db.execute(
    'UPDATE poems SET translation = ? WHERE id = ? AND paragraphs IS ? AND translation IS ?',
    [translation, poem.id, poem.paragraphs ?? null, poem.translation ?? null]
  );
  if (!rowsAffected) throw new Error('诗词已变更，请重新打开后再试');
}
