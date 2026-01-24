/**
 * DNA ME CRM Admin Dashboard
 * 
 * Main Application Entry Point
 * 
 * CRITICAL DEV MODE:
 * - No authentication required
 * - API Key hardcoded in dataProvider
 * - User assumed as Admin
 * 
 * HYBRID API STRATEGY:
 * - REAL API: Leads, Deals, Tasks, Events
 * - MOCK DATA: Reports, Settings, Automations
 */
import { Admin, Resource, CustomRoutes } from 'react-admin';
import { Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';

// Providers
import dataProvider from './providers/dataProvider';
import authProvider from './providers/authProvider';

// Theme
import theme from './theme';

// Layout
import { Layout } from './components/layout';

// Dashboard
import Dashboard from './components/Dashboard';

// Resources - REAL API
import { LeadList, LeadShow, LeadEdit, LeadCreate } from './resources/leads';
import { DealList, DealCreate, DealEdit } from './resources/deals';
import { TaskList } from './resources/tasks';
import { OrganizationList, OrganizationCreate, OrganizationEdit } from './resources/organizations';
import { PipelineList, PipelineShow } from './resources/pipelines';

// Pages - MOCK DATA
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';

// Pages - REAL API
import LeadScoringPage from './pages/LeadScoring';
import { PipelineSettings } from './pages/Pipelines';

// Pages - Email Marketing
import EmailMarketingPage from './pages/EmailMarketing';
import SequenceBuilder from './pages/EmailMarketing/SequenceBuilder';

/**
 * Main Application
 */
const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', minHeight: '100vh' }}>
        <Admin
        dataProvider={dataProvider}
        authProvider={authProvider}
        layout={Layout}
        dashboard={Dashboard}
        theme={theme}
        darkTheme={theme}
        defaultTheme="dark"
        disableTelemetry
      >
        {/* ============================================== */}
        {/* REAL API Resources                            */}
        {/* ============================================== */}
        
        {/* Leads - Full CRUD with real API */}
        <Resource
          name="leads"
          list={LeadList}
          show={LeadShow}
          edit={LeadEdit}
          create={LeadCreate}
          options={{ label: 'Leads' }}
        />

        {/* Deals - Real API with Kanban Board (Drag & Drop) */}
        <Resource
          name="deals"
          list={DealList}
          create={DealCreate}
          edit={DealEdit}
          options={{ label: 'Deals' }}
        />

        {/* Tasks - Real API */}
        <Resource
          name="tasks"
          list={TaskList}
          options={{ label: 'Tasks' }}
        />

        {/* Organizations - Real API */}
        <Resource
          name="organizations"
          list={OrganizationList}
          create={OrganizationCreate}
          edit={OrganizationEdit}
          options={{ label: 'Organizations' }}
        />

        {/* Pipelines - Real API (read-only, shows stages and metrics) */}
        <Resource
          name="pipelines"
          list={PipelineList}
          show={PipelineShow}
          options={{ label: 'Pipelines' }}
        />

        {/* Events - Real API (read-only timeline) */}
        <Resource
          name="events"
          options={{ label: 'Events' }}
        />

        {/* ============================================== */}
        {/* Custom Routes (Pages with Mock Data)          */}
        {/* ============================================== */}
        <CustomRoutes>
          {/* Reports - MOCK DATA */}
          <Route path="/reports" element={<ReportsPage />} />
          
          {/* Settings - MOCK DATA */}
          <Route path="/settings" element={<SettingsPage />} />
          
          {/* Lead Scoring - REAL API */}
          <Route path="/lead-scoring" element={<LeadScoringPage />} />

          {/* Pipeline Settings - REAL API */}
          <Route path="/pipelines/settings" element={<PipelineSettings />} />

          {/* Email Marketing - MOCK DATA */}
          <Route path="/email-marketing" element={<EmailMarketingPage />} />
          <Route path="/email-marketing/:id" element={<SequenceBuilder />} />
        </CustomRoutes>
      </Admin>
      </div>
    </ThemeProvider>
  );
};

export default App;
