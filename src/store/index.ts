import { configureStore } from '@reduxjs/toolkit';
import searchReducer from './searchSlice';
import settingsReducer from './settingsSlice';
import themeReducer from './themeSlice';
import downloadReducer from './downloadSlice';
import fontReducer from './fontSlice';
import favoriteReducer from './favoriteSlice';

export const store = configureStore({
  reducer: {
    search: searchReducer,
    settings: settingsReducer,
    theme: themeReducer,
    download: downloadReducer,
    font: fontReducer,
    favorite: favoriteReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

