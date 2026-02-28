import { Button, Typography } from 'antd';
import {
  CloudDownloadOutlined,
  SyncOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { startBatchImport, startSourceBatchImport, reimportSourceBatch } from '../store/downloadSlice';
import { poemSource } from '../datas/poemSource';
import styles from './Import.module.scss';
import { message } from 'antd';

const { Title, Text } = Typography;

const Import: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const downloadState = useSelector((state: RootState) => state.download);

  // 在线导入处理函数 - 按数据源批量导入
  const handleOnlineImport = async (sourceName: string) => {
    const tasksToImport = downloadState.tasks.filter(
      t => t.sourceName === sourceName && (t.status === 'pending' || t.status === 'failed')
    );

    if (tasksToImport.length === 0) {
      message.warning('没有待导入的文件');
      return;
    }

    // 只显示一次提示
    message.info(`开始导入 ${sourceName}（${tasksToImport.length} 个文件）`);

    // 使用批量导入
    dispatch(startSourceBatchImport(sourceName));
  };

  const handleBatchImport = async () => {
    const pendingCount = downloadState.tasks.filter(
      t => t.status === 'pending' || t.status === 'failed'
    ).length;

    if (pendingCount === 0) {
      message.warning('没有待导入的数据源');
      return;
    }

    message.info(`开始批量导入（${pendingCount} 个文件）`);
    dispatch(startBatchImport());
  };

  const handleReimport = async (sourceName: string) => {
    const tasksToReimport = downloadState.tasks.filter(
      t => t.sourceName === sourceName
    );

    if (tasksToReimport.length === 0) {
      return;
    }

    message.info(`开始重新导入 ${sourceName}（${tasksToReimport.length} 个文件）`);

    // 使用批量重新导入
    dispatch(reimportSourceBatch(sourceName));
  };

  // 按分组整理sources
  const groupedSources = poemSource.map(source => ({
    name: source.name,
    urlCount: Array.isArray(source.urls) ? source.urls.length : 0,
    tasks: downloadState.tasks.filter(t => t.sourceName === source.name),
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <CloudDownloadOutlined className={styles.headerIcon} />
          <div>
            <Title level={2} className={styles.title}>在线数据源导入</Title>
            <Text className={styles.subtitle}>
              从 GitHub 仓库自动下载并导入诗词数据
            </Text>
          </div>
        </div>
      </div>
      {/* 全局进度 */}
      {downloadState.isLoading && downloadState.currentTask && (
        <div className={styles.globalProgress}>
          <div className={styles.progressTitle}>
            正在导入: {downloadState.currentTask.sourceName} - {downloadState.currentTask.url}
          </div>
          <div className={styles.progressStats}>
            <span>当前进度: {downloadState.currentTask.current} / {downloadState.currentTask.total}</span>
            <span>已完成: {downloadState.stats.completedSources} / {downloadState.stats.totalSources}</span>
            <span>成功导入: {downloadState.stats.importedPoems} 首</span>
          </div>
        </div>
      )}
      {/* 批量操作按钮 */}
      {
        !downloadState.isLoading && <div className={styles.batchActions}>
          <Button
            type="primary"
            size="large"
            icon={<CloudDownloadOutlined />}
            onClick={handleBatchImport}
            loading={downloadState.isLoading}
            disabled={downloadState.tasks.every(t => t.status === 'completed')}
          >
            批量导入所有未导入数据源
          </Button>
        </div>
      }
      <div className={styles.content}>
        {/* 在线导入区域 */}
        <div className={styles.onlineImportSection}>
          <div className={styles.sectionTitle}>
            <CloudDownloadOutlined className={styles.titleIcon} />
            <span>在线数据源导入</span>
          </div>

          <div className={styles.sourceList}>
            {groupedSources.map((group) => {
              const allCompleted = group.tasks.every(t => t.status === 'completed');
              const anyDownloading = group.tasks.some(t => t.status === 'downloading' || t.status === 'importing');
              const completedCount = group.tasks.filter(t => t.status === 'completed').length;

              return (
                <div key={group.name} className={styles.sourceItem}>
                  <div className={styles.sourceHeader}>
                    <div className={styles.sourceInfo}>
                      <div className={styles.sourceName}>
                        <DatabaseOutlined style={{ marginRight: 8 }} />
                        {group.name}
                      </div>
                      <div className={styles.sourceDetails}>
                        {group.urlCount} 个文件 · {completedCount} / {group.urlCount} 已导入
                      </div>
                    </div>
                    <div className={styles.sourceActions}>
                      <span className={`${styles.statusBadge} ${styles[allCompleted ? 'completed' : anyDownloading ? 'downloading' : 'pending']}`}>
                        {allCompleted ? '已完成' : anyDownloading ? '导入中' : '待导入'}
                      </span>
                      {allCompleted ? (
                        <Button
                          size="small"
                          icon={<SyncOutlined />}
                          onClick={() => handleReimport(group.name)}
                          disabled={downloadState.isLoading}
                        >
                          重新导入
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          size="small"
                          icon={<CloudDownloadOutlined />}
                          onClick={() => handleOnlineImport(group.name)}
                          loading={anyDownloading}
                          disabled={downloadState.isLoading}
                        >
                          导入
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>




        </div>
      </div>
    </div>
  );
};

export default Import;
