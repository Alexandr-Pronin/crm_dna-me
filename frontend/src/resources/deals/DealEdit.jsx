/**
 * Deal Edit Component
 * Edits an existing deal via PATCH /deals/:id (REAL API)
 */
import { useState, useEffect } from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  DateInput,
  useDataProvider,
  useNotify,
  useRecordContext,
  Toolbar,
  SaveButton,
  DeleteButton,
} from 'react-admin';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
} from '@mui/material';

/**
 * Status chip for deal status display
 */
const StatusChip = ({ status }) => {
  const statusConfig = {
    open: { color: '#4A90A4', label: 'Open', bg: 'rgba(74, 144, 164, 0.15)' },
    won: { color: '#28A745', label: 'Won', bg: 'rgba(40, 167, 69, 0.15)' },
    lost: { color: '#DC3545', label: 'Lost', bg: 'rgba(220, 53, 69, 0.15)' },
  };
  
  const config = statusConfig[status] || statusConfig.open;
  
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
const DealEditToolbar = () => (
  <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
    <SaveButton />
    <DeleteButton confirmTitle="Delete Deal" confirmContent="Are you sure you want to delete this deal?" />
  </Toolbar>
);

/**
 * Deal Edit Form Component
 */
const DealEditForm = () => {
  const record = useRecordContext();
  const [stages, setStages] = useState([]);
  const dataProvider = useDataProvider();

  // Load stages for the deal's pipeline
  useEffect(() => {
    if (!record?.pipeline_id) return;

    const loadStages = async () => {
      try {
        const { data } = await dataProvider.getList(`pipelines/${record.pipeline_id}/stages`, {
          pagination: { page: 1, perPage: 50 },
          sort: { field: 'position', order: 'ASC' },
          filter: {},
        });
        setStages(data || []);
      } catch (err) {
        console.error('Failed to load stages:', err);
        setStages([]);
      }
    };

    loadStages();
  }, [record?.pipeline_id, dataProvider]);

  if (!record) return null;

  const stageChoices = stages.map(s => ({ id: s.id, name: s.name }));

  return (
    <SimpleForm toolbar={<DealEditToolbar />}>
      <Box sx={{ width: '100%', maxWidth: 600 }}>
        {/* Deal Info Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {record.name || `Deal #${record.id?.slice(0, 8)}`}
          </Typography>
          <StatusChip status={record.status} />
        </Box>

        {/* Stage Selection */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Pipeline Stage
        </Typography>
        <SelectInput
          source="stage_id"
          label="Stage"
          choices={stageChoices}
          fullWidth
          helperText="Move deal to a different stage"
        />

        <Divider sx={{ my: 3 }} />

        {/* Deal Details */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Deal Details
        </Typography>
        <TextInput
          source="name"
          label="Deal Name"
          fullWidth
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <NumberInput
            source="value"
            label="Value"
            min={0}
            fullWidth
          />
          <SelectInput
            source="currency"
            label="Currency"
            choices={[
              { id: 'EUR', name: 'EUR (€)' },
              { id: 'USD', name: 'USD ($)' },
              { id: 'GBP', name: 'GBP (£)' },
              { id: 'CHF', name: 'CHF' },
            ]}
            fullWidth
          />
        </Box>
        <DateInput
          source="expected_close_date"
          label="Expected Close Date"
          fullWidth
        />

        <Divider sx={{ my: 3 }} />

        {/* Moco Invoice Defaults */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Moco Invoice Defaults
        </Typography>
        <TextInput
          source="metadata.invoice_title"
          label="Invoice Title"
          fullWidth
          helperText="Falls leer, wird der Deal-Name verwendet"
        />
        <TextInput
          source="metadata.recipient_address"
          label="Recipient Address"
          fullWidth
          multiline
          rows={3}
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <NumberInput
            source="metadata.tax"
            label="Tax (%)"
            min={0}
            fullWidth
          />
          <NumberInput
            source="metadata.due_days"
            label="Due Days"
            min={0}
            fullWidth
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextInput
            source="metadata.item_title"
            label="Item Title"
            fullWidth
          />
          <NumberInput
            source="metadata.unit_price"
            label="Unit Price (net)"
            min={0}
            fullWidth
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <DateInput
            source="metadata.service_period_from"
            label="Service Period From"
            fullWidth
          />
          <DateInput
            source="metadata.service_period_to"
            label="Service Period To"
            fullWidth
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <NumberInput
            source="metadata.discount"
            label="Discount (%)"
            min={0}
            fullWidth
          />
          <NumberInput
            source="metadata.cash_discount"
            label="Cash Discount (%)"
            min={0}
            fullWidth
          />
          <NumberInput
            source="metadata.cash_discount_days"
            label="Cash Discount Days"
            min={0}
            fullWidth
          />
        </Box>
        <TextInput
          source="metadata.tags"
          label="Tags (comma-separated)"
          fullWidth
        />
        <TextInput
          source="metadata.salutation"
          label="Salutation (HTML)"
          fullWidth
          multiline
          rows={2}
        />
        <TextInput
          source="metadata.footer"
          label="Footer (HTML)"
          fullWidth
          multiline
          rows={3}
        />

        <Divider sx={{ my: 3 }} />

        {/* Assignment */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Assignment
        </Typography>
        <SelectInput
          source="assigned_region"
          label="Region"
          choices={[
            { id: 'DACH', name: 'DACH' },
            { id: 'EU', name: 'Europe' },
            { id: 'US', name: 'USA' },
            { id: 'APAC', name: 'Asia Pacific' },
          ]}
          fullWidth
          emptyText="No region assigned"
        />

        {/* Read-only Info */}
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Metadata
        </Typography>
        <Box sx={{ display: 'flex', gap: 4, color: 'text.secondary', fontSize: '0.875rem' }}>
          <Box>
            <Typography variant="caption" display="block">Pipeline</Typography>
            <Typography variant="body2">{record.pipeline_name || record.pipeline_id}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" display="block">Lead ID</Typography>
            <Typography variant="body2">{record.lead_id?.slice(0, 8)}...</Typography>
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
 * Main Deal Edit Component
 */
const DealEdit = () => {
  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Edit Deal
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Update deal information and stage
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Edit
            redirect="list"
            mutationMode="pessimistic"
          >
            <DealEditForm />
          </Edit>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DealEdit;
