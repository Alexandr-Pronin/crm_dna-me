import React from 'react';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import { TextField, useRecordContext } from 'react-admin';
import { Business as BusinessIcon } from '@mui/icons-material';

const OrganizationShowContent = ({ isInRightDrawer }) => {
  const record = useRecordContext();
  if (!record) return null;

  return (
    <Box sx={{ p: isInRightDrawer ? 2 : 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <BusinessIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>
            {record.name}
          </Typography>
          {record.domain && (
            <Typography variant="body2" color="text.secondary">
              <a href={`https://${record.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                {record.domain}
              </a>
            </Typography>
          )}
        </Box>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Industry</Typography>
              <Typography variant="body2">{record.industry || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Company Size</Typography>
              <Typography variant="body2">{record.company_size || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Country</Typography>
              <Typography variant="body2">{record.country || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Portal ID</Typography>
              <Typography variant="body2">{record.portal_id || '—'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">Moco ID</Typography>
              <Typography variant="body2">{record.moco_id || '—'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default OrganizationShowContent;