// pdfkit 浏览器环境 polyfill - 必须在最前面
import { Buffer } from 'buffer';
import process from 'process';

// 设置全局变量
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.process = process;
  (window as any).global = window;
}

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import 'overlayscrollbars/overlayscrollbars.css';
import { store } from './store';
import { initDb, getSettings } from './db';
import { setSettings } from './store/settingsSlice';
import { initializeImportSources } from './store/downloadSlice';
import { loadFonts } from './store/fontSlice';
import App from "./App";

const Main = () => {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initDb();
        // 加载设置到 Redux store
        const settings = await getSettings();
        store.dispatch(setSettings({
          llmUrl: settings.llmUrl || '',
          llmKey: settings.llmKey || '',
          llmModel: settings.llmModel || 'gpt-3.5-turbo',
          imageApiKey: settings.imageApiKey || '',
          imageBaseURL: settings.imageBaseURL || '',
          imageModel: settings.imageModel || 'qwen-image',
        }));
        // 初始化导入sources
        await store.dispatch(initializeImportSources());
        // 初始化字体
        await store.dispatch(loadFonts());
        setDbReady(true);
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };
    init();
  }, []);

  if (!dbReady) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>初始化数据库中...</div>;
  }

  return (
    <React.StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Main />);
