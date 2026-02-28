import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { poemSource } from '../datas/poemSource';
import { getImportedSources, markSourceAsImported, deleteImportedSource } from '../db';
import { importFromSource, importFromSourcesBatch, BatchImportSource, SourceInfo } from '../services/import';

interface TaskItem {
  sourceKey: string;
  sourceName: string;
  url: string;
  groups: string[];
  status: 'pending' | 'downloading' | 'importing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  poemCount?: number; // 已导入的诗词数量
  // 不存储formatter函数，使用时从poemSource动态查找
}

interface DownloadState {
  isLoading: boolean;
  currentTask: {
    sourceName: string;
    url: string;
    current: number;
    total: number;
  } | null;
  tasks: TaskItem[];
  stats: {
    totalSources: number;
    completedSources: number;
    totalPoems: number;
    importedPoems: number;
    failedPoems: number;
  };
}

const initialState: DownloadState = {
  isLoading: false,
  currentTask: null,
  tasks: [],
  stats: {
    totalSources: 0,
    completedSources: 0,
    totalPoems: 0,
    importedPoems: 0,
    failedPoems: 0,
  },
};

// 初始化导入sources - 对比数据库和配置文件
export const initializeImportSources = createAsyncThunk(
  'download/initializeImportSources',
  async () => {
    try {
      // 获取已导入的sources
      const importedSources = await getImportedSources();
      const importedMap = new Map(importedSources.map(s => [s.source_key, s]));

      // 遍历配置生成所有任务
      const tasks: TaskItem[] = [];

      for (const source of poemSource) {
        const urls = Array.isArray(source.urls) ? source.urls : [];
        for (const urlConfig of urls) {
          if (urlConfig && typeof urlConfig === 'object' && 'url' in urlConfig) {
            const sourceKey = `${source.name}|${urlConfig.url}`;
            const importedSource = importedMap.get(sourceKey);
            const isImported = !!importedSource;

            tasks.push({
              sourceKey,
              sourceName: source.name,
              url: urlConfig.url,
              groups: urlConfig.groups,
              status: isImported ? 'completed' : 'pending',
              progress: isImported ? 100 : 0,
              poemCount: importedSource?.poem_count || 0,
              // 不存储formatter，使用时动态查找
            });
          }
        }
      }

      return tasks;
    } catch (error) {
      console.error('Failed to initialize import sources:', error);
      throw error;
    }
  }
);

// 开始单个source导入
export const startImportTask = createAsyncThunk(
  'download/startImportTask',
  async (sourceKey: string, { getState, dispatch }) => {
    const state = getState() as { download: DownloadState };
    const task = state.download.tasks.find(t => t.sourceKey === sourceKey);

    if (!task) {
      throw new Error(`Task not found: ${sourceKey}`);
    }

    // 从poemSource动态查找formatter
    const sourceConfig = poemSource.find(s => s.name === task.sourceName);
    const formatter = sourceConfig?.formatter;

    try {
      // 更新状态为下载中
      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey,
        status: 'downloading',
      }));

      // 执行导入
      const result = await importFromSource(
        { url: task.url, groups: task.groups } as SourceInfo,
        formatter as (data: import('../types/poem').Poem[], source: SourceInfo) => import('../types/poem').Poem[],
        (progress) => {
          // 更新进度
          dispatch(downloadSlice.actions.updateCurrentTask({
            sourceName: task.sourceName,
            url: task.url,
            current: progress.current,
            total: progress.total,
          }));
          dispatch(downloadSlice.actions.updateTaskProgress({
            sourceKey,
            progress: Math.round((progress.current / progress.total) * 100),
          }));
        }
      );

      // 标记为已导入
      await markSourceAsImported(
        sourceKey,
        task.sourceName,
        task.url,
        result.imported,
        'completed'
      );

      // 更新状态
      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey,
        status: 'completed',
      }));

      return { sourceKey, result };
    } catch (error: any) {
      // 标记为失败
      await markSourceAsImported(
        sourceKey,
        task.sourceName,
        task.url,
        0,
        'failed'
      );

      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey,
        status: 'failed',
        error: error.message,
      }));

      throw error;
    }
    // 注意：不再在finally中清除currentTask，由批量导入逻辑统一管理
  }
);

// 批量导入所有未导入的sources（使用并发优化）
export const startBatchImport = createAsyncThunk(
  'download/startBatchImport',
  async (_, { getState, dispatch }) => {
    const state = getState() as { download: DownloadState };
    const pendingTasks = state.download.tasks.filter(
      t => t.status === 'pending' || t.status === 'failed'
    );

    if (pendingTasks.length === 0) {
      console.log('没有待导入的数据源');
      return [];
    }

    console.log(`🚀 开始批量导入 ${pendingTasks.length} 个数据源，每批并发下载5个...`);

    // 更新所有任务状态为下载中
    for (const task of pendingTasks) {
      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey: task.sourceKey,
        status: 'downloading',
      }));
    }

    // 准备批量导入源数据
    const batchSources: BatchImportSource[] = pendingTasks.map(task => ({
      url: task.url,
      groups: task.groups,
      sourceKey: task.sourceKey,
      sourceName: task.sourceName,
    }));

    try {
      // 使用并发批量导入
      const result = await importFromSourcesBatch(batchSources, {
        concurrentDownloads: 5,
        onProgress: (progress) => {
          // 更新全局进度
          dispatch(downloadSlice.actions.updateCurrentTask({
            sourceName: progress.currentSourceName,
            url: `批次 ${progress.currentBatch}/${progress.totalBatches}`,
            current: progress.currentDownload,
            total: progress.totalDownload,
          }));
        },
        onBatchComplete: (_batchIndex, _results, sourceResults) => {
          // 更新已完成任务的状态
          for (const sourceResult of sourceResults) {
            dispatch(downloadSlice.actions.updateTaskStatus({
              sourceKey: sourceResult.sourceKey,
              status: sourceResult.success ? 'completed' : 'failed',
              poemCount: sourceResult.poemCount,
            }));

            // 标记为已导入，传入实际的诗词数量
            markSourceAsImported(
              sourceResult.sourceKey,
              sourceResult.sourceName,
              sourceResult.url,
              sourceResult.poemCount,
              sourceResult.success ? 'completed' : 'failed'
            );
          }
        },
      });

      console.log(`✅ 批量导入完成: 共 ${result.total} 首, 成功 ${result.imported} 首`);

      // 批量导入完成后清除进度显示
      dispatch(downloadSlice.actions.clearCurrentTask());

      return result;
    } catch (error) {
      console.error('批量导入失败:', error);

      // 标记所有未完成的任务为失败
      for (const task of pendingTasks) {
        dispatch(downloadSlice.actions.updateTaskStatus({
          sourceKey: task.sourceKey,
          status: 'failed',
          error: '批量导入失败',
        }));
      }

      dispatch(downloadSlice.actions.clearCurrentTask());
      throw error;
    }
  }
);

// 按数据源批量导入（并发下载优化版）
export const startSourceBatchImport = createAsyncThunk(
  'download/startSourceBatchImport',
  async (sourceName: string, { getState, dispatch }) => {
    const state = getState() as { download: DownloadState };
    const tasksToImport = state.download.tasks.filter(
      t => t.sourceName === sourceName && (t.status === 'pending' || t.status === 'failed')
    );

    if (tasksToImport.length === 0) {
      console.log(`${sourceName} 没有待导入的文件`);
      return [];
    }

    console.log(`🚀 开始导入 ${sourceName}，共 ${tasksToImport.length} 个文件，每批并发下载5个...`);

    // 更新所有任务状态为下载中
    for (const task of tasksToImport) {
      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey: task.sourceKey,
        status: 'downloading',
      }));
    }

    // 准备批量导入源数据
    const batchSources: BatchImportSource[] = tasksToImport.map(task => ({
      url: task.url,
      groups: task.groups,
      sourceKey: task.sourceKey,
      sourceName: task.sourceName,
    }));

    // 从poemSource动态查找formatter
    const sourceConfig = poemSource.find(s => s.name === sourceName);
    const formatter = sourceConfig?.formatter;

    try {
      // 使用并发批量导入
      const result = await importFromSourcesBatch(batchSources, {
        concurrentDownloads: 5, // 每批并发下载5个URL
        customFormatter: formatter as (data: import('../types/poem').Poem[], source: SourceInfo) => import('../types/poem').Poem[],
        onProgress: (progress) => {
          // 更新全局进度
          dispatch(downloadSlice.actions.updateCurrentTask({
            sourceName: progress.currentSourceName,
            url: `批次 ${progress.currentBatch}/${progress.totalBatches}`,
            current: progress.currentDownload,
            total: progress.totalDownload,
          }));
        },
        onBatchComplete: (_batchIndex, _results, sourceResults) => {
          // 更新已完成任务的状态
          for (const sourceResult of sourceResults) {
            dispatch(downloadSlice.actions.updateTaskStatus({
              sourceKey: sourceResult.sourceKey,
              status: sourceResult.success ? 'completed' : 'failed',
              poemCount: sourceResult.poemCount,
            }));

            // 标记为已导入，传入实际的诗词数量
            markSourceAsImported(
              sourceResult.sourceKey,
              sourceResult.sourceName,
              sourceResult.url,
              sourceResult.poemCount,
              sourceResult.success ? 'completed' : 'failed'
            );
          }
        },
      });

      console.log(`✅ ${sourceName} 导入完成: 共 ${result.total} 首, 成功 ${result.imported} 首`);

      // 清除进度显示
      dispatch(downloadSlice.actions.clearCurrentTask());

      return [result];
    } catch (error) {
      console.error(`❌ ${sourceName} 导入失败:`, error);

      // 标记失败
      for (const task of tasksToImport) {
        dispatch(downloadSlice.actions.updateTaskStatus({
          sourceKey: task.sourceKey,
          status: 'failed',
        }));

        markSourceAsImported(
          task.sourceKey,
          task.sourceName,
          task.url,
          0,
          'failed'
        );
      }

      dispatch(downloadSlice.actions.clearCurrentTask());
      throw error;
    }
  }
);

// 重新导入source (清除记录后重新导入)
export const reimportSource = createAsyncThunk(
  'download/reimportSource',
  async (sourceKey: string, { dispatch }) => {
    try {
      // 删除导入记录
      await deleteImportedSource(sourceKey);

      // 重置任务状态
      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey,
        status: 'pending',
      }));

      // 开始导入
      return await dispatch(startImportTask(sourceKey)).unwrap();
    } catch (error) {
      console.error('Reimport failed:', error);
      throw error;
    }
  }
);

// 按数据源重新导入
export const reimportSourceBatch = createAsyncThunk(
  'download/reimportSourceBatch',
  async (sourceName: string, { getState, dispatch }) => {
    const state = getState() as { download: DownloadState };
    const tasksToReimport = state.download.tasks.filter(
      t => t.sourceName === sourceName
    );

    console.log(`开始重新导入 ${sourceName}，共 ${tasksToReimport.length} 个文件`);

    // 先删除所有记录
    for (const task of tasksToReimport) {
      await deleteImportedSource(task.sourceKey);
      dispatch(downloadSlice.actions.updateTaskStatus({
        sourceKey: task.sourceKey,
        status: 'pending',
      }));
    }

    // 然后导入
    const results = [];
    for (const task of tasksToReimport) {
      try {
        const result = await dispatch(startImportTask(task.sourceKey)).unwrap();
        results.push(result);
      } catch (error) {
        console.error(`重新导入失败 ${task.sourceKey}:`, error);
      }
    }

    // 导入完成后清除进度显示
    dispatch(downloadSlice.actions.clearCurrentTask());

    console.log(`${sourceName} 重新导入完成，成功 ${results.length}/${tasksToReimport.length}`);
    return results;
  }
);

export const downloadSlice = createSlice({
  name: 'download',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    updateCurrentTask: (
      state,
      action: PayloadAction<{ sourceName: string; url: string; current: number; total: number }>
    ) => {
      state.currentTask = action.payload;
    },
    clearCurrentTask: (state) => {
      state.currentTask = null;
    },
    updateTaskProgress: (
      state,
      action: PayloadAction<{ sourceKey: string; progress: number }>
    ) => {
      const task = state.tasks.find(t => t.sourceKey === action.payload.sourceKey);
      if (task) {
        task.progress = action.payload.progress;
      }
    },
    updateTaskStatus: (
      state,
      action: PayloadAction<{
        sourceKey: string;
        status: 'pending' | 'downloading' | 'importing' | 'completed' | 'failed';
        error?: string;
        poemCount?: number;
      }>
    ) => {
      const task = state.tasks.find(t => t.sourceKey === action.payload.sourceKey);
      if (task) {
        const oldStatus = task.status;
        task.status = action.payload.status;
        if (action.payload.error) {
          task.error = action.payload.error;
        }

        // 更新 poemCount
        if (action.payload.poemCount !== undefined) {
          task.poemCount = action.payload.poemCount;
        }

        // 实时更新 stats
        if (action.payload.status === 'completed' && oldStatus !== 'completed') {
          state.stats.completedSources += 1;
          state.stats.importedPoems += action.payload.poemCount || 0;
        } else if (oldStatus === 'completed' && action.payload.status !== 'completed') {
          state.stats.completedSources -= 1;
          state.stats.importedPoems -= task.poemCount || 0;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // initializeImportSources
      .addCase(initializeImportSources.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeImportSources.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload;
        state.stats.totalSources = action.payload.length;
        state.stats.completedSources = action.payload.filter((t: TaskItem) => t.status === 'completed').length;
        // 从已完成的任务中计算已导入的诗词数量
        state.stats.importedPoems = action.payload
          .filter((t: TaskItem) => t.status === 'completed')
          .reduce((sum: number, t: TaskItem) => sum + (t.poemCount || 0), 0);
      })
      .addCase(initializeImportSources.rejected, (state) => {
        state.isLoading = false;
      })
      // startImportTask
      .addCase(startImportTask.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(startImportTask.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats.completedSources += 1;
        state.stats.importedPoems += action.payload.result.imported;
        state.stats.failedPoems += action.payload.result.failed;

        // 在控制台输出成功信息
        console.log(`✅ 导入完成: ${action.payload.sourceKey}`);
        console.log(`   成功: ${action.payload.result.imported} 首`);
        console.log(`   重复: ${action.payload.result.duplicate} 首`);
        console.log(`   失败: ${action.payload.result.failed} 首`);
      })
      .addCase(startImportTask.rejected, (state) => {
        state.isLoading = false;
      })
      // startBatchImport
      .addCase(startBatchImport.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(startBatchImport.fulfilled, (state, action) => {
        state.isLoading = false;
        // 更新统计信息
        const result = action.payload as { total: number; imported: number; failed: number };
        state.stats.completedSources = state.tasks.filter(t => t.status === 'completed').length;
        state.stats.importedPoems += result.imported;
        state.stats.failedPoems += result.failed;
      })
      .addCase(startBatchImport.rejected, (state) => {
        state.isLoading = false;
      })
      // startSourceBatchImport
      .addCase(startSourceBatchImport.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(startSourceBatchImport.fulfilled, (state, action) => {
        state.isLoading = false;
        // 更新统计信息
        const results = action.payload as { total: number; imported: number; failed: number }[];
        const totalImported = results.reduce((sum, r) => sum + r.imported, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
        state.stats.completedSources = state.tasks.filter(t => t.status === 'completed').length;
        state.stats.importedPoems += totalImported;
        state.stats.failedPoems += totalFailed;
      })
      .addCase(startSourceBatchImport.rejected, (state) => {
        state.isLoading = false;
      })
      // reimportSourceBatch
      .addCase(reimportSourceBatch.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(reimportSourceBatch.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(reimportSourceBatch.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const { setLoading, updateCurrentTask, clearCurrentTask, updateTaskProgress, updateTaskStatus } = downloadSlice.actions;
export default downloadSlice.reducer;
