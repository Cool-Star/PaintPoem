import React, { useEffect } from 'react';
import { Layout, Menu, Badge } from 'antd';
import {
  SearchOutlined,
  ImportOutlined,
  SettingOutlined,
  FontSizeOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './MainLayout.module.scss';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { loadGlobalBackground } from '../store/themeSlice';

const { Sider, Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const themeStore = useSelector((state: RootState) => state.theme);
  const downloadState = useSelector((state: RootState) => state.download);
  const dispatch = useDispatch<AppDispatch>();
  const { backgroundUrl } = themeStore;
  const bodyStyle = backgroundUrl
    ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center top' }
    : {};
  const navigate = useNavigate();
  const location = useLocation();

  // 应用启动时加载持久化的全局背景图
  useEffect(() => {
    dispatch(loadGlobalBackground());
  }, [dispatch]);

  // 计算导入中的任务数
  const runningTasksCount = downloadState.tasks.filter(
    t => t.status === 'downloading' || t.status === 'importing'
  ).length;

  const menuItems = [
    {
      key: '/',
      label: <SearchOutlined />,
    },
    {
      key: '/favorites',
      label: <StarOutlined />,
    },
    {
      key: '/import',
      label: (
        <Badge count={runningTasksCount} size="small" offset={[5, -5]}>
          <ImportOutlined />
        </Badge>
      ),
    },
  ];

  return (
    <Layout className={styles.layout}>
      <div className={styles.background} style={bodyStyle} />
      <Sider theme="light" width="40px" className={styles.sider}>
        <div className={styles.sideContent}>
          <div className={styles.menu}>
            <Menu
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ borderRight: 'none' }}
            />
          </div>
          <div className={styles.bottomActions}>
            <Menu
              selectedKeys={[]}
              style={{ borderRight: 'none' }}
            >
              <Menu.Item key="fonts" onClick={() => navigate('/fonts')} title="字体管理">
                <FontSizeOutlined />
              </Menu.Item>
              <Menu.Item key="settings" onClick={() => navigate('/settings')} title="设置">
                <SettingOutlined />
              </Menu.Item>
            </Menu>
          </div>
        </div>
      </Sider>
      <Layout className={styles.mainLayout}>
        <Content className={styles.content}>
          {children}
        </Content>
      </Layout>
    </Layout >
  );
};

export default MainLayout;
