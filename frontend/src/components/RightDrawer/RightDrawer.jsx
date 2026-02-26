import React from 'react';
import { Drawer, Box, IconButton, Typography, Divider, Tooltip } from '@mui/material';
import { Close as CloseIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useRightDrawer } from '../../contexts/RightDrawerContext';

// We'll import this later, for now just a placeholder
import RecordDrawerContent from './RecordDrawerContent';

const RightDrawer = () => {
  const { open, resource, recordId, closeRecord, openRecordInPage } = useRightDrawer();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={closeRecord}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 500, md: 600, lg: 700 },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
          borderLeft: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {resource ? `${resource.slice(0, -1)} Details` : 'Details'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Vollseite öffnen">
              <IconButton size="small" onClick={() => openRecordInPage(resource, recordId)}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Schließen">
              <IconButton size="small" onClick={closeRecord}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {open && resource && recordId ? (
            <RecordDrawerContent resource={resource} recordId={recordId} />
          ) : (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              Kein Datensatz ausgewählt.
            </Box>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default RightDrawer;
