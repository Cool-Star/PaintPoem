import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SettingsState {
  // 文本大模型配置
  llmUrl: string;
  llmKey: string;
  llmModel: string;
  // 图片生成配置
  imageModel: string;
  imageApiKey: string;
  imageBaseURL: string;
}

const initialState: SettingsState = {
  llmUrl: '',
  llmKey: '',
  llmModel: '',
  imageModel: '',
  imageApiKey: '',
  imageBaseURL: '',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<Partial<SettingsState>>) => {
      return { ...state, ...action.payload };
    },
    setLlmConfig: (state, action: PayloadAction<{ url: string; key: string }>) => {
      state.llmUrl = action.payload.url;
      state.llmKey = action.payload.key;
    },
    setImageConfig: (state, action: PayloadAction<{ model: string; apiKey: string; baseURL: string }>) => {
      state.imageModel = action.payload.model;
      state.imageApiKey = action.payload.apiKey;
      state.imageBaseURL = action.payload.baseURL;
    },
  },
});

export const { setSettings, setLlmConfig, setImageConfig } = settingsSlice.actions;
export default settingsSlice.reducer;
