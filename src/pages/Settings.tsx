import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Space, Modal, message, Select } from 'antd';
import { SaveOutlined, DeleteOutlined, ExclamationCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { setSettings } from '../store/settingsSlice';
import { initializeImportSources } from '../store/downloadSlice';
import { loadFonts, setGlobalFont, setPrintFont } from '../store/fontSlice';
import { getSettings, saveSettings, deleteAllPoems } from '../db';
import { loadFontFace, getFontFamily } from '../utils/fontLoader';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { appDataDir, join } from '@tauri-apps/api/path';
import styles from './Settings.module.scss';

const { confirm } = Modal;

const Settings: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => state.settings);
  const { fonts, globalDefaultFontId, printDefaultFontId } = useSelector((state: RootState) => state.font);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    dispatch(loadFonts()); // 加载字体列表
  }, []);

  // 加载字体用于预览
  useEffect(() => {
    fonts.forEach(font => {
      if (!font.isBuiltin) {
        loadFontFace(font);
      }
    });
  }, [fonts]);

  const loadSettings = async () => {
    try {
      const dbSettings = await getSettings();
      const settingsData = {
        llmUrl: dbSettings.llmUrl || '',
        llmKey: dbSettings.llmKey || '',
        llmModel: dbSettings.llmModel || '',
        imageModel: dbSettings.imageModel || '',
        imageApiKey: dbSettings.imageApiKey || '',
        imageBaseURL: dbSettings.imageBaseURL || '',
      };
      dispatch(setSettings(settingsData));
      form.setFieldsValue(settingsData);
    } catch (error) {
      console.error('Failed to load settings:', error);
      message.error('加载设置失败');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await saveSettings(values);
      dispatch(setSettings(values));

      message.success('设置已保存');
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error('保存设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllPoems = () => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除所有诗词数据吗?此操作不可恢复!',
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setDeleteLoading(true);
          // 删除所有诗词数据和导入记录
          await deleteAllPoems();
          // 重新初始化导入状态，所有source变为未导入
          await dispatch(initializeImportSources());
          message.success('所有诗词数据和导入记录已清空，可重新导入');
        } catch (error) {
          console.error('Failed to delete poems:', error);
          message.error('删除失败');
        } finally {
          setDeleteLoading(false);
        }
      },
    });
  };

  // 打开字体文件夹
  const handleOpenFontsDir = async () => {
    try {
      const appData = await appDataDir();
      const fontsDir = await join(appData, 'fonts');
      await revealItemInDir(fontsDir);
    } catch (error) {
      console.error('打开字体文件夹失败:', error);
      message.error('打开字体文件夹失败');
    }
  };

  // 打开图片文件夹
  const handleOpenImagesDir = async () => {
    try {
      const appData = await appDataDir();
      const imagesDir = await join(appData, 'images');
      await revealItemInDir(imagesDir);
    } catch (error) {
      console.error('打开图片文件夹失败:', error);
      message.error('打开图片文件夹失败');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>设置</h2>
      </div>

      <div className={styles.content}>
        <Form
          form={form}
          layout="vertical"
          initialValues={settings}
          className={styles.form}
        >
          <Card title="文本大模型配置" className={styles.card}>
            <Form.Item
              label="Base URL"
              name="llmUrl"
              rules={[{ type: 'url', message: '请输入有效的 URL' }]}
            >
              <Input placeholder="例如: https://api.openai.com/v1" />
            </Form.Item>

            <Form.Item
              label="模型名称"
              name="llmModel"
            >
              <Input placeholder="例如: gpt-3.5-turbo" />
            </Form.Item>

            <Form.Item
              label="API Key"
              name="llmKey"
            >
              <Input.Password placeholder="请输入 API Key" />
            </Form.Item>
          </Card>

          <Card title="图像生成配置" className={styles.card}>
            <Form.Item
              label="Base URL"
              name="imageBaseURL"
              rules={[
                { required: true, message: '请输入 Base URL' },
                { type: 'url', message: '请输入有效的 URL' }
              ]}
            >
              <Input placeholder="例如: https://qianfan.baidubce.com/v2" />
            </Form.Item>
            <Form.Item
              label="模型名称"
              name="imageModel"
              rules={[{ required: true, message: '请输入模型名称' }]}
            >
              <Input placeholder="例如: qfan-image" />
            </Form.Item>

            <Form.Item
              label="API Key"
              name="imageApiKey"
              rules={[{ required: true, message: '请输入 API Key' }]}
            >
              <Input.Password placeholder="请输入 API Key" />
            </Form.Item>


          </Card>

          <Card title="字体设置" className={styles.card}>
            <Form.Item
              label="全局默认字体"
              help="应用全局使用的字体"
            >
              <Select
                value={globalDefaultFontId}
                onChange={(value) => dispatch(setGlobalFont(value))}
                style={{ width: '100%' }}
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
                      <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>({font.family})</span>
                    )}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="打印默认字体"
              help="生成字帖PDF时默认使用的字体"
            >
              <Select
                value={printDefaultFontId}
                onChange={(value) => dispatch(setPrintFont(value))}
                style={{ width: '100%' }}
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
                      <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>({font.family})</span>
                    )}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Card>

          <Card title="系统资源" className={styles.card}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className={styles.resourceItem}>
                <div>
                  <h4>字体文件夹</h4>
                  <p>查看和管理已上传的字体文件</p>
                </div>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenFontsDir}
                >
                  打开文件夹
                </Button>
              </div>
              <div className={styles.resourceItem}>
                <div>
                  <h4>图片文件夹</h4>
                  <p>查看和管理诗词配图文件</p>
                </div>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenImagesDir}
                >
                  打开文件夹
                </Button>
              </div>
            </Space>
          </Card>

          <Card title="数据管理" className={styles.card}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className={styles.dangerZone}>
                <div>
                  <h4>删除所有诗词</h4>
                  <p>将永久删除所有已导入的诗词数据,此操作不可恢复</p>
                </div>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteAllPoems}
                  loading={deleteLoading}
                >
                  删除所有数据
                </Button>
              </div>
            </Space>
          </Card>
        </Form>
      </div>

      <div className={styles.footer}>
        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={loading}
        >
          保存设置
        </Button>
      </div>
    </div>
  );
};

export default Settings;
