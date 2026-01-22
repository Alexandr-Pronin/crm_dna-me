/**
 * DNA ME CRM Component Overrides
 * Custom styling for MUI components
 */

export const components = {
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        scrollbarColor: '#2a2a3a #0a0a0f',
        '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
          width: 8,
          height: 8,
        },
        '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
          background: '#0a0a0f',
        },
        '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
          backgroundColor: '#2a2a3a',
          borderRadius: 4,
          '&:hover': {
            backgroundColor: '#3a3a4a',
          },
        },
      },
    },
  },
  
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        textTransform: 'none',
        fontWeight: 500,
        padding: '8px 16px',
      },
      contained: {
        boxShadow: 'none',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        },
      },
      outlined: {
        borderWidth: 1.5,
        '&:hover': {
          borderWidth: 1.5,
        },
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none', // Remove default gradient
        borderRadius: 12,
      },
      elevation1: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      },
      elevation2: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backgroundImage: 'none',
      },
    },
  },
  
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
      outlined: {
        borderWidth: 1.5,
      },
    },
  },
  
  MuiTableCell: {
    styleOverrides: {
      root: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      head: {
        fontWeight: 600,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
      },
    },
  },
  
  MuiTableRow: {
    styleOverrides: {
      root: {
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
        },
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 8,
          '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.15)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.25)',
          },
        },
      },
    },
  },
  
  MuiSelect: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
  
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: '#1a1a24',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 6,
        fontSize: '0.75rem',
        padding: '8px 12px',
      },
      arrow: {
        color: '#1a1a24',
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
      },
    },
  },
  
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      },
    },
  },
  
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      },
    },
  },
  
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 8,
        margin: '2px 8px',
        '&.Mui-selected': {
          backgroundColor: 'rgba(74, 144, 164, 0.15)',
          '&:hover': {
            backgroundColor: 'rgba(74, 144, 164, 0.2)',
          },
        },
      },
    },
  },
  
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 4,
        height: 6,
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      indicator: {
        borderRadius: '4px 4px 0 0',
        height: 3,
      },
    },
  },
  
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        fontWeight: 500,
        minHeight: 48,
      },
    },
  },
  
  MuiBadge: {
    styleOverrides: {
      badge: {
        fontWeight: 600,
      },
    },
  },
};

export default components;
