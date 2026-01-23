/**
 * DNA ME CRM Layout Wrapper
 */
import { Layout as RALayout } from 'react-admin';
import AppBar from './AppBar';
import Menu from './Menu';

/**
 * Custom Layout with DNA ME AppBar and Menu
 */
const Layout = (props) => {
  return (
    <RALayout
      {...props}
      appBar={AppBar}
      menu={Menu}
      sx={{
        // Main layout transparent background
        backgroundColor: 'rgba(0, 0, 0, 0)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
        
        // App frame - proper flex container
        '& .RaLayout-appFrame': {
          marginTop: '56px !important', // Adjusted to prevent header overlap
          backgroundColor: 'rgba(0, 0, 0, 0)',
          display: 'flex',
          flex: 1,
          width: '100%',
          minHeight: 'calc(100vh - 56px)', // Adjust minHeight
          overflowX: 'hidden', // Prevent horizontal scroll
        },
        
        // Main content area styling - proper stretching
        '& .RaLayout-content': {
          backgroundColor: 'rgba(2, 6, 23, 0.7)', // Semi-transparent dark background
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)', // Safari support
          minHeight: 'calc(100vh - 56px)', // Adjust minHeight
          flex: 1,
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflowX: 'hidden', // Prevent horizontal scroll
          
          // Inner containers should also stretch
          '& > div': {
            width: '100%',
            maxWidth: '100%',
            flex: 1,
          },
          
          // Main content wrapper
          '& main': {
            width: '100%',
            maxWidth: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          },
        },
        
        // Sidebar styling
        '& .RaSidebar-fixed': {
          backgroundColor: 'rgba(10, 14, 35, 0.85)', // Semi-transparent sidebar
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)', // Safari support
          borderRight: '1px solid',
          borderColor: 'rgba(0, 128, 255, 0.2)',
          minHeight: '100vh',
        },
      }}
    />
  );
};

export default Layout;
