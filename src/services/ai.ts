import OpenAI from 'openai';
import type { PoemData } from '../types/poem';

export interface AIOptimizeResult {
  optimizedParagraphs: string[];
  translation: string;
  pinyin: string[];
  success: boolean;
  error?: string;
}

export interface LLMSettings {
  llmUrl: string;
  llmKey: string;
  llmModel: string;
}

/**
 * 调用AI大模型优化诗词
 * @param poem 原始诗词数据
 * @param settings LLM配置
 * @returns 优化结果
 */
export async function optimizePoem(
  poem: PoemData,
  settings: LLMSettings
): Promise<AIOptimizeResult> {
  try {
    const { llmUrl, llmKey, llmModel } = settings;

    if (!llmUrl || !llmKey) {
      throw new Error('LLM配置不完整，请在设置中配置文本大模型');
    }

    const originalText = poem.paragraphs || '';
    const title = poem.title || '';
    const author = poem.author || '';

    const prompt = `你是一位精通中国古典诗词的专家。请对以下诗词进行校正并生成现代汉语译文和注音拼音。

诗词标题：${title}
作者：${author}
原文：
${originalText}

请按以下JSON格式返回结果：
{
  "optimizedParagraphs": ["校正后的段落1", "校正后的段落2", ...],
  "translation": "完整的现代汉语译文",
  "pinyin": ["注音拼音1", "注音拼音2", ...]
}

要求：
1. optimizedParagraphs：对原文进行必要的校正（如繁简转换、错别字修正、标点优化等），保持原意不变
2. translation：提供流畅的现代汉语译文，帮助读者理解诗词含义,注意保持段落结构与原文一致。
3. pinyin：为每个段落提供完整的注音拼音，要求如下：
   - 使用空格分隔每个字的拼音，例如 "chéng qián lǐ jín zì xì"
   - 必须保留原文中的所有标点符号（如逗号、句号、问号、感叹号等）
   - 标点符号两侧也要用空格隔开，例如 "chéng qián ， lǐ jín 。"
   - 确保pinyin数组的段落数量、结构与原文完全一致
   - 每个段落的拼音应与对应的optimizedParagraphs段落一一对应
4. 返回必须是合法的JSON格式，不要包含其他内容`;

    // 创建 OpenAI 客户端
    const client = new OpenAI({
      apiKey: llmKey,
      baseURL: llmUrl,
      dangerouslyAllowBrowser: true,
    });

    const completion = await client.chat.completions.create({
      model: llmModel || 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的中国古典诗词助手，擅长诗词校正和翻译。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('AI返回内容为空');
    }

    // 解析JSON响应
    let result: { optimizedParagraphs: string[]; translation: string; pinyin: string[] };
    try {
      // 尝试直接解析
      result = JSON.parse(content);
    } catch {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析AI返回的JSON格式');
      }
    }

    return {
      optimizedParagraphs: result.optimizedParagraphs,
      translation: result.translation,
      pinyin: result.pinyin || [],
      success: true,
    };
  } catch (error) {
    console.error('AI优化失败:', error);
    return {
      optimizedParagraphs: [],
      translation: '',
      pinyin: [],
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 保存AI优化结果到数据库
 * @param poemId 诗词ID
 * @param result 优化结果
 * @param db 数据库实例
 */
export async function saveOptimizedPoem(
  poemId: number,
  result: AIOptimizeResult,
  db: any
): Promise<void> {
  if (!result.success) {
    throw new Error(result.error || '优化失败');
  }

  await db.execute(
    `UPDATE poems SET 
      paragraphs = ?, 
      translation = ?, 
      ai_optimized = 1,
      original_paragraphs = COALESCE(original_paragraphs, paragraphs),
      pinyin = ?
    WHERE id = ?`,
    [
      JSON.stringify(result.optimizedParagraphs),
      result.translation,
      JSON.stringify(result.pinyin),
      poemId,
    ]
  );
}
