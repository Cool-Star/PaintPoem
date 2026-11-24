import { Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from './components/MainLayout';
import './App.scss';
import Home from './pages/Home';
import { ConfigProvider, Spin, theme } from 'antd';
import { RootState } from './store';
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { loadFontFace, getFontFamily } from './utils/fontLoader';

const Favorites = lazy(() => import('./pages/Favorites'));
const Import = lazy(() => import('./pages/Import'));
const Settings = lazy(() => import('./pages/Settings'));
const PoemDetail = lazy(() => import('./pages/PoemDetail'));
const PdfPreview = lazy(() => import('./pages/PdfPreview'));
const FontManager = lazy(() => import('./pages/FontManager'));

function App() {
  const { globalDefaultFontId, fonts } = useSelector((state: RootState) => state.font);

  // 获取当前全局字体
  const globalFont = useMemo(() => {
    return fonts.find(f => f.id === globalDefaultFontId);
  }, [globalDefaultFontId, fonts]);

  // 加载并应用全局字体
  useEffect(() => {
    if (globalFont && !globalFont.isBuiltin) {
      loadFontFace(globalFont).then(success => {
        if (success) {
          document.body.style.fontFamily = getFontFamily(globalFont);
        }
      });
    } else {
      document.body.style.fontFamily = "'KaiTi', 'STKaiti', '华文楷体', serif";
    }
  }, [globalFont]);

  // 获取 Ant Design 主题字体
  const themeFontFamily = useMemo(() => {
    return getFontFamily(globalFont);
  }, [globalFont]);

  return (
    <ConfigProvider theme={{
      token: {
        // 主色调 - 温暖米色系（暗色主题）
        colorPrimary: '#D4A574',
        // 全局字体
        fontFamily: themeFontFamily,
        colorBgContainer: 'rgb(29, 29, 29, .5)',

      },
      algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
    }}>
      <MainLayout>
        <Suspense fallback={
          <div className="route-loading" role="status" aria-label="正在加载页面">
            <Spin />
          </div>
        }>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/poem/:id" element={<PoemDetail />} />
            <Route path="/pdf-preview" element={<PdfPreview />} />
            <Route path="/fonts" element={<FontManager />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </ConfigProvider>

  );
}

export default App;
