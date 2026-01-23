/**
 * DNA ME CRM Color Palette
 * Dark Mode Biotech Theme
 */

export const palette = {
  mode: 'dark',
  
  // Primary - Teal (Biotech primary)
  primary: {
    main: '#4A90A4',
    light: '#6AAFC2',
    dark: '#357A8A',
    contrastText: '#FFFFFF',
  },
  
  // Secondary - Purple (Accent)
  secondary: {
    main: '#6C5CE7',
    light: '#8B7EEB',
    dark: '#5849C4',
    contrastText: '#FFFFFF',
  },
  
  // Status colors
  success: {
    main: '#28A745',
    light: '#48C766',
    dark: '#1E7E34',
    contrastText: '#FFFFFF',
  },
  
  warning: {
    main: '#F59E0B',
    light: '#FBBF24',
    dark: '#D97706',
    contrastText: '#000000',
  },
  
  error: {
    main: '#DC3545',
    light: '#E4606D',
    dark: '#C82333',
    contrastText: '#FFFFFF',
  },
  
  info: {
    main: '#17A2B8',
    light: '#3FBCD0',
    dark: '#117A8B',
    contrastText: '#FFFFFF',
  },
  
  // Background - Transparent/semi-transparent for DNA shader visibility
  background: {
    default: 'rgba(0, 0, 0, 0)',
    paper: 'rgba(18, 18, 26, 0.8)',
    elevated: 'rgba(26, 26, 36, 0.85)',
  },
  
  // Text
  text: {
    primary: '#e0e0e0',
    secondary: '#a0a0a0',
    disabled: '#666666',
  },
  
  // Dividers & borders
  divider: '#2a2a3a',
  
  // Action states
  action: {
    active: '#e0e0e0',
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(74, 144, 164, 0.16)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
  },
};

/**
 * Pipeline-specific colors
 */
export const PIPELINE_COLORS = {
  'research-lab': {
    primary: '#4A90A4',
    secondary: '#357A8A',
    gradient: 'linear-gradient(135deg, #4A90A4 0%, #357A8A 100%)',
    label: 'Research Lab',
  },
  'b2b-lab': {
    primary: '#6C5CE7',
    secondary: '#5849C4',
    gradient: 'linear-gradient(135deg, #6C5CE7 0%, #5849C4 100%)',
    label: 'B2B Lab Enablement',
  },
  'co-creation': {
    primary: '#28A745',
    secondary: '#1E7E34',
    gradient: 'linear-gradient(135deg, #28A745 0%, #1E7E34 100%)',
    label: 'Panel Co-Creation',
  },
};

/**
 * Lead Score colors
 */
export const SCORE_COLORS = {
  cold: { 
    bg: 'rgba(100, 116, 139, 0.15)', 
    text: '#64748B', 
    border: 'rgba(100, 116, 139, 0.4)',
    label: 'Cold',
  },
  warm: { 
    bg: 'rgba(245, 158, 11, 0.15)', 
    text: '#F59E0B', 
    border: 'rgba(245, 158, 11, 0.4)',
    label: 'Warm',
  },
  hot: { 
    bg: 'rgba(239, 68, 68, 0.15)', 
    text: '#EF4444', 
    border: 'rgba(239, 68, 68, 0.4)',
    label: 'Hot',
  },
  veryHot: { 
    bg: 'rgba(220, 38, 38, 0.15)', 
    text: '#DC2626', 
    border: 'rgba(220, 38, 38, 0.4)',
    label: 'Very Hot',
  },
};

/**
 * Get score color config based on score value
 */
export const getScoreColorConfig = (score) => {
  if (score >= 121) return SCORE_COLORS.veryHot;
  if (score >= 81) return SCORE_COLORS.hot;
  if (score >= 41) return SCORE_COLORS.warm;
  return SCORE_COLORS.cold;
};

export default palette;
