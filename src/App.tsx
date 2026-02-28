import { Routes, Route } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainLayout from './components/MainLayout';
import './App.scss';
import Home from './pages/Home';
import Import from './pages/Import';
import Settings from './pages/Settings';
import PoemDetail from './pages/PoemDetail';
import PdfPreview from './pages/PdfPreview';
import FontManager from './pages/FontManager';
import Favorites from './pages/Favorites';
import { ConfigProvider, theme } from 'antd';
import { RootState } from './store';
import { useEffect, useMemo } from 'react';
import { loadFontFace, getFontFamily } from './utils/fontLoader';

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/import" element={<Import />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/poem/:id" element={<PoemDetail />} />
          <Route path="/pdf-preview" element={<PdfPreview />} />
          <Route path="/fonts" element={<FontManager />} />
        </Routes>
      </MainLayout>
    </ConfigProvider>

  );
}

export default App;
