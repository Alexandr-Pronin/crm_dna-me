/**
 * Kanban Primitives - Wiederverwendbare Bausteine für das Kanban Board
 * Optimiert für flüssiges Drag & Drop ohne Ruckeln
 */
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Paper, Typography, alpha, useTheme, IconButton, Tooltip } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

/**
 * KanbanColumnContainer - Droppable Container für eine Stage
 * Kümmert sich nur um Drop-Zone und Basis-Styling
 */
export const KanbanColumnContainer = ({ 
  id, 
  title, 
  count, 
  color, 
  children, 
  totalValue,
  headerContent,
  emptyContent,
  onSettingsClick,
  showSettings = true,
}) => {
  const theme = useTheme();
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'column', stageId: id },
  });

  const activeColor = color || theme.palette.primary.main;
  const hasChildren = React.Children.count(children) > 0;

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 320,
        maxWidth: 320,
        height: '100%',
        bgcolor: isOver ? alpha(activeColor, 0.06) : 'background.paper',
        border: '2px solid',
        borderColor: isOver ? activeColor : 'divider',
        borderRadius: 3,
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        flexShrink: 0,
        willChange: 'border-color, background-color',
      }}
    >
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          borderBottom: '2px solid',
          borderColor: activeColor,
          bgcolor: alpha(activeColor, 0.04),
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box 
              sx={{ 
                width: 12, 
                height: 12, 
                borderRadius: '50%', 
                bgcolor: activeColor,
                boxShadow: `0 0 8px ${alpha(activeColor, 0.5)}`,
              }} 
            />
            <Typography 
              variant="subtitle2" 
              fontWeight={700} 
              sx={{ 
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'text.primary',
                fontSize: '0.8rem',
              }}
            >
              {title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {showSettings && onSettingsClick && (
              <Tooltip title="Stage Trigger konfigurieren">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSettingsClick();
                  }}
                  sx={{
                    p: 0.5,
                    color: alpha(activeColor, 0.7),
                    '&:hover': {
                      color: activeColor,
                      bgcolor: alpha(activeColor, 0.1),
                    },
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
            <Box 
              sx={{ 
                bgcolor: activeColor,
                color: 'white',
                px: 1.25,
                py: 0.25,
                borderRadius: 1.5,
                fontSize: '0.75rem',
                fontWeight: 700,
                minWidth: 28,
                textAlign: 'center',
              }}
            >
              {count}
            </Box>
          </Box>
        </Box>
        
        {/* Total Value */}
        {totalValue > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography 
              variant="h6" 
              fontWeight={700} 
              sx={{ color: activeColor, lineHeight: 1.2 }}
            >
              €{totalValue.toLocaleString('de-DE')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Gesamtwert
            </Typography>
          </Box>
        )}
        
        {/* Optional Header Content */}
        {headerContent}
      </Box>

      {/* Cards Container */}
      <Box 
        sx={{ 
          p: 1.5, 
          flex: 1, 
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          minHeight: 100,
          // Smooth scrolling
          scrollBehavior: 'smooth',
          // Hide scrollbar during drag
          '&::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
            borderRadius: 1,
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.primary, 0.15),
            borderRadius: 1,
            '&:hover': {
              bgcolor: alpha(theme.palette.text.primary, 0.25),
            },
          },
        }}
      >
        {hasChildren ? children : (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              px: 2,
              border: '2px dashed',
              borderColor: isOver ? activeColor : 'divider',
              borderRadius: 2,
              bgcolor: isOver ? alpha(activeColor, 0.05) : 'transparent',
              transition: 'all 0.15s ease',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {emptyContent || (
              <Typography 
                variant="body2" 
                color={isOver ? activeColor : 'text.secondary'}
                fontWeight={isOver ? 600 : 400}
              >
                {isOver ? 'Deal hier ablegen' : 'Keine Deals'}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

/**
 * KanbanItem - Sortable/Draggable Wrapper für Deal Cards
 * Beim Drag: Original verschwindet komplett, DragOverlay zeigt Kopie
 */
export const KanbanItem = ({ id, deal, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'deal', deal, id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export default { KanbanColumnContainer, KanbanItem };
