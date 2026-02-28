import React, { useEffect, useState } from 'react';
import { Typography, Empty, Spin, Button, message } from 'antd';
import { StarFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { loadFavorites } from '../store/favoriteSlice';
import { getFavoritePoems, removeFavorite } from '../db';
import type { PoemData } from '../types/poem';
import { getActiveCover } from '../db';
import PoemCard from '../components/PoemCard';
import styles from './Favorites.module.scss';

const { Text } = Typography;

interface PoemWithCover extends PoemData {
  activeCover?: string;
}

const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const favorites = useSelector((state: RootState) => state.favorite.favorites);
  const loading = useSelector((state: RootState) => state.favorite.loading);

  const [poems, setPoems] = useState<PoemWithCover[]>([]);
  const [loadingPoems, setLoadingPoems] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  // 加载收藏列表
  useEffect(() => {
    dispatch(loadFavorites());
  }, [dispatch]);

  // 加载收藏的诗词详情
  useEffect(() => {
    const fetchFavoritePoems = async () => {
      if (favorites.length === 0) {
        setPoems([]);
        return;
      }

      setLoadingPoems(true);
      try {
        const favoritePoems = await getFavoritePoems();

        // 获取每张配图的生效配图
        const poemsWithCovers = await Promise.all(
          favoritePoems.map(async (poem) => {
            const activeCover = await getActiveCover(poem.id);
            return {
              ...poem,
              activeCover: activeCover?.cover_path,
            };
          })
        );

        setPoems(poemsWithCovers);
      } catch (error) {
        console.error('Failed to fetch favorite poems:', error);
      } finally {
        setLoadingPoems(false);
      }
    };

    fetchFavoritePoems();
  }, [favorites]);

  const toggleExpand = (id: number) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRemoveFavorite = async (e: React.MouseEvent, poemId: number) => {
    e.stopPropagation();
    try {
      await removeFavorite(poemId);
      dispatch(loadFavorites());
      message.success('已取消收藏');
    } catch (error) {
      message.error('操作失败');
    }
  };



  if (loading || loadingPoems) {
    return (
      <div className={styles.loadingWrapper}>
        <Spin size="large" />
      </div>
    );
  }

  if (poems.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <Empty
          description="暂无收藏诗词"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => navigate('/')}>
            去搜索诗词
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text strong className={styles.title}>
          <StarFilled style={{ color: '#FFD700', marginRight: 8 }} />
          我的收藏
        </Text>
        <Text type="secondary">共 {poems.length} 首</Text>
      </div>

      <div className={styles.grid}>
        {poems.map(poem => (
          <PoemCard
            key={poem.id}
            poem={poem}
            isExpanded={expandedItems[poem.id]}
            onToggleExpand={() => toggleExpand(poem.id)}
            showUnfavorite={true}
            onUnfavorite={(e) => handleRemoveFavorite(e, poem.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default Favorites;
