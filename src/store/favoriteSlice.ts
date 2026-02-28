import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getFavorites, addFavorite, removeFavorite } from '../db';

interface FavoriteState {
  favorites: number[];
  loading: boolean;
}

const initialState: FavoriteState = {
  favorites: [],
  loading: false,
};

// 异步加载收藏列表
export const loadFavorites = createAsyncThunk(
  'favorite/loadFavorites',
  async () => {
    const favorites = await getFavorites();
    return favorites.map(f => f.poem_id);
  }
);

// 添加收藏
export const addFavoriteAsync = createAsyncThunk(
  'favorite/addFavorite',
  async (poemId: number) => {
    await addFavorite(poemId);
    return poemId;
  }
);

// 移除收藏
export const removeFavoriteAsync = createAsyncThunk(
  'favorite/removeFavorite',
  async (poemId: number) => {
    await removeFavorite(poemId);
    return poemId;
  }
);

// 切换收藏状态
export const toggleFavoriteAsync = createAsyncThunk(
  'favorite/toggleFavorite',
  async (poemId: number, { getState }) => {
    const state = getState() as { favorite: FavoriteState };
    const isFav = state.favorite.favorites.includes(poemId);

    if (isFav) {
      await removeFavorite(poemId);
    } else {
      await addFavorite(poemId);
    }

    return { poemId, isFav: !isFav };
  }
);

const favoriteSlice = createSlice({
  name: 'favorite',
  initialState,
  reducers: {
    clearFavorites: (state) => {
      state.favorites = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // 加载收藏
      .addCase(loadFavorites.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadFavorites.fulfilled, (state, action) => {
        state.favorites = action.payload;
        state.loading = false;
      })
      .addCase(loadFavorites.rejected, (state) => {
        state.loading = false;
      })
      // 添加收藏
      .addCase(addFavoriteAsync.fulfilled, (state, action) => {
        if (!state.favorites.includes(action.payload)) {
          state.favorites.push(action.payload);
        }
      })
      // 移除收藏
      .addCase(removeFavoriteAsync.fulfilled, (state, action) => {
        state.favorites = state.favorites.filter(id => id !== action.payload);
      })
      // 切换收藏
      .addCase(toggleFavoriteAsync.fulfilled, (state, action) => {
        const { poemId, isFav } = action.payload;
        if (isFav) {
          if (!state.favorites.includes(poemId)) {
            state.favorites.push(poemId);
          }
        } else {
          state.favorites = state.favorites.filter(id => id !== poemId);
        }
      });
  },
});

export const { clearFavorites } = favoriteSlice.actions;
export default favoriteSlice.reducer;
