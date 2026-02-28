import { convertFileSrc } from '@tauri-apps/api/core';
import type { FontData } from '../types/font';

// 已加载的字体集合（防止重复加载）
const loadedFonts = new Set<number>();

/**
 * 加载字体文件并注册到浏览器
 */
export const loadFontFace = async (font: FontData): Promise<boolean> => {
  // 已加载过的字体不重复加载
  if (loadedFonts.has(font.id)) return true;

  // 内置字体不需要动态加载（已在CSS中定义）
  if (font.isBuiltin) {
    loadedFonts.add(font.id);
    console.log('内置字体已在CSS中定义:', font.name);
    return true;
  }

  try {
    // 使用 Tauri 的 convertFileSrc 转换绝对路径为 URL
    const fontUrl = convertFileSrc(font.path);
    console.log('加载字体:', font.name, 'URL:', fontUrl);

    // 使用字体 ID 作为 family 名，避免特殊字符问题
    const familyName = `Font_${font.id}`;
    const fontFace = new FontFace(familyName, `url("${fontUrl}")`);
    await fontFace.load();
    document.fonts.add(fontFace);
    loadedFonts.add(font.id);
    console.log('字体加载成功:', font.name);
    return true;
  } catch (error) {
    console.warn(`加载字体 ${font.name} 失败:`, error);
    return false;
  }
};

/**
 * 批量加载字体
 */
export const loadFonts = async (fonts: FontData[]): Promise<void> => {
  for (const font of fonts) {
    if (!loadedFonts.has(font.id)) {
      await loadFontFace(font);
    }
  }
};

/**
 * 获取字体的 CSS family 名称
 */
export const getFontFamily = (font: FontData | null | undefined): string => {
  if (!font) return "'KaiTi', 'STKaiti', '华文楷体', serif";
  if (font.isBuiltin) return "'KaiTi', 'STKaiti', '华文楷体', serif";
  return `Font_${font.id}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
};

/**
 * 检查字体是否已加载
 */
export const isFontLoaded = (fontId: number): boolean => {
  return loadedFonts.has(fontId);
};
