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
      <div className={styles.header}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate(-1)}
          size="large"
          type="text"
          title="返回"
        />
        <div className={styles.title}>字帖预览</div>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          disabled={!pdfUrl}
          size="large"
          title="下载PDF"
        />
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>
            <Spin size="large" />
            <Text style={{ color: '#D4A574', fontSize: 16 }}>正在生成字帖PDF...</Text>
            <Text style={{ color: 'rgba(212, 165, 116, 0.5)', fontSize: 14 }}>请稍候</Text>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className={styles.iframe}
            title="PDF预览"
          />
        ) : (
          <div className={styles.error}>
            <Text style={{ color: 'rgba(212, 165, 116, 0.6)' }}>PDF加载失败</Text>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfPreview;
