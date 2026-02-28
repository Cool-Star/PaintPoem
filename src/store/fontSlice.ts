import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { FontData, FontState } from '../types/font';
import {
  getFonts,
  addFont,
  deleteFont,
  setGlobalDefaultFont,
  setPrintDefaultFont,
  getGlobalDefaultFont,
  getPrintDefaultFont,
} from '../db';
import { writeFile, BaseDirectory, mkdir, exists } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';

const initialState: FontState = {
  fonts: [],
  globalDefaultFontId: null,
  printDefaultFontId: null,
  loading: false,
};

// 异步 Thunks

// 加载所有字体
export const loadFonts = createAsyncThunk('font/loadFonts', async () => {
  const fonts = await getFonts();
  const globalDefault = await getGlobalDefaultFont();
  const printDefault = await getPrintDefaultFont();
  return {
    fonts,
    globalDefaultFontId: globalDefault?.id || null,
    printDefaultFontId: printDefault?.id || null,
  };
});

// 上传字体
export const uploadFont = createAsyncThunk(
  'font/uploadFont',
  async ({ name, file }: { name: string; file: File }) => {
    // 确保 fonts 目录存在
    const fontsDir = 'fonts';
    const dirExists = await exists(fontsDir, { baseDir: BaseDirectory.AppData });
    if (!dirExists) {
      await mkdir(fontsDir, { baseDir: BaseDirectory.AppData, recursive: true });
    }

    // 生成安全的文件名（使用时间戳 + 随机字符）
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'ttf';
    const safeFilename = `${timestamp}_${randomStr}.${extension}`;

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 保存到应用数据目录 - 使用绝对路径
    const filePath = await join(fontsDir, safeFilename);
    const appData = await appDataDir();
    const fullPath = await join(appData, filePath);

    await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.AppData });

    // 添加到数据库，保留原始名称作为 family，存储绝对路径
    const fontId = await addFont({
      name: name.trim(),           // 显示名称（原始名称）
      path: fullPath,              // 文件路径（绝对路径）
      format: extension.toLowerCase(),
      family: name.trim(),         // 字体家族名称（用于 CSS font-family）
      isBuiltin: 0,
      isGlobalDefault: 0,
      isPrintDefault: 0,
    });

    return fontId;
  }
);

// 删除字体
export const removeFont = createAsyncThunk(
  'font/removeFont',
  async (id: number) => {
    await deleteFont(id);
    return id;
  }
);

// 设置全局默认字体
export const setGlobalFont = createAsyncThunk(
  'font/setGlobalFont',
  async (id: number | null) => {
    await setGlobalDefaultFont(id);
    return id;
  }
);

// 设置打印默认字体
export const setPrintFont = createAsyncThunk(
  'font/setPrintFont',
  async (id: number | null) => {
    await setPrintDefaultFont(id);
    return id;
  }
);

const fontSlice = createSlice({
  name: 'font',
  initialState,
  reducers: {
    setFonts: (state, action: PayloadAction<FontData[]>) => {
      state.fonts = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // 加载字体
      .addCase(loadFonts.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadFonts.fulfilled, (state, action) => {
        state.fonts = action.payload.fonts;
        state.globalDefaultFontId = action.payload.globalDefaultFontId;
        state.printDefaultFontId = action.payload.printDefaultFontId;
        state.loading = false;
      })
      .addCase(loadFonts.rejected, (state) => {
        state.loading = false;
      })
      // 上传字体
      .addCase(uploadFont.pending, (state) => {
        state.loading = true;
      })
      .addCase(uploadFont.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(uploadFont.rejected, (state) => {
        state.loading = false;
      })
      // 删除字体
      .addCase(removeFont.fulfilled, (state, action) => {
        state.fonts = state.fonts.filter((f) => f.id !== action.payload);
        if (state.globalDefaultFontId === action.payload) {
          state.globalDefaultFontId = null;
        }
        if (state.printDefaultFontId === action.payload) {
          state.printDefaultFontId = null;
        }
      })
      // 设置全局默认
      .addCase(setGlobalFont.fulfilled, (state, action) => {
        state.globalDefaultFontId = action.payload;
        // 更新字体列表中的状态
        state.fonts = state.fonts.map((f) => ({
          ...f,
          isGlobalDefault: f.id === action.payload ? 1 : 0,
        }));
      })
      // 设置打印默认
      .addCase(setPrintFont.fulfilled, (state, action) => {
        state.printDefaultFontId = action.payload;
        // 更新字体列表中的状态
        state.fonts = state.fonts.map((f) => ({
          ...f,
          isPrintDefault: f.id === action.payload ? 1 : 0,
        }));
      });
  },
});

export const { setFonts } = fontSlice.actions;
export default fontSlice.reducer;
