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

  // Load Pipelines function
  const loadPipelines = useCallback(async () => {
    try {
      const { data } = await dataProvider.getList('pipelines', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'name', order: 'ASC' },
      });
      setPipelines(data || []);
      // Only set default pipeline if none is selected
      setSelectedPipelineId(prev => {
        if (!prev && data && data.length > 0) {
          return data[0].id;
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to load pipelines:', error);
      notify('Fehler beim Laden der Pipelines', { type: 'error' });
      setPipelines([]);
    } finally {
      setLoading(false);
    }
  }, [dataProvider, notify]);

  // Load Pipelines on mount
  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  // Load Stages function
  const loadStages = useCallback(async () => {
    if (!selectedPipelineId) return;
    
    setStagesLoading(true);
    try {
      const { data } = await dataProvider.getList(`pipelines/${selectedPipelineId}/stages`, {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'position', order: 'ASC' },
      });
      setStages(data || []);
    } catch (error) {
      console.error('Failed to load stages:', error);
      notify('Fehler beim Laden der Stages', { type: 'error' });
      setStages([]);
    } finally {
      setStagesLoading(false);
    }
  }, [selectedPipelineId, dataProvider, notify]);

  // Load Stages when pipeline changes
  useEffect(() => {
    loadStages();
  }, [loadStages]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) return;

    const oldIndex = stages.findIndex((item) => item.id === active.id);
    const newIndex = stages.findIndex((item) => item.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    // Optimistic update
    const newStages = arrayMove(stages, oldIndex, newIndex);
    setStages(newStages);
    
    const stageIds = newStages.map(s => s.id);
    
    try {
      await dataProvider.create(`pipelines/${selectedPipelineId}/stages/reorder`, {
        data: { stage_ids: stageIds } 
      });
      // Reload stages to ensure consistency
      await loadStages();
    } catch (error) {
      console.error('Failed to reorder stages:', error);
      notify('Fehler beim Speichern der Reihenfolge', { type: 'error' });
      // Revert by reloading stages
      await loadStages();
    }
  };

  const handleStageUpdate = async (id, updates) => {
    // Optimistic update
    const oldStages = stages;
    setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s));

    try {
      await dataProvider.update('stages', { id, data: updates });
      notify('Stage aktualisiert', { type: 'success' });
      // Reload stages to ensure consistency
      await loadStages();
    } catch (error) {
      console.error('Failed to update stage:', error);
      // Revert optimistic update
      setStages(oldStages);
      notify('Fehler beim Aktualisieren der Stage', { type: 'error' });
    }
  };

  const handleStageDelete = async (id) => {
    // Prevent deleting the last stage to avoid 400 from backend
    if (stages.length <= 1) {
      notify('Die letzte Stage kann nicht gelöscht werden', { type: 'warning' });
      return;
    }

    if (!window.confirm('Sind Sie sicher? Alle Deals in dieser Stage müssen verschoben werden.')) return;

    try {
      await dataProvider.delete('stages', { id });
      notify('Stage gelöscht', { type: 'success' });
      // Reload stages after deletion
      await loadStages();
    } catch (error) {
      console.error('Failed to delete stage:', error);
      if (error.message?.includes('last stage') || error.status === 400) {
        notify('Die letzte Stage kann nicht gelöscht werden', { type: 'error' });
      } else {
        notify('Fehler beim Löschen der Stage', { type: 'error' });
      }
    }
  };

  const generateStageSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[äöüß]/g, (char) => {
        const map = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
        return map[char] || char;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  };

  const handleAddStage = async () => {
    if (!selectedPipelineId) {
      notify('Bitte wählen Sie zuerst eine Pipeline aus', { type: 'warning' });
      return;
    }
    
    const newPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position || 0)) + 1 : 1;
    const baseName = 'Neue Stage';
    const existingNames = new Set(stages.map(stage => stage.name?.trim().toLowerCase()));
    const existingSlugs = new Set(stages.map(stage => stage.slug).filter(Boolean));
    
    // Find a unique name (UI) and a unique slug (backend)
    let stageName = baseName;
    let suffix = 2;
    while (existingNames.has(stageName.toLowerCase())) {
      stageName = `${baseName} ${suffix++}`;
    }

    let stageSlug = generateStageSlug(stageName);
    while (existingSlugs.has(stageSlug)) {
      stageName = `${baseName} ${suffix++}`;
      stageSlug = generateStageSlug(stageName);
    }
    
    try {
      await dataProvider.create(`pipelines/${selectedPipelineId}/stages`, {
        data: {
          name: stageName,
          slug: stageSlug,
          position: newPosition,
          color: PRESET_COLORS[newPosition % PRESET_COLORS.length]
        }
      });
      notify('Stage erstellt', { type: 'success' });
      // Reload stages after creation
      await loadStages();
    } catch (error) {
      console.error('Failed to create stage:', error);
      
      // If it's a slug conflict, show a more specific error
      if (error.message?.includes('already exists') || error.status === 409) {
        notify('Ein Konflikt ist aufgetreten. Bitte versuchen Sie es erneut.', { type: 'error' });
        // Reload stages to get the latest data
        await loadStages();
      } else {
        notify('Fehler beim Erstellen der Stage', { type: 'error' });
      }
    }
  };

  const handleCreatePipeline = async () => {
    const trimmedName = newPipelineName.trim();
    if (!trimmedName) {
      notify('Bitte geben Sie einen Namen für die Pipeline ein.', { type: 'warning' });
      return;
    }
    
    try {
      const { data } = await dataProvider.create('pipelines', {
        data: { name: trimmedName, is_active: true }
      });
      setCreatePipelineOpen(false);
      setNewPipelineName('');
      notify('Pipeline erstellt', { type: 'success' });
      // Reload pipelines to get the new one
      await loadPipelines();
      // Select the newly created pipeline
      if (data && data.id) {
        setSelectedPipelineId(data.id);
      }
    } catch (error) {
      console.error('Failed to create pipeline:', error);
      notify('Fehler beim Erstellen der Pipeline', { type: 'error' });
    }
  };

  const handleDeletePipeline = async () => {
    if (!selectedPipelineId) {
      notify('Bitte wählen Sie zuerst eine Pipeline aus.', { type: 'warning' });
      return;
    }

    if (!window.confirm('Möchten Sie diese Pipeline wirklich löschen? Alle Stages werden entfernt.')) return;

    try {
      await dataProvider.delete('pipelines', { id: selectedPipelineId });
      notify('Pipeline gelöscht', { type: 'success' });
      setSelectedPipelineId('');
      await loadPipelines();
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
      if (error.status === 409 || error.message?.includes('Cannot delete')) {
        notify('Pipeline kann nicht gelöscht werden. Bitte zuerst offene Deals schließen oder verschieben.', { type: 'error' });
      } else if (error.status === 400) {
        notify('Pipeline kann nicht gelöscht werden.', { type: 'error' });
      } else {
        notify('Fehler beim Löschen der Pipeline', { type: 'error' });
      }
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
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeletePipeline}
            disabled={!selectedPipelineId}
          >
            Pipeline löschen
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreatePipelineOpen(true)}
          >
            Neue Pipeline
          </Button>
        </Stack>
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
