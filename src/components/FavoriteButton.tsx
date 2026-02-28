import React from 'react';
import { Button, Tooltip, message } from 'antd';
import { StarOutlined, StarFilled } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { toggleFavoriteAsync } from '../store/favoriteSlice';

interface FavoriteButtonProps {
  poemId: number;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  poemId,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const favorites = useSelector((state: RootState) => state.favorite.favorites);
  const isFavorited = favorites.includes(poemId);

  const handleToggle = async () => {
    try {
      await dispatch(toggleFavoriteAsync(poemId)).unwrap();
      message.success(isFavorited ? '已取消收藏' : '收藏成功');
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  return (
    <Tooltip title={isFavorited ? '取消收藏' : '收藏'} placement="bottom">
      <Button
        type="text"
        size="large"
        className="actionBtn"
        onClick={handleToggle}
        icon={isFavorited ? <StarFilled style={{ color: '#FFD700' }} /> : <StarOutlined />}
        style={isFavorited ? { color: '#FFD700' } : undefined}
      />
    </Tooltip>
  );
};

export default FavoriteButton;
