import React, { useState, useEffect } from 'react';
import { Input, Pagination, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { getPoemsPage } from '../db';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setSearchText, setCurrentPage } from '../store/searchSlice';
import { loadFavorites } from '../store/favoriteSlice';
import PoemCard from '../components/PoemCard';
import type { PoemCardData } from '../types/poem';
import styles from './Home.module.scss';

const pageSize = 10;

const Home: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { searchText, currentPage } = useSelector((state: RootState) => state.search);

  const [poems, setPoems] = useState<PoemCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [inputValue, setInputValue] = useState(searchText);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [triggerSearch, setTriggerSearch] = useState(0);

  // 加载收藏列表
  useEffect(() => {
    dispatch(loadFavorites());
  }, [dispatch]);

  useEffect(() => {
    let current = true;
    const searchKeywords = searchText.trim().split(/\s+/).filter(Boolean);
    setLoading(true);
    getPoemsPage(searchKeywords, currentPage, pageSize)
      .then(result => {
        if (!current) return;
        setPoems(result.poems);
        setTotal(result.total);
        setKeywords(searchKeywords);
      })
      .catch(error => console.error('Failed to fetch poems:', error))
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => { current = false; };
  }, [searchText, currentPage, triggerSearch]);

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };



  // 执行搜索
  const handleSearch = () => {
    dispatch(setSearchText(inputValue));
    dispatch(setCurrentPage(1));
    setTriggerSearch(prev => prev + 1);
  };

  // 处理回车键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchWrapper}>
        <Input
          placeholder="输入关键字，空格分隔"
          prefix={<SearchOutlined onClick={handleSearch} style={{ cursor: 'pointer' }} />}
          size="large"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          allowClear
        />
      </div>

      <div className={styles.gridContainer}>
        {loading ? (
          <div className={styles.loadingWrapper}>
            <Spin size="large" />
          </div>
        ) : (
          <div className={styles.grid}>
            {poems.map(poem => (
              <PoemCard
                key={poem.id}
                poem={poem}
                keywords={keywords}
                isExpanded={expandedItems[poem.id]}
                onToggleExpand={() => toggleExpand(poem.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.pagination}>
        <Pagination
          current={currentPage}
          total={total}
          pageSize={pageSize}
          onChange={page => dispatch(setCurrentPage(page))}
          showSizeChanger={false}
        />
      </div>
    </div>
  );
};

export default Home;
