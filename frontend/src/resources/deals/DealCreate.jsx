/**
 * Deal Create Component
 * Creates a new deal via POST /deals (REAL API)
 */
import { useState, useEffect } from 'react';
import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  DateInput,
  required,
  useDataProvider,
  useNotify,
  useRedirect,
} from 'react-admin';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';

/**
 * Deal Create Form
 */
const DealCreateForm = () => {
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const dataProvider = useDataProvider();
  const notify = useNotify();

  // Load pipelines and leads on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [pipelinesRes, leadsRes] = await Promise.all([
          dataProvider.getList('pipelines', {
            pagination: { page: 1, perPage: 100 },
            sort: { field: 'name', order: 'ASC' },
            filter: {},
          }),
          dataProvider.getList('leads', {
            pagination: { page: 1, perPage: 100 },
            sort: { field: 'email', order: 'ASC' },
            filter: {},
          }),
        ]);
        
        setPipelines(pipelinesRes.data || []);
        setLeads(leadsRes.data || []);
        
        // Auto-select first pipeline
        if (pipelinesRes.data?.length > 0) {
          setSelectedPipelineId(pipelinesRes.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load pipelines and leads');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [dataProvider]);

  // Load stages when pipeline changes
  useEffect(() => {
    if (!selectedPipelineId) {
      setStages([]);
      return;
    }

    const loadStages = async () => {
      try {
        const { data } = await dataProvider.getList(`pipelines/${selectedPipelineId}/stages`, {
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
  }, [selectedPipelineId, dataProvider]);

  const handlePipelineChange = (event) => {
    setSelectedPipelineId(event.target.value);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  const pipelineChoices = pipelines.map(p => ({ id: p.id, name: p.name }));
  const stageChoices = stages.map(s => ({ id: s.id, name: s.name }));
  const leadChoices = leads.map(l => {
    const personName = `${l.first_name || ''} ${l.last_name || ''}`.trim();
    const companyName = l.organization_name || l.company || '';
    const labelBase = personName || l.email;

    return {
      id: l.id,
      name: companyName ? `${companyName} — ${labelBase}` : labelBase,
    };
  });

  return (
    <SimpleForm>
      <Box sx={{ width: '100%', maxWidth: 600 }}>
        {/* Lead Selection */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Lead Information
        </Typography>
        <SelectInput
          source="lead_id"
          label="Lead"
          choices={leadChoices}
          validate={required('Lead is required')}
          fullWidth
          helperText="Select the lead for this deal"
        />

        {/* Pipeline & Stage */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
          Pipeline
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <SelectInput
            source="pipeline_id"
            label="Pipeline"
            choices={pipelineChoices}
            validate={required('Pipeline is required')}
            onChange={handlePipelineChange}
            fullWidth
            defaultValue={selectedPipelineId}
          />
          <SelectInput
            source="stage_id"
            label="Stage"
            choices={stageChoices}
            fullWidth
            helperText="Leave empty for first stage"
          />
        </Box>

        {/* Deal Details */}
        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
          Deal Details
        </Typography>
        <TextInput
          source="name"
          label="Deal Name"
          fullWidth
          helperText="Optional - auto-generated if empty"
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
            defaultValue="EUR"
            fullWidth
          />
        </Box>
        <DateInput
          source="expected_close_date"
          label="Expected Close Date"
          fullWidth
        />
      </Box>
    </SimpleForm>
  );
};

/**
 * Main Deal Create Component
 */
const DealCreate = () => {
  const redirect = useRedirect();

  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 300 }}>
          Create Deal
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create a new deal in your sales pipeline
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Create
            redirect="list"
            mutationOptions={{
              onSuccess: () => {
                redirect('list', 'deals');
              },
            }}
          >
            <DealCreateForm />
          </Create>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DealCreate;
