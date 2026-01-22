/**
 * DNA ME CRM Typography Settings
 * Clean, modern biotech aesthetic
 */

export const typography = {
  fontFamily: '"IBM Plex Sans", "Inter", "Roboto", "Helvetica", sans-serif',
  
  // Headings - Light weight for modern feel
  h1: {
    fontWeight: 300,
    fontSize: '2.5rem',
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontWeight: 300,
    fontSize: '2rem',
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontWeight: 400,
    fontSize: '1.75rem',
    lineHeight: 1.35,
  },
  h4: {
    fontWeight: 300,
    fontSize: '1.5rem',
    lineHeight: 1.4,
  },
  h5: {
    fontWeight: 500,
    fontSize: '1.25rem',
    lineHeight: 1.45,
  },
  h6: {
    fontWeight: 500,
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  
  // Body text
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.57,
  },
  
  // Subtitles
  subtitle1: {
    fontWeight: 500,
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  subtitle2: {
    fontWeight: 500,
    fontSize: '0.875rem',
    lineHeight: 1.57,
  },
  
  // Captions and overlines
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.66,
    letterSpacing: '0.03em',
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 2.66,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  
  // Buttons
  button: {
    fontWeight: 500,
    fontSize: '0.875rem',
    lineHeight: 1.75,
    letterSpacing: '0.02em',
    textTransform: 'none', // No uppercase for buttons
  },
};

export default typography;
