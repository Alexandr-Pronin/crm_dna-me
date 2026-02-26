/**
 * Organization List Component
 * Lists companies/organizations from the REAL backend API (GET /organizations)
 */
import { List, Datagrid, TextField, SearchInput, TextInput, TopToolbar, FilterButton, CreateButton, ExportButton } from 'react-admin';
import { Box, Typography } from '@mui/material';
import { useRightDrawer } from '../../contexts/RightDrawerContext';
import { useNavigate } from 'react-router-dom';

const organizationFilters = [
  <SearchInput source="search" alwaysOn placeholder="Search organizations..." />,
  <TextInput source="domain" label="Domain" />,
  <TextInput source="industry" label="Industry" />,
  <TextInput source="company_size" label="Company Size" />,
  <TextInput source="country" label="Country" />
];

const OrganizationList = () => {
  const { openRecord } = useRightDrawer();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>Organizations</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage companies and link contacts to organizations
        </Typography>
      </Box>
      <List
        title=" "
        filters={organizationFilters}
        perPage={25}
        sort={{ field: 'name', order: 'ASC' }}
        sx={{
          '& .RaList-main': {
            bgcolor: 'background.paper',
            borderRadius: 2,
            overflow: 'hidden',
          },
        }}
        actions={
          <TopToolbar sx={{ minHeight: 'auto', p: 0 }}>
            <FilterButton />
            <CreateButton onClick={() => navigate('/organizations/create')} label="Create Organization" />
            <ExportButton />
          </TopToolbar>
        }
      >
        <Datagrid 
          rowClick={(id) => { openRecord('organizations', id); return false; }} 
          bulkActionButtons={false}
        >
        <TextField source="name" label="Name" />
        <TextField source="domain" label="Domain" emptyText="—" />
        <TextField source="industry" label="Industry" emptyText="—" />
        <TextField source="company_size" label="Company Size" emptyText="—" />
        <TextField source="country" label="Country" emptyText="—" />
      </Datagrid>
    </List>
  </Box>
  );
};

export default OrganizationList;
