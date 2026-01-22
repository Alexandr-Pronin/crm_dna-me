/**
 * DNA ME CRM Theme
 * Dark Mode Biotech Theme Export
 */
import { createTheme } from '@mui/material/styles';
import { palette, PIPELINE_COLORS, SCORE_COLORS, getScoreColorConfig } from './palette';
import { typography } from './typography';
import { components } from './components';

/**
 * Main Theme Configuration
 */
const theme = createTheme({
  palette,
  typography,
  components,
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 2px 4px rgba(0,0,0,0.2)',
    '0 4px 8px rgba(0,0,0,0.25)',
    '0 6px 12px rgba(0,0,0,0.3)',
    '0 8px 16px rgba(0,0,0,0.35)',
    '0 10px 20px rgba(0,0,0,0.4)',
    '0 12px 24px rgba(0,0,0,0.45)',
    '0 14px 28px rgba(0,0,0,0.5)',
    '0 16px 32px rgba(0,0,0,0.55)',
    '0 18px 36px rgba(0,0,0,0.6)',
    '0 20px 40px rgba(0,0,0,0.65)',
    '0 22px 44px rgba(0,0,0,0.7)',
    '0 24px 48px rgba(0,0,0,0.75)',
    '0 26px 52px rgba(0,0,0,0.8)',
    '0 28px 56px rgba(0,0,0,0.85)',
    '0 30px 60px rgba(0,0,0,0.9)',
    '0 32px 64px rgba(0,0,0,0.95)',
    '0 34px 68px rgba(0,0,0,1)',
    '0 36px 72px rgba(0,0,0,1)',
    '0 38px 76px rgba(0,0,0,1)',
    '0 40px 80px rgba(0,0,0,1)',
    '0 42px 84px rgba(0,0,0,1)',
    '0 44px 88px rgba(0,0,0,1)',
    '0 46px 92px rgba(0,0,0,1)',
    '0 48px 96px rgba(0,0,0,1)',
  ],
});

export { PIPELINE_COLORS, SCORE_COLORS, getScoreColorConfig };
export default theme;
