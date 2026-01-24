import React, { useState, useEffect, useCallback } from 'react';
import { useDataProvider, useNotify, useRefresh, Title } from 'react-admin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Stack,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Paper
} from '@mui/material';
import {
  DragIndicator as DragIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  ColorLens as ColorIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Predefined colors for stages
const PRESET_COLORS = [
  '#64748B', // Slate
  '#F59E0B', // Amber
  '#4A90A4', // Teal-ish
  '#6C5CE7', // Purple
  '#17A2B8', // Cyan
  '#8B5CF6', // Violet
  '#10B981', // Emerald
  '#EF4444', // Red
  '#EC4899', // Pink
  '#F97316', // Orange
];

// Sortable Stage Item Component
const SortableStageItem = ({ stage, onUpdate, onDelete, activeId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 999 : 'auto',
  };

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color || '#64748B');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSave = () => {
    onUpdate(stage.id, { name, color });
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setName(stage.name);
      setIsEditing(false);
    }
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 4 : 1}
      sx={{
        p: 2,
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        bgcolor: 'background.paper',
        '&:hover .drag-handle': { opacity: 1 }
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        className="drag-handle"
        sx={{
          cursor: 'grab',
          opacity: 0.3,
          display: 'flex',
          alignItems: 'center',
          '&:hover': { opacity: 1 }
        }}
      >
        <DragIcon />
      </Box>

      {/* Color Indicator/Picker */}
      <Box sx={{ position: 'relative' }}>
        <Box
          onClick={() => setShowColorPicker(!showColorPicker)}
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: color,
            cursor: 'pointer',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px #ddd'
          }}
        />
        {showColorPicker && (
          <Paper
            sx={{
              position: 'absolute',
              top: 30,
              left: 0,
              zIndex: 10,
              p: 1,
              display: 'flex',
              flexWrap: 'wrap',
              width: 140,
              gap: 0.5
            }}
          >
            {PRESET_COLORS.map((c) => (
              <Box
                key={c}
                onClick={() => {
                  setColor(c);
                  setShowColorPicker(false);
                  if (!isEditing) {
                    onUpdate(stage.id, { color: c });
                  }
                }}
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: c,
                  cursor: 'pointer',
                  border: c === color ? '2px solid #000' : 'none'
                }}
              />
            ))}
          </Paper>
        )}
      </Box>

      {/* Name Field */}
      <Box sx={{ flex: 1 }}>
        {isEditing ? (
          <TextField
            fullWidth
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <Typography
            onClick={() => setIsEditing(true)}
            sx={{ cursor: 'pointer', fontWeight: 500 }}
          >
            {stage.name}
          </Typography>
        )}
      </Box>

      {/* Actions */}
      <Box>
        <Tooltip title="Löschen">
          <IconButton size="small" onClick={() => onDelete(stage.id)} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
};

const PipelineSettings = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stagesLoading, setStagesLoading] = useState(false);

  // Dialog states
  const [createPipelineOpen, setCreatePipelineOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load Pipelines
  useEffect(() => {
    const loadPipelines = async () => {
      try {
        const { data } = await dataProvider.getList('pipelines', {
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'name', order: 'ASC' },
        });
        setPipelines(data);
        if (data.length > 0 && !selectedPipelineId) {
          setSelectedPipelineId(data[0].id);
        }
      } catch (error) {
        notify('Fehler beim Laden der Pipelines', { type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    loadPipelines();
  }, [dataProvider, notify, selectedPipelineId]);

  // Load Stages
  useEffect(() => {
    if (!selectedPipelineId) return;

    const loadStages = async () => {
      setStagesLoading(true);
      try {
        const { data } = await dataProvider.getList(`pipelines/${selectedPipelineId}/stages`, {
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'position', order: 'ASC' },
        });
        setStages(data);
      } catch (error) {
        notify('Fehler beim Laden der Stages', { type: 'error' });
      } finally {
        setStagesLoading(false);
      }
    };
    loadStages();
  }, [selectedPipelineId, dataProvider, notify]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newStages = arrayMove(items, oldIndex, newIndex);
        
        // Optimistic update
        const stageIds = newStages.map(s => s.id);
        
        // Call API to reorder
        dataProvider.create(`pipelines/${selectedPipelineId}/stages/reorder`, {
             data: { stage_ids: stageIds } 
        })
        .catch(() => {
            notify('Fehler beim Speichern der Reihenfolge', { type: 'error' });
            // Revert on error (could be implemented by reloading stages)
            refresh();
        });

        return newStages;
      });
    }
  };

  const handleStageUpdate = async (id, updates) => {
    // Optimistic update
    setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s));

    try {
      await dataProvider.update('stages', { id, data: updates });
      notify('Stage aktualisiert', { type: 'success' });
    } catch (error) {
      notify('Fehler beim Aktualisieren der Stage', { type: 'error' });
      refresh(); // Revert
    }
  };

  const handleStageDelete = async (id) => {
    if (!window.confirm('Sind Sie sicher? Alle Deals in dieser Stage müssen verschoben werden.')) return;

    try {
      await dataProvider.delete('stages', { id });
      setStages(stages.filter(s => s.id !== id));
      notify('Stage gelöscht', { type: 'success' });
    } catch (error) {
      notify('Fehler beim Löschen der Stage', { type: 'error' });
    }
  };

  const handleAddStage = async () => {
    const newPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position || 0)) + 1 : 0;
    try {
      const { data } = await dataProvider.create(`pipelines/${selectedPipelineId}/stages`, {
        data: {
          name: 'Neue Stage',
          position: newPosition,
          color: PRESET_COLORS[newPosition % PRESET_COLORS.length]
        }
      });
      setStages([...stages, data]);
      notify('Stage erstellt', { type: 'success' });
    } catch (error) {
      notify('Fehler beim Erstellen der Stage', { type: 'error' });
    }
  };

  const handleCreatePipeline = async () => {
    try {
      const { data } = await dataProvider.create('pipelines', {
        data: { name: newPipelineName, is_active: true }
      });
      setPipelines([...pipelines, data]);
      setSelectedPipelineId(data.id);
      setCreatePipelineOpen(false);
      setNewPipelineName('');
      notify('Pipeline erstellt', { type: 'success' });
    } catch (error) {
      notify('Fehler beim Erstellen der Pipeline', { type: 'error' });
    }
  };

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Title title="Pipeline Einstellungen" />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Pipeline Einstellungen
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setCreatePipelineOpen(true)}
        >
          Neue Pipeline
        </Button>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Pipeline auswählen</InputLabel>
            <Select
              value={selectedPipelineId}
              label="Pipeline auswählen"
              onChange={(e) => setSelectedPipelineId(e.target.value)}
            >
              {pipelines.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Stages</Typography>
        <Button startIcon={<AddIcon />} onClick={handleAddStage}>
          Stage hinzufügen
        </Button>
      </Box>

      {stagesLoading ? (
        <CircularProgress />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stages.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {stages.map((stage) => (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  onUpdate={handleStageUpdate}
                  onDelete={handleStageDelete}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      )}

      {/* Create Pipeline Dialog */}
      <Dialog open={createPipelineOpen} onClose={() => setCreatePipelineOpen(false)}>
        <DialogTitle>Neue Pipeline erstellen</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Pipeline Name"
            fullWidth
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatePipelineOpen(false)}>Abbrechen</Button>
          <Button onClick={handleCreatePipeline} variant="contained" disabled={!newPipelineName.trim()}>
            Erstellen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PipelineSettings;
