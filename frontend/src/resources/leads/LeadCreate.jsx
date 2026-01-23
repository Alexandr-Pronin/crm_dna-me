/**
 * Lead Create Component
 * Creates a new lead via POST /leads (REAL API)
 */
import { Create, SimpleForm, TextInput, SelectInput, ReferenceInput, AutocompleteInput } from 'react-admin';
import { Box, Typography } from '@mui/material';

const validateEmail = (value) => {
  if (!value) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
  return undefined;
};

const validateLinkedInUrl = (value) => {
  if (!value) return undefined;
  if (!value.startsWith('http')) return 'Must be a valid URL';
  return undefined;
};

const LeadCreateForm = () => (
  <SimpleForm>
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Lead Details
        </Typography>
        <TextInput source="email" label="Email" fullWidth validate={validateEmail} />
        <TextInput source="first_name" label="First Name" fullWidth />
        <TextInput source="last_name" label="Last Name" fullWidth />
        <TextInput source="phone" label="Phone" fullWidth />
        <TextInput source="job_title" label="Job Title" fullWidth />
        <ReferenceInput
          source="organization_id"
          reference="organizations"
          label="Company"
          perPage={25}
          sort={{ field: 'name', order: 'ASC' }}
        >
          <AutocompleteInput optionText="name" fullWidth filterToQuery={(search) => ({ search })} />
        </ReferenceInput>
        <TextInput
          source="linkedin_url"
          label="LinkedIn URL"
          fullWidth
          validate={validateLinkedInUrl}
        />
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Status
        </Typography>
        <SelectInput
          source="status"
          label="Status"
          fullWidth
          choices={[
            { id: 'new', name: 'New' },
            { id: 'contacted', name: 'Contacted' },
            { id: 'qualified', name: 'Qualified' },
            { id: 'nurturing', name: 'Nurturing' },
            { id: 'customer', name: 'Customer' },
            { id: 'churned', name: 'Churned' },
          ]}
        />
        <SelectInput
          source="lifecycle_stage"
          label="Lifecycle Stage"
          fullWidth
          choices={[
            { id: 'lead', name: 'Lead' },
            { id: 'mql', name: 'MQL' },
            { id: 'sql', name: 'SQL' },
            { id: 'opportunity', name: 'Opportunity' },
            { id: 'customer', name: 'Customer' },
          ]}
        />
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Attribution
        </Typography>
        <TextInput source="first_touch_source" label="First Touch Source" fullWidth />
        <TextInput source="first_touch_campaign" label="First Touch Campaign" fullWidth />
      </Box>
    </Box>
  </SimpleForm>
);

const LeadCreate = () => (
  <Create>
    <LeadCreateForm />
  </Create>
);

export default LeadCreate;
