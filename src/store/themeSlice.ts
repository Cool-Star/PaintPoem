import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { saveGlobalBackground, getGlobalBackground } from '../db';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ThemeState {
  backgroundUrl: string | null;
  theme: string;
  activeCoverPoemId: number | null;
  activeCoverId: number | null;
}

const initialState: ThemeState = {
  theme: 'light',
  backgroundUrl: null,
  activeCoverPoemId: null,
  activeCoverId: null,
};

// 异步加载全局背景图
export const loadGlobalBackground = createAsyncThunk(
  'theme/loadGlobalBackground',
  async () => {
    const bg = await getGlobalBackground();
    if (bg && bg.cover_path) {
      return {
        coverUrl: convertFileSrc(bg.cover_path),
        poemId: bg.poem_id,
        coverId: bg.cover_id,
      };
    }
    return null;
  }
);

// 异步保存全局背景图
export const saveActiveCover = createAsyncThunk(
  'theme/saveActiveCover',
  async (payload: { coverUrl: string | null; poemId: number | null; coverId: number | null; coverPath?: string | null }) => {
    await saveGlobalBackground(payload.poemId, payload.coverId, payload.coverPath || null);
    return payload;
  }
);

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<string>) => {
      state.theme = action.payload;
    },
    setBackgroundUrl: (state, action: PayloadAction<string | null>) => {
      state.backgroundUrl = action.payload;
    },
    resetBackgroundUrl: (state) => {
      state.backgroundUrl = initialState.backgroundUrl;
    },
    setActiveCover: (state, action: PayloadAction<{ coverUrl: string | null; poemId: number | null; coverId: number | null }>) => {
      state.backgroundUrl = action.payload.coverUrl;
      state.activeCoverPoemId = action.payload.poemId;
      state.activeCoverId = action.payload.coverId;
    },
    resetActiveCover: (state) => {
      state.backgroundUrl = initialState.backgroundUrl;
      state.activeCoverPoemId = initialState.activeCoverPoemId;
      state.activeCoverId = initialState.activeCoverId;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadGlobalBackground.fulfilled, (state, action) => {
        if (action.payload) {
          state.backgroundUrl = action.payload.coverUrl;
          state.activeCoverPoemId = action.payload.poemId;
          state.activeCoverId = action.payload.coverId;
        }
      })
      .addCase(saveActiveCover.fulfilled, (state, action) => {
        state.backgroundUrl = action.payload.coverUrl;
        state.activeCoverPoemId = action.payload.poemId;
        state.activeCoverId = action.payload.coverId;
      });
  },
});

export const { setTheme, setBackgroundUrl, setActiveCover, resetActiveCover } = themeSlice.actions;
export default themeSlice.reducer;
