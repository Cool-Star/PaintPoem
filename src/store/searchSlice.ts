import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SearchState {
  searchText: string;
  currentPage: number;
}

const initialState: SearchState = {
  searchText: '',
  currentPage: 1,
};

export const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    setSearchText: (state, action: PayloadAction<string>) => {
      state.searchText = action.payload;
      state.currentPage = 1; // 搜索时重置页码
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    resetSearch: (state) => {
      state.searchText = '';
      state.currentPage = 1;
    },
  },
});

export const { setSearchText, setCurrentPage, resetSearch } = searchSlice.actions;
export default searchSlice.reducer;
