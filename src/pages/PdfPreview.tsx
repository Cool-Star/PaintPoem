import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Spin, message, Typography } from 'antd';
import { LeftOutlined, DownloadOutlined } from '@ant-design/icons';
import type { GenerateCalligraphyPdfOptions } from '../services/calligraphyPdf';
import styles from './PdfPreview.module.scss';

const { Text } = Typography;

const PdfPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const params = location.state as GenerateCalligraphyPdfOptions | null;

  useEffect(() => {
    if (!params) {
      message.error('缺少预览参数');
      navigate(-1);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setPdfUrl(null);

    const generatePdf = async () => {
      try {
        const { generateCalligraphyPdf } = await import('../services/calligraphyPdf');
        if (!active) return;

        const blob = await generateCalligraphyPdf({
          ...params,
          cellSize: 50,
          margin: 40,
          gridVariant: 'mi',
        });
        if (!active) return;

        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (error) {
        if (!active) return;

        console.error('PDF生成失败:', error);
        message.error('PDF生成失败');
        navigate(-1);
      } finally {
        if (active) setLoading(false);
      }
    };
    void generatePdf();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [navigate, params]);

  const handleDownload = () => {
    if (!pdfUrl || !params) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${params.title || '字帖'}_${params.mode === 'copy' ? '临摹' : '练习'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('下载成功');
  };

  return (
    <div className={styles.container}>
      <header className={styles.toolbar}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate(-1)}
          size="small"
          type="text"
          aria-label="返回"
          title="返回"
        />
        <span className={styles.title}>
          {params?.title ? `${params.title} · 字帖预览` : '字帖预览'}
        </span>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          disabled={!pdfUrl}
          size="small"
        >
          下载 PDF
        </Button>
      </header>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <Spin />
            <Text>正在生成字帖 PDF</Text>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className={styles.iframe}
            title="PDF预览"
          />
        ) : (
          <Text type="secondary">PDF 加载失败</Text>
        )}
      </div>
    </div>
  );
};

export default PdfPreview;
