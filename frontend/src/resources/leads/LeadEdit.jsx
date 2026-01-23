/**
 * Lead Edit Component
 * Edits an existing lead via PUT /leads/:id (REAL API)
 */
import { useState, useEffect } from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  useDataProvider,
  useRecordContext,
  Toolbar,
  SaveButton,
  DeleteButton,
  required,
  email,
} from 'react-admin';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
} from '@mui/material';
import { ScoreBadge } from '../../components/common';

/**
 * Status chip display
 */
const StatusChip = ({ status }) => {
  const statusConfig = {
    new: { color: '#4A90A4', label: 'New', bg: 'rgba(74, 144, 164, 0.15)' },
    contacted: { color: '#F59E0B', label: 'Contacted', bg: 'rgba(245, 158, 11, 0.15)' },
    qualified: { color: '#6C5CE7', label: 'Qualified', bg: 'rgba(108, 92, 231, 0.15)' },
    nurturing: { color: '#17A2B8', label: 'Nurturing', bg: 'rgba(23, 162, 184, 0.15)' },
    customer: { color: '#28A745', label: 'Customer', bg: 'rgba(40, 167, 69, 0.15)' },
    churned: { color: '#DC3545', label: 'Churned', bg: 'rgba(220, 53, 69, 0.15)' },
  };
  
  const config = statusConfig[status] || statusConfig.new;
  
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        bgcolor: config.bg,
        color: config.color,
        fontWeight: 500,
      }}
    />
  );
};

/**
 * Custom toolbar with save and delete buttons
 */
const LeadEditToolbar = () => (
  <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
    <SaveButton />
    <DeleteButton confirmTitle="Delete Lead" confirmContent="Are you sure you want to delete this lead? This action cannot be undone." />
  </Toolbar>
);

/**
 * Lead Edit Form Component
 */
const LeadEditForm = () => {
  const record = useRecordContext();
  const [organizations, setOrganizations] = useState([]);
  const dataProvider = useDataProvider();

  // Load organizations for the dropdown
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const { data } = await dataProvider.getList('organizations', {
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'name', order: 'ASC' },
          filter: {},
        });
        setOrganizations(data || []);
      } catch (err) {
        console.error('Failed to load organizations:', err);
        setOrganizations([]);
      }
    };

    loadOrganizations();
  }, [dataProvider]);

  if (!record) return null;

  const fullName = `${record.first_name || ''} ${record.last_name || ''}`.trim() || record.email;
  const organizationChoices = organizations.map(o => ({ id: o.id, name: o.name }));

  return (
    <SimpleForm toolbar={<LeadEditToolbar />}>
      <Box sx={{ width: '100%', maxWidth: 800 }}>
        {/* Lead Info Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {fullName}
          </Typography>
          <StatusChip status={record.status} />
          <ScoreBadge score={record.total_score || 0} />
        </Box>

        <Grid container spacing={3}>
          {/* Left Column */}
          <Grid item xs={12} md={6}>
            {/* Contact Information */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Contact Information
            </Typography>
            <TextInput
              source="email"
              label="Email"
              validate={[required('Email is required'), email('Invalid email format')]}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextInput
                source="first_name"
                label="First Name"
                fullWidth
              />
              <TextInput
                source="last_name"
                label="Last Name"
                fullWidth
              />
            </Box>
            <TextInput
              source="phone"
              label="Phone"
              fullWidth
            />
            <TextInput
              source="job_title"
              label="Job Title"
              fullWidth
            />

            <Divider sx={{ my: 3 }} />

            {/* Organization */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Organization
            </Typography>
            <SelectInput
              source="organization_id"
              label="Company"
              choices={organizationChoices}
              fullWidth
              emptyText="No company"
            />
          </Grid>

          {/* Right Column */}
          <Grid item xs={12} md={6}>
            {/* Status Fields */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Status & Stage
            </Typography>
            <SelectInput
              source="status"
              label="Status"
              choices={[
                { id: 'new', name: 'New' },
                { id: 'contacted', name: 'Contacted' },
                { id: 'qualified', name: 'Qualified' },
                { id: 'nurturing', name: 'Nurturing' },
                { id: 'customer', name: 'Customer' },
                { id: 'churned', name: 'Churned' },
              ]}
              fullWidth
            />
            <SelectInput
              source="lifecycle_stage"
              label="Lifecycle Stage"
              choices={[
                { id: 'lead', name: 'Lead' },
                { id: 'mql', name: 'MQL' },
                { id: 'sql', name: 'SQL' },
                { id: 'opportunity', name: 'Opportunity' },
                { id: 'customer', name: 'Customer' },
              ]}
              fullWidth
            />

            <Divider sx={{ my: 3 }} />

            {/* Attribution */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Attribution
            </Typography>
            <TextInput
              source="first_touch_source"
              label="First Touch Source"
              fullWidth
            />
            <TextInput
              source="first_touch_campaign"
              label="First Touch Campaign"
              fullWidth
            />
            <TextInput
              source="last_touch_source"
              label="Last Touch Source"
              fullWidth
            />
            <TextInput
              source="last_touch_campaign"
              label="Last Touch Campaign"
              fullWidth
            />

            <Divider sx={{ my: 3 }} />

            {/* LinkedIn */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Social
            </Typography>
            <TextInput
              source="linkedin_url"
              label="LinkedIn URL"
              fullWidth
            />
          </Grid>
        </Grid>

        {/* Read-only Metadata */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Scoring (Read-only)
        </Typography>
        <Box sx={{ display: 'flex', gap: 4, color: 'text.secondary', fontSize: '0.875rem' }}>
          <Box>
            <Typography variant="caption" display="block">Total Score</Typography>
            <Typography variant="body2" fontWeight={600}>{record.total_score || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" display="block">Demographic</Typography>
            <Typography variant="body2">{record.demographic_score || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" display="block">Engagement</Typography>
            <Typography variant="body2">{record.engagement_score || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" display="block">Behavior</Typography>
            <Typography variant="body2">{record.behavior_score || 0}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" display="block">Primary Intent</Typography>
            <Typography variant="body2">{record.primary_intent || '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" display="block">Created</Typography>
            <Typography variant="body2">
              {record.created_at ? new Date(record.created_at).toLocaleDateString() : '—'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </SimpleForm>
  );
};

/**
 * Main Lead Edit Component
 */
const LeadEdit = () => {
  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Edit Lead
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Update lead information and status
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Edit
            redirect="list"
            mutationMode="pessimistic"
          >
            <LeadEditForm />
          </Edit>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LeadEdit;
