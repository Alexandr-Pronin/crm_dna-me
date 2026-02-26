import React from 'react';
import { Box, Typography } from '@mui/material';
import { useGetOne, RecordContextProvider } from 'react-admin';
import LeadShowContent from '../../resources/leads/LeadShowContent';
import OrganizationShowContent from '../../resources/organizations/OrganizationShowContent';

const RecordDrawerContent = ({ resource, recordId }) => {
  const { data, isLoading, error } = useGetOne(resource, { id: recordId }, {
    enabled: !!recordId,
  });

  if (isLoading) {
    return <Box sx={{ p: 3 }}>Lade Daten...</Box>;
  }

  if (error || !data) {
    return <Box sx={{ p: 3 }}>Fehler beim Laden des Datensatzes.</Box>;
  }

  return (
    <RecordContextProvider value={data}>
      {(() => {
        switch (resource) {
          case 'leads':
            return <LeadShowContent isInRightDrawer={true} />;
          case 'organizations':
            return <OrganizationShowContent isInRightDrawer={true} />;
          default:
            return (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  Keine Detailansicht für "{resource}" konfiguriert.
                </Typography>
              </Box>
            );
        }
      })()}
    </RecordContextProvider>
  );
};

export default RecordDrawerContent;

