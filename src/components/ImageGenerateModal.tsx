import React, { useEffect } from 'react';
import { Modal, Select, Form } from 'antd';

const { Option } = Select;

export interface ImageGenerateParams {
  size: string;
  style: string;
}

interface ImageGenerateModalProps {
  open: boolean;
  onOk: (params: ImageGenerateParams) => void;
  onCancel: () => void;
  loading?: boolean;
}

const IMAGE_SIZE_OPTIONS = [
  { label: '1:1 (1024x1024)', value: '1024x1024' },
  { label: '1:1 (2048x2048)', value: '2048x2048' },
  { label: '4:3 (2304x1728)', value: '2304x1728' },
  { label: '3:4 (1728x2304)', value: '1728x2304' },
  { label: '16:9 (2560x1440)', value: '2560x1440' },
  { label: '9:16 (1440x2560)', value: '1440x2560' },
  { label: '3:2 (2496x1664)', value: '2496x1664' },
  { label: '2:3 (1664x2496)', value: '1664x2496' },
  { label: '21:9 (3024x1296)', value: '3024x1296' },
];

const IMAGE_STYLE_OPTIONS = [
  { label: '卡通风格', value: 'cartoon' },
  { label: '水墨风', value: 'ink' },
  { label: '油画风', value: 'oil' },
  { label: '写实风', value: 'realistic' }
];

const STORAGE_KEY = 'image_generate_params';

const ImageGenerateModal: React.FC<ImageGenerateModalProps> = ({
  open,
  onOk,
  onCancel,
  loading = false,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      // 从 localStorage 加载上次的选择
      const savedParams = localStorage.getItem(STORAGE_KEY);
      if (savedParams) {
        try {
          const params = JSON.parse(savedParams);
          form.setFieldsValue(params);
        } catch (error) {
          console.error('Failed to parse saved params:', error);
        }
      } else {
        // 设置默认值
        form.setFieldsValue({
          size: '1440x2560',
          style: 'ink',
        });
      }
    }
  }, [open, form]);

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
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          size: '1440x2560',
          style: 'ink',
        }}
      >
        <Form.Item
          label="图像大小"
          name="size"
          rules={[{ required: true, message: '请选择图像大小' }]}
        >
          <Select>
            {IMAGE_SIZE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="画风风格"
          name="style"
          rules={[{ required: true, message: '请选择画风风格' }]}
        >
          <Select>
            {IMAGE_STYLE_OPTIONS.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ImageGenerateModal;
