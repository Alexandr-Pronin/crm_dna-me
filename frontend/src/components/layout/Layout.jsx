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
        // Main content area styling
        '& .RaLayout-content': {
          backgroundColor: 'background.default',
          minHeight: '100vh',
        },
        // Sidebar styling
        '& .RaSidebar-fixed': {
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
        // App frame
        '& .RaLayout-appFrame': {
          marginTop: '0 !important',
        },
      }}
    />
  );
};

export default Layout;
