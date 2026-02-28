import React, { useState } from 'react';
import { Tooltip, Modal, message, Button } from 'antd';
import { DeleteOutlined, PictureOutlined, DoubleRightOutlined, DoubleLeftOutlined } from '@ant-design/icons';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { PoemCover } from '../db';
import styles from './CoverSwitcher.module.scss';

interface CoverSwitcherProps {
  covers: PoemCover[];
  activeCoverId: number | null;
  onSwitch: (coverId: number) => void;
  onDelete: (coverId: number) => void;
  poemId: number;
}

const CoverSwitcher: React.FC<CoverSwitcherProps> = ({
  covers,
  activeCoverId,
  onSwitch,
  onDelete,
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [coverToDelete, setCoverToDelete] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (covers.length === 0) {
    return null;
  }

  // 展开时显示所有配图，收起时不显示任何配图
  const displayCovers = expanded ? covers : [];

  const handleDeleteClick = (e: React.MouseEvent, coverId: number) => {
    e.stopPropagation();
    setCoverToDelete(coverId);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (coverToDelete !== null) {
      onDelete(coverToDelete);
      setDeleteModalOpen(false);
      setCoverToDelete(null);
      message.success('配图已删除');
    }
  };

  return (
    <>
      <div className={styles.container}>

        <div className={styles.actions}>
          {covers.length > 1 && (
            <Tooltip title={expanded ? '收起' : '展开'} placement="left">
              <Button
                type="text"
                size="small"
                className={styles.expandBtn}
                onClick={() => setExpanded(!expanded)}
              >
                <span>{covers.length}</span>
                <PictureOutlined className={styles.icon} />

                {expanded ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
              </Button>
            </Tooltip>
          )}
        </div>
        <div className={`${styles.coverList} ${expanded ? styles.expanded : styles.collapsed}`}>
          {displayCovers.map((cover) => {
            const isActive = cover.id === activeCoverId;
            const coverUrl = convertFileSrc(cover.cover_path);

            return (
              <Tooltip
                key={cover.id}
                title={isActive ? '当前生效' : '点击切换'}
                placement="top"
              >
                <div
                  className={`${styles.coverItem} ${isActive ? styles.active : ''}`}
                  onClick={() => onSwitch(cover.id)}
                >
                  <img
                    src={coverUrl}
                    alt="配图"
                    className={styles.thumbnail}
                  />
                  {expanded && covers.length > 1 && (
                    <div
                      className={styles.deleteBtn}
                      onClick={(e) => handleDeleteClick(e, cover.id)}
                    >
                      <DeleteOutlined />
                    </div>
                  )}
                  {isActive && <div className={styles.activeIndicator} />}
                </div>
              </Tooltip>
            );
          })}
        </div>

      </div>

      <Modal
        title="确认删除"
        open={deleteModalOpen}
        onOk={confirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setCoverToDelete(null);
        }}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除这张配图吗？此操作不可撤销。</p>
      </Modal>
    </>
  );
};

export default CoverSwitcher;
