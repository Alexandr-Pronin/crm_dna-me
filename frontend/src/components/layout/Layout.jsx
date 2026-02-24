/**
 * DNA ME CRM Layout Wrapper
 * Без верхнего header: логотип, меню и профиль в боковой панели
 */
import { Layout as RALayout } from 'react-admin';
import Menu from './Menu';
import Sidebar from './Sidebar';
import { BeamsBackground } from '../ui/BeamsBackground';
import { RightDrawerProvider } from '../../contexts/RightDrawerContext';
import RightDrawer from '../RightDrawer/RightDrawer';

const EmptyAppBar = () => null;

/**
 * Custom Layout: без AppBar, кастомный Sidebar с логотипом и профилем
 */
const Layout = (props) => {
  return (
    <RightDrawerProvider>
      <div style={{ position: 'fixed', inset: 0, zIndex: -1 }}>
        <BeamsBackground intensity="medium" />
      </div>
      <RALayout
        {...props}
        appBar={EmptyAppBar}
        appBarAlwaysOn
        menu={Menu}
        sidebar={Sidebar}
        sx={{
          backgroundColor: 'rgba(0, 0, 0, 0)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: '100%',

          '& .RaLayout-appFrame': {
            marginTop: '0 !important',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            display: 'flex',
            flex: 1,
            width: '100%',
            minHeight: '100vh',
            overflowX: 'hidden',
          },

          '& .RaLayout-content': {
            backgroundColor: 'rgba(2, 6, 23, 0.4)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            minHeight: '100vh',
            flex: 1,
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflowX: 'hidden',
            '& > div': {
              width: '100%',
              maxWidth: '100%',
              flex: 1,
            },
            '& main': {
              width: '100%',
              maxWidth: '100%',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            },
          },

          '& .RaSidebar-fixed': {
            backgroundColor: 'rgba(10, 14, 35, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRight: '1px solid',
            borderColor: 'rgba(0, 128, 255, 0.2)',
            height: '100vh',
            minHeight: '100vh',
          },
          '& .RaSidebar-root': { height: '100vh' },
          '& .RaSidebar-root .MuiPaper-root': { height: '100vh' },
        }}
      />
      <RightDrawer />
    </RightDrawerProvider>
  );
};

export default Layout;
