import React from 'react';
import { Card, Typography, Button, Tag } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import FavoriteButton from './FavoriteButton';
import styles from './PoemCard.module.scss';

const { Text, Paragraph } = Typography;

interface PoemCardProps {
  poem: {
    id: number;
    title?: string;
    author?: string;
    paragraphs?: string;
    tags?: string;
    activeCover?: string;
  };
  keywords?: string[];
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  showUnfavorite?: boolean;
  onUnfavorite?: (e: React.MouseEvent) => void;
}

const PoemCard: React.FC<PoemCardProps> = ({
  poem,
  keywords = [],
  isExpanded = false,
  onToggleExpand,
  showUnfavorite = false,
  onUnfavorite,
}) => {
  const navigate = useNavigate();

  const highlightText = (text: string, highlightKeywords: string[]) => {
    if (!highlightKeywords || highlightKeywords.length === 0) return text;

    const escapedKeywords = highlightKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');

    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => {
          const isMatch = highlightKeywords.some(k => part.toLowerCase() === k.toLowerCase());
          return isMatch ? (
            <mark key={i} className={styles.highlight}>{part}</mark>
          ) : part;
        })}
      </span>
    );
  };

  const renderPoemContent = () => {
    const paragraphs: string[] = JSON.parse(poem.paragraphs || '[]');
    const fullText = paragraphs.join('\n');

    return (
      <div className={styles.poemContent}>
        <Paragraph
          ellipsis={isExpanded ? false : { rows: 4, expandable: false }}
          className={styles.paragraph}
        >
          {highlightText(fullText, keywords)}
        </Paragraph>
        {paragraphs.length > 4 && !isExpanded && onToggleExpand && (
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            icon={<DownOutlined />}
            className={styles.expandBtn}
          >
            查看全部
          </Button>
        )}
        {isExpanded && onToggleExpand && (
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            icon={<UpOutlined />}
            className={styles.expandBtn}
          >
            收起
          </Button>
        )}
      </div>
    );
  };
  return (
    <Card
      hoverable
      className={styles.card}
      styles={{ body: { padding: '10px', position: 'relative', height: '100%' } }}
      onClick={() => navigate(`/poem/${poem.id}`)}
    >
      {poem.activeCover && (
        <div
          className={styles.cardBackground}
          style={{ backgroundImage: `url("${convertFileSrc(poem.activeCover)}")` }}
        />
      )}
      <div className={styles.cardBody}>
        <div className={styles.content}>
          <div>
            <div className={styles.titleRow}>
              <Text
                strong
                className={styles.title}
              >
                {highlightText(poem.title || '', keywords)}
              </Text>
              {showUnfavorite && onUnfavorite ? (
                <Button
                  type="text"
                  size="small"
                  icon={<span style={{ color: '#FFD700' }}>★</span>}
                  onClick={onUnfavorite}
                  className={styles.unfavoriteBtn}
                />
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  <FavoriteButton poemId={poem.id} />
                </div>
              )}
            </div>
            <Text type="secondary" className={styles.author}>
              {highlightText(poem.author || '', keywords)}
            </Text>
            <div className={styles.coverSection}>
              <div style={{ flex: 1 }}>
                {renderPoemContent()}
              </div>
            </div>
            {poem.tags && poem.tags.startsWith('[') && poem.tags.endsWith(']') && (
              <div className={styles.tags}>
                {JSON.parse(poem.tags || '[]').map((tag: string) => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default PoemCard;
