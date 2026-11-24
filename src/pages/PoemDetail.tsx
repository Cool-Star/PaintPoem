import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, message, Modal, Tooltip, Radio, Select } from 'antd';
import {
  LeftOutlined,
  PictureOutlined,
  DeleteFilled,
  RobotOutlined,
  LoadingOutlined,
  TranslationOutlined,
  BookOutlined,
  ThunderboltOutlined,
  PrinterOutlined,
  DownloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setPrintFont } from '../store/fontSlice';
import { saveActiveCover } from '../store/themeSlice';
import { loadFavorites } from '../store/favoriteSlice';
import { getFontFamily, loadFontFace } from '../utils/fontLoader';
import { getDb, getPoemCovers, addPoemCover, deletePoemCover, setActiveCover as setDbActiveCover, type PoemCover } from '../db';
import type { PoemData } from '../types/poem';
import { translationStyles, type TranslationStyle } from '../services/translationStyles';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { copyFile, mkdir, BaseDirectory, writeFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import ImageGenerateModal, { ImageGenerateParams } from '../components/ImageGenerateModal';
import CoverSwitcher from '../components/CoverSwitcher';
import FavoriteButton from '../components/FavoriteButton';
import styles from './PoemDetail.module.scss';

const { Title, Text, Paragraph } = Typography;
const translationStyleOptions = Object.entries(translationStyles).map(([value, { label }]) => ({ value, label }));

const PoemDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const activePoemRoute = useRef(id);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => state.settings);
  const [poem, setPoem] = useState<PoemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'optimize' | 'translate'>('optimize');
  const [translationStyle, setTranslationStyle] = useState<TranslationStyle>('natural');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'translation'>('original');
  const [showPinyin, setShowPinyin] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printMode, setPrintMode] = useState<'copy' | 'practice'>('copy');
  // 打印时是否显示拼音，从 localStorage 读取默认值
  const [printShowPinyin, setPrintShowPinyin] = useState(() => {
    const saved = localStorage.getItem('printShowPinyin');
    return saved === 'true';
  });
  const [covers, setCovers] = useState<PoemCover[]>([]);
  const [activeCoverId, setActiveCoverId] = useState<number | null>(null);

  const fontState = useSelector((state: RootState) => state.font);
  const fonts = fontState.fonts;
  const printDefaultFontId = fontState.printDefaultFontId;
  const themeState = useSelector((state: RootState) => state.theme);

  useLayoutEffect(() => {
    activePoemRoute.current = id;
    return () => { activePoemRoute.current = undefined; };
  }, [id]);

  useEffect(() => {
    setAiDialogOpen(false);
    setViewMode('original');
  }, [id]);

  // 加载字体用于预览
  useEffect(() => {
    fonts.forEach(font => {
      if (!font.isBuiltin) {
        loadFontFace(font);
      }
    });
  }, [fonts]);

  // 加载收藏列表
  useEffect(() => {
    dispatch(loadFavorites());
  }, [dispatch]);

  // 加载诗词配图
  const loadCovers = async (poemId: number) => {
    try {
      const poemCovers = await getPoemCovers(poemId);
      if (activePoemRoute.current !== id) return;
      setCovers(poemCovers);

      // 找到当前生效的配图
      const activeCover = poemCovers.find(c => c.is_active === 1);

      if (activeCover) {
        setActiveCoverId(activeCover.id);

        if (themeState.activeCoverPoemId !== poemId || themeState.activeCoverId !== activeCover.id) {
          const coverUrl = convertFileSrc(activeCover.cover_path);
          dispatch(saveActiveCover({
            coverUrl,
            poemId,
            coverId: activeCover.id,
            coverPath: activeCover.cover_path
          }));
        }
      } else if (poemCovers.length > 0) {
        // 如果没有生效配图但有配图，默认使用第一个并设为生效
        const firstCover = poemCovers[0];
        setActiveCoverId(firstCover.id);
        await setDbActiveCover(poemId, firstCover.id);

        // 切换到该诗词的配图
        if (themeState.activeCoverPoemId !== poemId) {
          const coverUrl = convertFileSrc(firstCover.cover_path);
          dispatch(saveActiveCover({
            coverUrl,
            poemId,
            coverId: firstCover.id,
            coverPath: firstCover.cover_path
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load covers:', error);
    }
  };

  // 切换配图
  const handleSwitchCover = async (coverId: number) => {
    if (!poem) return;

    try {
      await setDbActiveCover(poem.id, coverId);
      setActiveCoverId(coverId);

      // 更新全局背景并持久化
      const selectedCover = covers.find(c => c.id === coverId);
      if (selectedCover) {
        const coverUrl = convertFileSrc(selectedCover.cover_path);
        dispatch(saveActiveCover({
          coverUrl,
          poemId: poem.id,
          coverId,
          coverPath: selectedCover.cover_path
        }));
      }

      message.success('配图已切换');
    } catch (error) {
      message.error('切换配图失败');
    }
  };

  // 删除配图
  const handleDeleteCover = async (coverId: number) => {
    try {
      await deletePoemCover(coverId);
      await loadCovers(Number(id));

      // 如果删除的是当前全局生效的配图，需要更新全局背景
      if (themeState.activeCoverId === coverId) {
        const remainingCovers = covers.filter(c => c.id !== coverId);
        if (remainingCovers.length > 0) {
          const nextCover = remainingCovers.find(c => c.is_active === 1) || remainingCovers[0];
          const coverUrl = convertFileSrc(nextCover.cover_path);
          dispatch(saveActiveCover({
            coverUrl,
            poemId: Number(id),
            coverId: nextCover.id,
            coverPath: nextCover.cover_path
          }));
        } else {
          dispatch(saveActiveCover({ coverUrl: null, poemId: null, coverId: null, coverPath: null }));
        }
      }
    } catch (error) {
      message.error('删除配图失败');
    }
  };

  useEffect(() => {
    const fetchPoem = async () => {
      try {
        const db = await getDb();
        const results = await db.select<PoemData[]>('SELECT * FROM poems WHERE id = ?', [id]);
        if (results.length > 0) {
          setPoem(results[0]);
          // 加载配图
          await loadCovers(Number(id));
        } else {
          message.error('未找到该诗词');
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to fetch poem:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPoem();
  }, [id, navigate]);

  const handleUploadCover = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }]
      });

      if (!selected) return;

      const dataDir = await appDataDir();
      const coversDir = await join(dataDir, 'covers');

      // Ensure covers directory exists
      try {
        await mkdir('covers', { baseDir: BaseDirectory.AppData, recursive: true });
      } catch (e) {
        // Directory might already exist
      }

      const fileName = `${Date.now()}-${selected.split(/[\\/]/).pop()}`;
      const destPath = await join(coversDir, fileName);

      await copyFile(selected, destPath);

      // 添加到配图列表
      const coverId = await addPoemCover(Number(id), destPath);

      // 自动设为生效配图
      await setDbActiveCover(Number(id), coverId);

      // 刷新配图列表
      await loadCovers(Number(id));

      message.success('封面上传成功');
    } catch (error: any) {
      console.error('Upload failed:', error);
      message.error(`上传失败: ${error.message}`);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要从数据库中删除这首诗词吗？此操作不可撤销。',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const db = await getDb();
          await db.execute('DELETE FROM poems WHERE id = ?', [id]);
          message.success('删除成功');
          navigate('/');
        } catch (error) {
          console.error('Delete failed:', error);
          message.error('删除失败');
        }
      },
    });
  };

  const handleCreateCover = () => {
    if (!poem || generating) return;

    if (!settings.imageModel.trim() || !settings.imageApiKey.trim() || !settings.imageBaseURL.trim()) {
      message.error('请先在设置中配置图像大模型');
      return;
    }

    setModalOpen(true);
  };

  const handleModalOk = async (params: ImageGenerateParams) => {
    if (!poem || generating) return;

    const poemId = poem.id;
    const progressKey = `poem-cover-${poemId}`;
    const textSettings = settings.llmUrl.trim() && settings.llmKey.trim() ? settings : undefined;
    setGenerating(true);
    setModalOpen(false);

    try {
      const { buildPoemImagePrompt, generateImage } = await import('../services/images');
      if (textSettings) {
        message.loading({ key: progressKey, content: '正在撰写配图描述', duration: 0 });
      }
      const { prompt, descriptionError } = await buildPoemImagePrompt(poem, params.style, textSettings);
      if (descriptionError) {
        message.warning(`配图描述生成失败，使用基础描述继续。 ${descriptionError}`);
      }

      message.loading({ key: progressKey, content: '正在生成配图', duration: 0 });
      const coverPath = await generateImage({
        prompt,
        model: settings.imageModel,
        apiKey: settings.imageApiKey,
        baseURL: settings.imageBaseURL,
        size: params.size,
      });

      const coverId = await addPoemCover(poemId, coverPath);
      await setDbActiveCover(poemId, coverId);
      await loadCovers(poemId);
      message.success({ key: progressKey, content: '封面生成成功' });
    } catch (error) {
      message.error({
        key: progressKey,
        content: error instanceof Error ? error.message : '生成封面失败',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleModalCancel = () => {
    setModalOpen(false);
  };

  const handleAiPoem = async () => {
    if (!poem || poem.id !== Number(id) || aiProcessing) return;

    if (!settings.llmUrl.trim() || !settings.llmKey.trim()) {
      message.error('请先配置文本大模型');
      return;
    }

    setAiProcessing(true);
    try {
      const { optimizePoem, saveOptimizedPoem, translatePoem, savePoemTranslation } = await import('../services/ai');
      const llmSettings = {
        llmUrl: settings.llmUrl,
        llmKey: settings.llmKey,
        llmModel: settings.llmModel,
      };

      let updated: Partial<PoemData>;
      if (aiMode === 'translate') {
        const translation = await translatePoem(poem, llmSettings, translationStyle);
        await savePoemTranslation(poem, translation, await getDb());
        updated = { translation };
      } else {
        const result = await optimizePoem(poem, llmSettings, translationStyle);
        updated = await saveOptimizedPoem(poem, result, await getDb());
      }

      if (activePoemRoute.current !== id) return;
      setPoem(current => current?.id === poem.id ? { ...current, ...updated } : current);
      if (aiMode === 'translate') setViewMode('translation');
      setAiDialogOpen(false);
      message.success(aiMode === 'translate' ? 'AI 翻译完成' : 'AI 优化完成');
    } catch (error) {
      if (activePoemRoute.current === id) {
        message.error(error instanceof Error ? error.message : 'AI 处理失败，请重试');
      }
    } finally {
      setAiProcessing(false);
    }
  };

  // 获取诗词内容数组
  const getPoemContent = (): string[] => {
    if (!poem) return [];
    let paragraphs: string[] = [];
    try {
      paragraphs = JSON.parse(poem.paragraphs || '[]');
    } catch {
      paragraphs = poem.paragraphs ? [poem.paragraphs] : [];
    }
    return paragraphs;
  };

  // 获取诗词拼音数组
  const getPoemPinyin = (): string[] => {
    if (!poem) return [];
    let pinyinList: string[] = [];
    try {
      pinyinList = JSON.parse(poem.pinyin || '[]');
    } catch {
      pinyinList = poem.pinyin ? [poem.pinyin] : [];
    }
    return pinyinList;
  };

  // 检查诗词是否有拼音
  const hasPinyin = (): boolean => {
    if (!poem) return false;
    const pinyinList = getPoemPinyin();
    return pinyinList.length > 0 && pinyinList.some(p => p && p.trim() !== '');
  };

  // 获取当前生效的封面图片路径
  const getActiveCoverImage = (): string | undefined => {
    if (!activeCoverId || covers.length === 0) return undefined;
    const activeCover = covers.find(c => c.id === activeCoverId);
    return activeCover ? convertFileSrc(activeCover.cover_path) : undefined;
  };

  // 跳转到预览页面
  const handlePreview = () => {
    if (!poem) return;

    const content = getPoemContent();
    const pinyinList = getPoemPinyin();
    const coverImage = getActiveCoverImage();
    const selectedFont = fonts.find(f => f.id === printDefaultFontId);
    navigate('/pdf-preview', {
      state: {
        title: poem.title || '',
        author: poem.author || '',
        content: content,
        mode: printMode,
        coverImage: coverImage,
        font: selectedFont,
        showPinyin: printShowPinyin,
        pinyin: pinyinList,
      },
    });
  };

  // 直接下载PDF
  const handleDownloadPDF = async () => {
    if (!poem) return;

    try {
      message.loading('正在生成PDF...', 0);

      const { generateCalligraphyPdf } = await import('../services/calligraphyPdf');
      const content = getPoemContent();
      const pinyinList = getPoemPinyin();
      const coverImage = getActiveCoverImage();
      const selectedFont = fonts.find(f => f.id === printDefaultFontId);

      const blob = await generateCalligraphyPdf({
        title: poem.title || '',
        author: poem.author || '',
        content: content,
        mode: printMode,
        coverImage: coverImage,
        font: selectedFont,
        cellSize: 50,
        margin: 40,
        gridVariant: 'mi', // 米字格
        showPinyin: printShowPinyin,
        pinyin: pinyinList,
      });

      // 使用 Tauri 的文件保存对话框
      const fileName = `${poem.title || '字帖'}_${printMode === 'copy' ? '临摹' : '练习'}.pdf`;
      const savePath = await save({
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (savePath) {
        // 将 Blob 转换为 Uint8Array
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // 写入文件
        await writeFile(savePath, uint8Array);

        message.destroy();
        message.success('PDF保存成功');
        setPrintModalOpen(false);

        // 打开文件所在文件夹
        try {
          await revealItemInDir(savePath);
        } catch (err) {
          console.log('打开文件夹失败:', err);
        }
      } else {
        message.destroy();
        message.info('已取消保存');
      }
    } catch (error) {
      console.error('PDF生成失败:', error);
      message.destroy();
      message.error('PDF生成失败，请重试');
    }
  };

  const renderContent = () => {
    if (!poem) return null;

    const hasTranslation = poem.translation && poem.translation.length > 0;

    // 解析段落
    let paragraphs: string[] = [];
    try {
      paragraphs = JSON.parse(poem.paragraphs || '[]');
    } catch {
      paragraphs = poem.paragraphs ? [poem.paragraphs] : [];
    }

    // 如果当前是译文模式且有译文，显示译文
    if (viewMode === 'translation' && hasTranslation) {
      return (
        <div className={styles.translationContent}>
          <Paragraph className={styles.translationText}>
            {poem.translation}
          </Paragraph>
        </div>
      );
    }

    // 默认显示原文
    let pinyinList: string[] = [];
    try {
      pinyinList = JSON.parse(poem.pinyin || '[]');
    } catch {
      pinyinList = [];
    }

    return (
      <div className={styles.paragraphs}>
        {paragraphs.map((p, index) => (
          <div key={index} className={styles.paragraph}>
            {showPinyin && pinyinList[index] && (
              <div className={styles.pinyin}>{pinyinList[index]}</div>
            )}
            <div className={styles.characters}>{p}</div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div>加载中...</div>;
  if (!poem) return null;

  const aiActionLabel = poem.ai_optimized ? '重新优化或翻译诗词' : 'AI 优化或翻译诗词';

  return (
    <div className={styles.container}>

      {/* 顶部操作栏 */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Button
            type="text"
            size="large"
            className={styles.backBtn}
            icon={<LeftOutlined />}
            onClick={() => navigate('/')}
          >
            返回
          </Button>
        </div>

        <Space size="middle" className={styles.headerRight}>
          {/* 显示拼音按钮 - 有拼音时显示 */}
          {poem?.pinyin && (
            <Tooltip title={showPinyin ? '隐藏拼音' : '显示拼音'} placement="bottom">
              <Button
                type={showPinyin ? 'primary' : 'text'}
                size="large"
                className={styles.actionBtn}
                onClick={() => setShowPinyin(!showPinyin)}
              >
                拼音
              </Button>
            </Tooltip>
          )}

          {/* 原文/译文切换 - 有译文时显示 */}
          {poem?.translation && (
            <Tooltip title={viewMode === 'original' ? '切换到译文' : '切换到原文'} placement="bottom">
              <Button
                type="text"
                size="large"
                className={styles.actionBtn}
                onClick={() => setViewMode(viewMode === 'original' ? 'translation' : 'original')}
                icon={viewMode === 'original' ? <TranslationOutlined /> : <BookOutlined />}
              />
            </Tooltip>
          )}

          <Tooltip title={aiActionLabel} placement="bottom">
            <Button
              type="text"
              size="large"
              className={styles.actionBtn}
              aria-label={aiActionLabel}
              onClick={() => setAiDialogOpen(true)}
              disabled={aiProcessing}
              icon={aiProcessing ? <LoadingOutlined /> : <ThunderboltOutlined />}
            />
          </Tooltip>

          <Tooltip title="智能配图" placement="bottom">
            <Button
              type="text"
              size="large"
              className={styles.actionBtn}
              onClick={handleCreateCover}
              disabled={generating}
              icon={generating ? <LoadingOutlined /> : <RobotOutlined />}
            />
          </Tooltip>
          {/* 收藏按钮 */}
          <FavoriteButton poemId={Number(id)} />
          <Tooltip title="打印字帖" placement="bottom">
            <Button
              type="text"
              size="large"
              className={styles.actionBtn}
              icon={<PrinterOutlined />}
              onClick={() => setPrintModalOpen(true)}
            />
          </Tooltip>
          <Tooltip title="更换封面" placement="bottom">
            <Button
              type="text"
              size="large"
              className={styles.actionBtn}
              icon={<PictureOutlined />}
              onClick={handleUploadCover}
            />
          </Tooltip>
          <Tooltip title="删除" placement="bottom">
            <Button
              type="text"
              size="large"
              danger
              className={styles.deleteBtn}
              icon={<DeleteFilled />}
              onClick={handleDelete}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 内容层 */}
      <div className={styles.content}>
        <div className={styles.titleSection}>
          <Title
            level={1}
            className={styles.title}
          >
            {poem.title}
            <Text
              type="secondary"
              className={styles.author}
            >
              {poem.author}
            </Text>
          </Title>
        </div>
        {/* 诗词内容 */}
        {renderContent()}
      </div>

      {/* 配图切换组件 */}
      <CoverSwitcher
        covers={covers}
        activeCoverId={activeCoverId}
        onSwitch={handleSwitchCover}
        onDelete={handleDeleteCover}
        poemId={Number(id)}
      />

      <Modal
        title={aiActionLabel}
        open={aiDialogOpen}
        onOk={handleAiPoem}
        onCancel={() => { if (!aiProcessing) setAiDialogOpen(false); }}
        okText={aiMode === 'translate' ? '生成译文' : '开始优化'}
        cancelText="取消"
        confirmLoading={aiProcessing}
        closable={!aiProcessing}
        keyboard={!aiProcessing}
        cancelButtonProps={{ disabled: aiProcessing }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%', paddingBlock: 8 }}>
          <Radio.Group
            aria-label="处理方式"
            value={aiMode}
            disabled={aiProcessing}
            onChange={event => setAiMode(event.target.value)}
            options={[
              { label: poem.ai_optimized ? '重新优化' : '优化诗词', value: 'optimize' },
              { label: '仅翻译', value: 'translate' },
            ]}
          />
          <Text type="secondary">
            {aiMode === 'translate'
              ? '为当前诗词单独生成译文。'
              : '从原文生成校正版、拼音和译文。'}
          </Text>
          <div>
            <Text strong>译文风格</Text>
            <Select<TranslationStyle>
              aria-label="译文风格"
              value={translationStyle}
              disabled={aiProcessing}
              onChange={setTranslationStyle}
              options={translationStyleOptions}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>

      {/* 图片生成参数选择弹窗 */}
      <ImageGenerateModal
        open={modalOpen}
        model={settings.imageModel}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        loading={generating}
      />

      {/* 打印字帖弹窗 */}
      <Modal
        title="打印字帖"
        open={printModalOpen}
        onCancel={() => setPrintModalOpen(false)}
        footer={null}
        width={480}
      >
        <div style={{ padding: '20px 0' }}>
          <Text strong>选择字帖模式：</Text>
          <Radio.Group
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value)}
            style={{ marginTop: 16, display: 'flex', gap: 16 }}
          >
            <Radio.Button value="copy" style={{ flex: 1, textAlign: 'center' }}>
              临摹模式
            </Radio.Button>
            <Radio.Button value="practice" style={{ flex: 1, textAlign: 'center' }}>
              普通字帖
            </Radio.Button>
          </Radio.Group>
          <div style={{ marginTop: 12, color: '#888', fontSize: 14 }}>
            {printMode === 'copy'
              ? '临摹模式：显示灰色文字，方便描红练习，每行不跟随空白练习行'
              : '练习模式：显示黑色文字，每行后跟随一行空白田字格供练习'}
          </div>

          {fonts.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginTop: 20 }}>选择字体：</Text>
              <Select
                value={printDefaultFontId}
                onChange={(value: number) => {
                  const font = fonts.find(f => f.id === value);
                  if (font) {
                    dispatch(setPrintFont(font.id));
                  }
                }}
                style={{ width: '100%', marginTop: 12 }}
                optionLabelProp="label"
              >
                {fonts.map((font) => (
                  <Select.Option
                    key={font.id}
                    value={font.id}
                    label={font.isBuiltin ? font.name : '绘诗成帖'}
                  >
                    <span style={{ fontFamily: getFontFamily(font) }}>
                      {font.isBuiltin ? font.name : '绘诗成帖'}
                    </span>
                    {font.isBuiltin && <span style={{ color: '#999', marginLeft: 8 }}>(内置)</span>}
                    {!font.isBuiltin && font.family && (
                      <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>({font.family})</span>
                    )}
                  </Select.Option>
                ))}
              </Select>
            </>
          )}

          {/* 拼音选项 - 仅当诗词有拼音时显示 */}
          {hasPinyin() && (
            <div style={{ marginTop: 20 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>拼音设置：</Text>
              <Radio.Group
                value={printShowPinyin}
                onChange={(e) => {
                  const value = e.target.value;
                  setPrintShowPinyin(value);
                  localStorage.setItem('printShowPinyin', String(value));
                }}
                style={{ display: 'flex', gap: 16 }}
              >
                <Radio.Button value={false} style={{ flex: 1, textAlign: 'center' }}>
                  不打印拼音
                </Radio.Button>
                <Radio.Button value={true} style={{ flex: 1, textAlign: 'center' }}>
                  打印拼音
                </Radio.Button>
              </Radio.Group>
              <div style={{ marginTop: 8, color: '#888', fontSize: 14 }}>
                拼音将显示在每个字的上方，仅作为参考，不参与临摹和练习
              </div>
            </div>
          )}

          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <Button
              icon={<EyeOutlined />}
              size="large"
              style={{ flex: 1 }}
              onClick={handlePreview}
            >
              预览
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="large"
              style={{ flex: 1 }}
              onClick={handleDownloadPDF}
            >
              下载
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PoemDetail;
