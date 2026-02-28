// 字体类型定义

export interface FontData {
  id: number;
  // 字体名称
  name: string;
  // 字体文件路径
  path: string;
  // 字体格式 (ttf, otf, woff, woff2)
  format: string;
  // 字体家族名称
  family?: string;
  // 是否是内置字体
  isBuiltin: number;
  // 是否是全局默认字体
  isGlobalDefault: number;
  // 是否是打印默认字体
  isPrintDefault: number;
  // 创建时间
  createdAt?: string;
  // 更新时间
  updatedAt?: string;
}

// 字体状态
export interface FontState {
  // 所有字体列表
  fonts: FontData[];
  // 全局默认字体ID
  globalDefaultFontId: number | null;
  // 打印默认字体ID
  printDefaultFontId: number | null;
  // 加载状态
  loading: boolean;
}

// 字体上传参数
export interface UploadFontParams {
  name: string;
  file: File;
}

// 字体设置
export interface FontSettings {
  globalDefaultFontId: number | null;
  printDefaultFontId: number | null;
}
