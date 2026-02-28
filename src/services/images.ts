import OpenAI from 'openai';
import { mkdir, BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { download } from '@tauri-apps/plugin-upload';

/**
 * 生成随机文件名
 */
const generateRandomFilename = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `image_${timestamp}_${random}.png`;
};

interface GenerateImageParams {
  prompt: string;
  filename?: string;
  model: string;
  apiKey: string;
  baseURL: string;
  size?: string;
}

const generateImage = async ({
  prompt,
  filename,
  model,
  apiKey,
  baseURL,
  size = '1440x2560',
}: GenerateImageParams) => {
  // 创建 OpenAI 客户端实例
  const client = new OpenAI({
    baseURL,
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  // 调用图片生成 API
  const response = await client.images.generate({
    model,
    prompt,
    size: size as any,
    response_format: 'url'
  });


  const imageUrl = response.data?.[0]?.url || '';
  if (!imageUrl) {
    throw new Error('生成图片失败：未返回图片数据');
  }

  // 确保 images 目录存在
  const imagesDir = 'images';
  const dirExists = await exists(imagesDir, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(imagesDir, { baseDir: BaseDirectory.AppData, recursive: true });
  }

  // 确定文件名
  const finalFilename = filename || generateRandomFilename();
  const fileNameWithExt = finalFilename.endsWith('.png') ? finalFilename : `${finalFilename}.png`;

  // 使用 Tauri 的 download 功能下载图片（绕过 CORS 限制）
  const filePath = await join(imagesDir, fileNameWithExt);
  const appDataPath = await import('@tauri-apps/api/path').then(m => m.appDataDir());
  const fullPath = await join(appDataPath, filePath);

  await download(imageUrl, fullPath);

  // 返回可访问的文件路径
  return fullPath;
};



export { generateImage };
