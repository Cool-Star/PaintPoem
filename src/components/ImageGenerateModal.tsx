import React, { useEffect } from 'react';
import { Modal, Select, Form } from 'antd';
import { getImageSizeOptions, resolveImageSize, type ImageStyle } from '../services/imageOptions';

export interface ImageGenerateParams {
  size: string;
  style: ImageStyle;
}

interface ImageGenerateModalProps {
  open: boolean;
  onOk: (params: ImageGenerateParams) => void;
  onCancel: () => void;
  model: string;
  loading?: boolean;
}

const IMAGE_STYLE_OPTIONS = [
  { label: '古典风格', value: 'classic' },
  { label: '卡通风格', value: 'cartoon' },
];

const STORAGE_KEY = 'image_generate_params';

const ImageGenerateModal: React.FC<ImageGenerateModalProps> = ({
  open,
  onOk,
  onCancel,
  model,
  loading = false,
}) => {
  const [form] = Form.useForm<ImageGenerateParams>();

  useEffect(() => {
    if (!open) return;
    let saved: Partial<ImageGenerateParams> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      // 无法读取旧的图像参数时使用当前模型的默认值。
    }
    form.setFieldsValue({
      size: resolveImageSize(model, saved?.size),
      style: saved?.style === 'cartoon' ? 'cartoon' : 'classic',
    });
  }, [open, form, model]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // 保存到 localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      onOk(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  return (
    <Modal
      title="图片生成参数"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="生成"
      cancelText="取消"
      confirmLoading={loading}
      forceRender
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          size: resolveImageSize(model),
          style: 'classic',
        }}
      >
        <Form.Item
          label="图像大小"
          name="size"
          rules={[{ required: true, message: '请选择图像大小' }]}
        >
          <Select options={getImageSizeOptions(model)} />
        </Form.Item>

        <Form.Item
          label="画风"
          name="style"
          rules={[{ required: true, message: '请选择画风' }]}
        >
          <Select options={IMAGE_STYLE_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ImageGenerateModal;
