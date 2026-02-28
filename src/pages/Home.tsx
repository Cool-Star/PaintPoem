import React, { useState, useEffect, useCallback } from 'react';
import { Input, Pagination, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { getDb, getActiveCover } from '../db';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setSearchText, setCurrentPage } from '../store/searchSlice';
import { loadFavorites } from '../store/favoriteSlice';
import PoemCard from '../components/PoemCard';
import styles from './Home.module.scss';

interface Poem {
  id: number;
  title: string;
  author: string;
  paragraphs: string;
  tags: string;
  groups: string;
  activeCover?: string;
}

const Home: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { searchText, currentPage } = useSelector((state: RootState) => state.search);

  const [poems, setPoems] = useState<Poem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [inputValue, setInputValue] = useState(searchText);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [triggerSearch, setTriggerSearch] = useState(0);

  const pageSize = 10;

  // 加载收藏列表
  useEffect(() => {
    dispatch(loadFavorites());
  }, [dispatch]);

  const fetchPoems = useCallback(async () => {
    setLoading(true);
    try {
      const db = await getDb();
      let query = 'SELECT * FROM poems';
      let countQuery = 'SELECT COUNT(*) as count FROM poems';
      let params: any[] = [];

      // 按空格切分关键字
      const searchKeywords = searchText.trim().split(/\s+/).filter(k => k.length > 0);
      // 保存关键字用于高亮
      setKeywords(searchKeywords);

      if (searchKeywords.length > 0) {
        const conditions: string[] = [];

        searchKeywords.forEach(keyword => {
          const likeText = `%${keyword}%`;
          // 每个关键字都要在标题、作者或内容中匹配
          conditions.push('(title LIKE ? OR author LIKE ? OR paragraphs LIKE ?)');
          params.push(likeText, likeText, likeText);
        });

        // 所有条件用 AND 连接
        query += ' WHERE ' + conditions.join(' AND ');
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`;

      const results = await db.select<Poem[]>(query, params);
      const totalResult = await db.select<{ count: number }[]>(countQuery, params);

      // 获取每张诗词的生效配图
      const poemsWithCovers = await Promise.all(
        results.map(async (poem) => {
          const activeCover = await getActiveCover(poem.id);
          return {
            ...poem,
            activeCover: activeCover?.cover_path,
          };
        })
      );

      setPoems(poemsWithCovers);
      setTotal(totalResult[0].count);
    } catch (error) {
      console.error('Failed to fetch poems:', error);
    } finally {
      setLoading(false);
    }
  }, [searchText, currentPage, triggerSearch]);

  useEffect(() => {
    fetchPoems();
  }, [fetchPoems]);

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
