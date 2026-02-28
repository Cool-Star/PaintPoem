import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Typography, Button, List, Tag, message, Modal, Input, Space, Tooltip } from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  GlobalOutlined,
  PrinterOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { RootState, AppDispatch } from '../store';
import {
  loadFonts,
  uploadFont,
  removeFont,
  setGlobalFont,
  setPrintFont,
} from '../store/fontSlice';
import type { FontData } from '../types/font';
import styles from './FontManager.module.scss';
import { loadFontFace, getFontFamily } from '../utils/fontLoader';

const { Title, Text } = Typography;

// 加载字体文件并注册到浏览器（使用共享工具函数）
const loadFontForPreview = async (font: FontData) => {
  await loadFontFace(font);
};

const FontManager: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { fonts, globalDefaultFontId, printDefaultFontId, loading } = useSelector(
    (state: RootState) => state.font
  );
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [fontName, setFontName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dispatch(loadFonts());
  }, [dispatch]);

  // 加载所有非内置字体
  useEffect(() => {
    fonts.forEach((font) => {
      if (!font.isBuiltin) {
        loadFontForPreview(font);
      }
    });
  }, [fonts]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查文件类型
      const validTypes = ['.ttf', '.otf', '.woff', '.woff2'];
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!validTypes.includes(extension)) {
        message.error('请上传有效的字体文件 (.ttf, .otf, .woff, .woff2)');
        return;
      }
      setSelectedFile(file);
      // 自动提取文件名（不含扩展名）
      if (!fontName) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setFontName(nameWithoutExt);
      }
    }
  };

  const handleUpload = async () => {
    if (!fontName.trim()) {
      message.error('请输入字体名称');
      return;
    }
    if (!selectedFile) {
      message.error('请选择字体文件');
      return;
    }

    try {
      await dispatch(uploadFont({ name: fontName.trim(), file: selectedFile })).unwrap();
      message.success('字体上传成功');
      setUploadModalOpen(false);
      setFontName('');
      setSelectedFile(null);
      dispatch(loadFonts()); // 重新加载字体列表
    } catch (error) {
      console.error(error);
      message.error('字体上传失败');
    }
  };

  const handleDelete = (font: FontData) => {
    if (font.isBuiltin) {
      message.warning('内置字体不能删除');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除字体 "${font.name}" 吗？`,
      onOk: async () => {
        try {
          await dispatch(removeFont(font.id)).unwrap();
          message.success('删除成功');
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSetGlobal = async (fontId: number) => {
    try {
      await dispatch(setGlobalFont(fontId)).unwrap();
      message.success('已设置为全局默认字体');
    } catch (error) {
      message.error('设置失败');
    }
  };

  const handleSetPrint = async (fontId: number) => {
    try {
      await dispatch(setPrintFont(fontId)).unwrap();
      message.success('已设置为打印默认字体');
    } catch (error) {
      message.error('设置失败');
    }
  };

  const renderFontItem = (font: FontData) => {
    const isGlobalDefault = font.id === globalDefaultFontId;
    const isPrintDefault = font.id === printDefaultFontId;

    return (
      <List.Item
        className={styles.fontItem}
        actions={[
          <Tooltip title="设为全局默认">
            <Button
              type={isGlobalDefault ? 'primary' : 'text'}
              icon={<GlobalOutlined />}
              onClick={() => handleSetGlobal(font.id)}
              size="small"
            />
          </Tooltip>,
          <Tooltip title="设为打印默认">
            <Button
              type={isPrintDefault ? 'primary' : 'text'}
              icon={<PrinterOutlined />}
              onClick={() => handleSetPrint(font.id)}
              size="small"
            />
          </Tooltip>,
          !font.isBuiltin && (
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(font)}
                size="small"
              />
            </Tooltip>
          ),
        ].filter(Boolean)}
      >
        <List.Item.Meta
          title={
            <Space>
              <span
                className={styles.fontName}
                style={{
                  fontFamily: getFontFamily(font),
                }}
              >
                {font.isBuiltin ? font.name : '绘诗成帖'}
              </span>
              {font.isBuiltin && <Tag color="gold">内置</Tag>}
              {isGlobalDefault && (
                <Tag icon={<CheckCircleFilled />} color="success">
                  全局默认
                </Tag>
              )}
              {isPrintDefault && (
                <Tag icon={<CheckCircleFilled />} color="blue">
                  打印默认
                </Tag>
              )}
            </Space>
          }
          description={
            <Space size={16} className={styles.fontMeta}>
              <Text type="secondary">格式: {font.format.toUpperCase()}</Text>
              {font.family && <Text type="secondary">原始名称: {font.family}</Text>}
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title}>
          字体管理
        </Title>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => setUploadModalOpen(true)}
        >
          上传字体
        </Button>
      </div>

      <div className={styles.content}>
        <List
          loading={loading}
          dataSource={fonts}
          renderItem={renderFontItem}
          className={styles.fontList}
          locale={{ emptyText: '暂无字体，请上传' }}
        />
      </div>

      {/* 上传弹窗 */}
      <Modal
        title="上传字体"
        open={uploadModalOpen}
        onOk={handleUpload}
        onCancel={() => {
          setUploadModalOpen(false);
          setFontName('');
          setSelectedFile(null);
        }}
        confirmLoading={loading}
      >
        <div className={styles.uploadForm}>
          <div className={styles.formItem}>
            <Text strong>字体名称</Text>
            <Input
              placeholder="请输入字体名称"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
            />
          </div>
          <div className={styles.formItem}>
            <Text strong>字体文件</Text>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".ttf,.otf,.woff,.woff2"
              style={{ display: 'none' }}
            />
            <Button
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
              block
            >
              {selectedFile ? selectedFile.name : '选择字体文件'}
            </Button>
            <Text type="secondary" className={styles.hint}>
              支持格式: TTF, OTF, WOFF, WOFF2
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FontManager;
