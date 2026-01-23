/**
 * Deal List Component
 * Connects to REAL API (GET /deals)
 * Kanban board implementation included
 */
import { useMemo, useState, useEffect } from 'react';
import {
  List,
  Datagrid,
  TextField,
  DateField,
  FunctionField,
  NumberField,
  useDataProvider,
  useRefresh,
  TopToolbar,
  FilterButton,
  CreateButton,
  SearchInput,
  SelectInput,
} from 'react-admin';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ViewKanban as KanbanIcon,
  ViewList as ListIcon,
} from '@mui/icons-material';
import { KanbanBoard } from '../../components/Kanban';

const pipelineColorPalette = ['#4A90A4', '#6C5CE7', '#28A745', '#F59E0B', '#17A2B8', '#DC3545'];
const stageColorPalette = ['#64748B', '#F59E0B', '#4A90A4', '#6C5CE7', '#17A2B8', '#28A745', '#DC3545'];

const PipelineChip = ({ pipelineId, pipelineMap }) => {
  const pipeline = pipelineMap[pipelineId];
  const color = pipeline?.color || '#64748B';
  const label = pipeline?.name || pipelineId || 'Unknown';

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}20`,
        color: color,
        fontWeight: 500,
      }}
    />
  );
};

const StageChip = ({ stageId, stageName, stageMap }) => {
  const stage = stageMap[stageId];
  const color = stage?.color || '#64748B';
  const label = stageName || stage?.name || stageId || 'Unknown';

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: `${color}20`,
        color: color,
        fontWeight: 500,
      }}
    />
  );
};

const ValueField = ({ value }) => {
  if (!value) return <Typography color="text.secondary">—</Typography>;
  
  return (
    <Typography variant="body2" fontWeight={600} color="primary.main">
      €{value.toLocaleString()}
    </Typography>
  );
};

const ListActions = () => (
  <TopToolbar sx={{ gap: 1 }}>
    <FilterButton />
    <CreateButton label="Deal erstellen" />
  </TopToolbar>
);


// localStorage Key für Ansichts-Persistenz
const VIEW_MODE_STORAGE_KEY = 'dna-me-deals-view-mode';

const DealList = () => {
  // Lade gespeicherte Ansicht aus localStorage
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return saved === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });
  const [pipelines, setPipelines] = useState([]);
  const [stages, setStages] = useState([]);
  const refresh = useRefresh();
  const dataProvider = useDataProvider();

  useEffect(() => {
    let isActive = true;

    const loadPipelines = async () => {
      try {
        const { data } = await dataProvider.getList('pipelines', {
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'name', order: 'ASC' },
          filter: { include_inactive: 'false' },
        });
        if (isActive) {
          setPipelines(data || []);
        }
      } catch (error) {
        console.error('Failed to load pipelines', error);
        if (isActive) {
          setPipelines([]);
        }
      }
    };

    loadPipelines();

    return () => {
      isActive = false;
    };
  }, [dataProvider]);

  useEffect(() => {
    let isActive = true;

    const loadStages = async () => {
      if (!pipelines.length) {
        setStages([]);
        return;
      }

      try {
        const stageResponses = await Promise.all(
          pipelines.map((pipeline) =>
            dataProvider
              .getList(`pipelines/${pipeline.id}/stages`, {
                pagination: { page: 1, perPage: 100 },
                sort: { field: 'position', order: 'ASC' },
                filter: {},
              })
              .then(({ data }) => data.map((stage) => ({ ...stage, pipeline_id: pipeline.id })))
              .catch((error) => {
                console.error('Failed to load stages for pipeline', pipeline.id, error);
                return [];
              })
          )
        );

        const mergedStages = stageResponses.flat();
        if (isActive) {
          setStages(mergedStages);
        }
      } catch (error) {
        console.error('Failed to load stages', error);
        if (isActive) {
          setStages([]);
        }
      }
    };

    loadStages();

    return () => {
      isActive = false;
    };
  }, [dataProvider, pipelines]);

  const handleViewChange = (event, newValue) => {
    if (newValue) {
      setViewMode(newValue);
      // Speichere Ansicht in localStorage
      try {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, newValue);
      } catch (e) {
        console.warn('Could not save view mode to localStorage:', e);
      }
    }
  };

  const pipelineMap = useMemo(() => {
    return pipelines.reduce((acc, pipeline, index) => {
      acc[pipeline.id] = {
        name: pipeline.name,
        color: pipelineColorPalette[index % pipelineColorPalette.length],
      };
      return acc;
    }, {});
  }, [pipelines]);

  const stageMap = useMemo(() => {
    return stages.reduce((acc, stage) => {
      const colorIndex = stage.position ? stage.position - 1 : 0;
      acc[stage.id] = {
        name: stage.name,
        color: stageColorPalette[colorIndex % stageColorPalette.length],
        pipeline_id: stage.pipeline_id,
      };
      return acc;
    }, {});
  }, [stages]);

  const pipelineChoices = useMemo(
    () => pipelines.map((pipeline) => ({ id: pipeline.id, name: pipeline.name })),
    [pipelines]
  );

  const stageChoices = useMemo(() => {
    return stages.map((stage) => {
      const pipelineName = pipelineMap[stage.pipeline_id]?.name;
      const label = pipelineName ? `${pipelineName} — ${stage.name}` : stage.name;
      return { id: stage.id, name: label };
    });
  }, [pipelines, pipelineMap, stages]);

  const dealFilters = [
    <SearchInput source="q" alwaysOn placeholder="Search deals..." />,
    <SelectInput source="pipeline_id" label="Pipeline" choices={pipelineChoices} />,
    <SelectInput source="stage_id" label="Stage" choices={stageChoices} />,
  ];

  return (
    <Box sx={{ p: 2 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 300 }}>
            Deals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {viewMode === 'kanban' ? 'Drag & Drop für Pipeline-Management' : 'Verwalten Sie Ihre Sales Pipeline'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewChange}
            size="small"
          >
            <ToggleButton value="list">
              <Tooltip title="Listenansicht">
                <ListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="kanban">
              <Tooltip title="Kanban Board">
                <KanbanIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Aktualisieren">
            <IconButton onClick={refresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {viewMode === 'kanban' ? (
        <KanbanBoard />
      ) : (
        <List
          filters={dealFilters}
          actions={<ListActions />}
          sort={{ field: 'created_at', order: 'DESC' }}
          perPage={25}
          empty={
            <Card sx={{ textAlign: 'center', py: 6 }}>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Deals Yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Deals will appear here when connected to the backend.
                </Typography>
              </CardContent>
            </Card>
          }
          sx={{
            '& .RaList-main': {
              bgcolor: 'background.paper',
              borderRadius: 2,
              overflow: 'hidden',
            },
          }}
        >
          <Datagrid
            rowClick="show"
            bulkActionButtons={false}
            sx={{
              '& .RaDatagrid-headerCell': {
                fontWeight: 600,
                bgcolor: 'background.default',
              },
            }}
          >
            <TextField source="title" label="Deal" />
            <FunctionField
              label="Pipeline"
              render={(record) => (
                <PipelineChip pipelineId={record?.pipeline_id} pipelineMap={pipelineMap} />
              )}
            />
            <FunctionField
              label="Stage"
              render={(record) => (
                <StageChip
                  stageId={record?.stage_id || record?.stage}
                  stageName={record?.stage_name}
                  stageMap={stageMap}
                />
              )}
            />
            <FunctionField
              label="Value"
              render={(record) => <ValueField value={record?.value} />}
            />
            <TextField source="contact_name" label="Contact" emptyText="—" />
            <DateField source="expected_close" label="Expected Close" />
            <DateField source="created_at" label="Created" showTime={false} />
          </Datagrid>
        </List>
      )}
    </Box>
  );
};

export default DealList;
