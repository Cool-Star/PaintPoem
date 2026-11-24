import OpenAI from 'openai';
import type { ImageGenerateParamsNonStreaming } from 'openai/resources/images';
import { mkdir, BaseDirectory, writeFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { download } from '@tauri-apps/plugin-upload';
import { isGptImageModel, resolveImageSize, type ImageStyle } from './imageOptions';
import { requestTextCompletion, type LLMSettings } from './textModel';
import type { PoemData } from '../types/poem';

const styleDescriptions: Record<ImageStyle, string> = {
  classic: '中国古典插画，兼具水墨与工笔质感，构图含蓄，讲究留白和层次。',
  cartoon: '国风卡通插画，造型简洁生动，线条柔和，色彩明快。',
};

function describePoem(poem: PoemData) {
  let content = poem.paragraphs || '';
  try {
    const paragraphs: unknown = JSON.parse(content);
    if (Array.isArray(paragraphs)) {
      content = paragraphs.filter((paragraph): paragraph is string => typeof paragraph === 'string').join('\n');
    }
  } catch {
    // 旧数据库中的原文也可能是纯文本。
  }
  return `题目：${poem.title || '未题名'}\n作者：${poem.author || '佚名'}\n原文：\n${content}`;
}

export async function buildPoemImagePrompt(
  poem: PoemData,
  style: ImageStyle,
  textSettings?: LLMSettings,
): Promise<{ prompt: string; descriptionError?: string }> {
  const source = describePoem(poem);
  const instructions = `绘制体现中国古典诗词意境的插画。画风：${styleDescriptions[style]}画面中不要出现文字、题跋、水印或标识。`;
  const fallback = `${instructions}\n参考诗词：\n${source}`;
  if (!textSettings?.llmUrl.trim() || !textSettings.llmKey.trim()) return { prompt: fallback };

  try {
    const description = await requestTextCompletion(textSettings, [
      {
        role: 'system',
        content: '你是中国古典诗词的配图美术编辑。用简体中文写一段直接可用的画面描述，具体说明主体、场景、构图、颜色与光线，贴合原诗意境。只输出描述正文，不引用诗句，不添加画面文字、题跋、水印或标识。',
      },
      { role: 'user', content: `画风：${styleDescriptions[style]}\n参考诗词：\n${source}` },
    ], 30_000);
    return { prompt: `${instructions}\n画面描述：${description}` };
  } catch (error) {
    return {
      prompt: fallback,
      descriptionError: error instanceof Error ? error.message : '文本模型暂时无法生成配图描述',
    };
  }
}

interface GenerateImageParams {
  prompt: string;
  filename?: string;
  model: string;
  apiKey: string;
  baseURL: string;
  size?: string;
}

function configuredEndpoint(baseURL: string, model: string) {
  let url: URL;
  try {
    url = new URL(baseURL.trim());
  } catch {
    throw new Error('图像模型 Base URL 无效，请检查设置');
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    throw new Error('图像模型 Base URL 必须使用 HTTP 或 HTTPS，并在 API Key 字段单独填写密钥');
  }
  if (url.hostname === 'api.openai.com') {
    if (['gpt-image-1', 'dall-e-2', 'dall-e-3'].includes(model.toLowerCase())) {
      throw new Error('OpenAI 已停用该图像模型，请在设置中改用 gpt-image-2.5-flare 等受支持的模型');
    }
    url.protocol = 'https:';
    if (/^\/(?:v1\/images\/generations\/?)?$/.test(url.pathname)) url.pathname = '/v1';
  }
  return url.toString().replace(/\/$/, '');
}

const requestFailureReasons: Record<number, string> = {
  400: '请核对图像模型名称、尺寸和配图描述',
  401: '请检查图像模型 API Key',
  403: '请检查图像模型权限和组织验证状态',
  404: '请检查图像模型名称和 Base URL',
  429: '请检查调用限额和账户额度',
};

function imageRequestError(error: unknown) {
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new Error('生成图片超时，请稍后重试');
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new Error('无法连接图像模型服务，请检查 Base URL 和网络');
  }
  if (error instanceof OpenAI.APIError && error.status) {
    const reason = requestFailureReasons[error.status] ?? '请检查服务状态后重试';
    return new Error(`图像模型请求失败（HTTP ${error.status}），${reason}`);
  }
  return new Error('图像模型请求失败，请检查图像生成设置');
}

function decodeImage(encoded: string) {
  try {
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    if (bytes.length === 0) throw new Error();
    return bytes;
  } catch {
    throw new Error('图像模型返回的 Base64 图片数据无效');
  }
}

export async function generateImage({
  prompt,
  filename,
  model,
  apiKey,
  baseURL,
  size,
}: GenerateImageParams): Promise<string> {
  model = model.trim();
  apiKey = apiKey.trim();
  if (!model || !apiKey) throw new Error('请先在设置中填写图像模型名称和 API Key');

  const client = new OpenAI({
    baseURL: configuredEndpoint(baseURL, model),
    apiKey,
    dangerouslyAllowBrowser: true,
    logLevel: 'off',
    maxRetries: 0,
    timeout: 180_000,
  });

  let response: OpenAI.Images.ImagesResponse;
  try {
    response = await client.images.generate({
      model,
      prompt,
      // 兼容服务支持 SDK 类型未列出的自定义尺寸。
      size: resolveImageSize(model, size) as ImageGenerateParamsNonStreaming['size'],
      ...(isGptImageModel(model) ? {} : { response_format: 'url' as const }),
    });
  } catch (error) {
    throw imageRequestError(error);
  }

  const image = response?.data?.[0];
  const url = typeof image?.url === 'string' ? image.url.trim() : '';
  const base64 = typeof image?.b64_json === 'string' ? image.b64_json.trim() : '';
  const dataUrl = /^data:[^,]*;base64,([\s\S]+)$/i.exec(url);
  const encoded = base64 || dataUrl?.[1];
  const bytes = encoded ? decodeImage(encoded) : undefined;
  if (!bytes && !/^https?:\/\//i.test(url)) {
    throw new Error('图像模型未返回可用的图片数据或下载链接');
  }

  try {
    const imagesDir = 'images';
    await mkdir(imagesDir, { baseDir: BaseDirectory.AppData, recursive: true });
    const random = crypto.getRandomValues(new Uint32Array(2)).join('-');
    const name = filename || `image_${Date.now()}_${random}`;
    const fullPath = await join(await appDataDir(), imagesDir, name.endsWith('.png') ? name : `${name}.png`);

    if (bytes) {
      await writeFile(fullPath, bytes);
    } else {
      await download(url, fullPath);
    }
    return fullPath;
  } catch {
    throw new Error(bytes ? '保存配图失败，请检查应用数据目录' : '下载或保存配图失败，请检查网络后重试');
  }
}
