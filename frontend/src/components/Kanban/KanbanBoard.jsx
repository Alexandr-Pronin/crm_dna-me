/**
 * Kanban Board Component
 * Optimierte Version mit sauberer Trennung von Logik und Darstellung
 * Verwendet KanbanPrimitives für performantes Drag & Drop
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDataProvider, useNotify, useRefresh } from 'react-admin';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  Skeleton,
  alpha,
  Button,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { PIPELINE_LIST as FALLBACK_PIPELINES, getPipelineById as getFallbackPipeline } from '../../constants/pipelines';
import { moveDealToStage, reorderDealsInStage } from '../../providers/dataProvider';
import KanbanColumn from './KanbanColumn';
import HubspotDealCard from './HubspotDealCard';
import DealPreviewModal from './DealPreviewModal';
import DealCreateModal from './DealCreateModal';
import StageTriggersModal from './StageTriggersModal';
import { KanbanItem } from './KanbanPrimitives';

// Stage Farben (konsistent mit KanbanColumn)
const STAGE_COLORS = {
  awareness: '#64748B',
  interest: '#F59E0B',
  consideration: '#4A90A4',
  decision: '#6C5CE7',
  purchase: '#17A2B8',
  qualification: '#F59E0B',
  discovery: '#4A90A4',
  technical_validation: '#6C5CE7',
  commercial_negotiation: '#8B5CF6',
  contract_sent: '#10B981',
  partnership_discussion: '#F59E0B',
  due_diligence: '#4A90A4',
  pilot_partnership: '#6C5CE7',
  contract_negotiation: '#8B5CF6',
  won: '#10B981',
  lost: '#EF4444',
  default: '#64748B',
};

const KanbanBoard = () => {
  // Pipeline data from API
  const [pipelines, setPipelines] = useState([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  
  // Selected pipeline and its stages
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [stages, setStages] = useState([]);
  const [stagesLoading, setStagesLoading] = useState(false);
  
  // Deals data
  const [deals, setDeals] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  
  // Error state
  const [error, setError] = useState(null);
  
  // Drag state
  const [activeDealId, setActiveDealId] = useState(null);
  
  // Selection state für HubSpot-Style Batch-Aktionen
  const [selectedDeals, setSelectedDeals] = useState({});
  
  // Modal state für Deal-Vorschau/Bearbeitung
  const [previewDeal, setPreviewDeal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Modal state für Deal-Erstellung
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  // Modal state für Stage Triggers
  const [isTriggersModalOpen, setIsTriggersModalOpen] = useState(false);
  const [triggersStage, setTriggersStage] = useState(null);
  const [triggersDeals, setTriggersDeals] = useState([]);
  
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  // Optimierte Sensor-Konfiguration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimaler Abstand bevor Drag startet
      },
    })
  );

  // Measuring configuration
  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.WhileDragging,
    },
  };

  // Load pipelines from API on mount
  useEffect(() => {
    const loadPipelines = async () => {
      setPipelinesLoading(true);
      try {
        const { data } = await dataProvider.getList('pipelines', {
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'name', order: 'ASC' },
          filter: {},
        });
        
        if (data && data.length > 0) {
          setPipelines(data);
          setSelectedPipelineId(data[0].id);
        } else {
          setPipelines(FALLBACK_PIPELINES.map(p => ({
            ...p,
            id: p.id,
            slug: p.id,
          })));
          setSelectedPipelineId(FALLBACK_PIPELINES[0].id);
        }
      } catch (err) {
        console.error('Failed to load pipelines:', err);
        setPipelines(FALLBACK_PIPELINES.map(p => ({
          ...p,
          id: p.id,
          slug: p.id,
        })));
        setSelectedPipelineId(FALLBACK_PIPELINES[0].id);
      } finally {
        setPipelinesLoading(false);
      }
    };

    loadPipelines();
  }, [dataProvider]);

  // Load stages when pipeline changes
  useEffect(() => {
    if (!selectedPipelineId) return;

    const loadStages = async () => {
      setStagesLoading(true);
      try {
        const isUUID = selectedPipelineId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        
        if (isUUID) {
          const { data } = await dataProvider.getList(`pipelines/${selectedPipelineId}/stages`, {
            pagination: { page: 1, perPage: 50 },
            sort: { field: 'position', order: 'ASC' },
            filter: {},
          });
          
          if (data && data.length > 0) {
            setStages(data.map(stage => ({
              id: stage.id,
              name: stage.name,
              slug: stage.slug,
              position: stage.position,
              color: stage.color || null,
              stage_type: stage.stage_type || null,
            })));
          } else {
            const fallback = getFallbackPipeline(selectedPipelineId);
            setStages(fallback?.stages || []);
          }
        } else {
          const fallback = getFallbackPipeline(selectedPipelineId);
          setStages(fallback?.stages || []);
        }
      } catch (err) {
        console.error('Failed to load stages:', err);
        const fallback = getFallbackPipeline(selectedPipelineId);
        setStages(fallback?.stages || []);
      } finally {
        setStagesLoading(false);
      }
    };

    loadStages();
  }, [selectedPipelineId, dataProvider]);

  const loadDeals = useCallback(async () => {
    if (!selectedPipelineId) return;

    setDealsLoading(true);
    setError(null);
    
    try {
      const { data } = await dataProvider.getList('deals', {
        pagination: { page: 1, perPage: 100 },
        sort: { field: 'created_at', order: 'DESC' },
        filter: { pipeline_id: selectedPipelineId },
      });
      
      setDeals(data || []);
    } catch (err) {
      console.error('Failed to load deals:', err);
      setError(err.message || 'Failed to load deals');
      notify('Fehler beim Laden der Deals', { type: 'error' });
    } finally {
      setDealsLoading(false);
    }
  }, [selectedPipelineId, dataProvider, notify]);

  // Load deals for selected pipeline
  useEffect(() => {
    if (!selectedPipelineId) return;
    loadDeals();
  }, [selectedPipelineId, loadDeals]);

  // Group deals by stage (memoized)
  const dealsByStage = useMemo(() => {
    const grouped = {};
    stages.forEach(stage => {
      const stageDeals = deals.filter(deal => 
        deal.stage_id === stage.id || deal.stage === stage.id || deal.stage === stage.slug
      );
      stageDeals.sort((a, b) => {
        const aPos = a.position ?? Infinity;
        const bPos = b.position ?? Infinity;
        if (aPos !== bPos) return aPos - bPos;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      grouped[stage.id] = stageDeals;
    });
    return grouped;
  }, [stages, deals]);

  // Get current pipeline info
  const selectedPipeline = useMemo(() => {
    return pipelines.find(p => p.id === selectedPipelineId) || 
           getFallbackPipeline(selectedPipelineId);
  }, [pipelines, selectedPipelineId]);

  // Get active deal for overlay
  const activeDeal = useMemo(() => {
    return activeDealId ? deals.find(d => d.id === activeDealId) : null;
  }, [activeDealId, deals]);

  // Helper functions
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  const getStageByKey = useCallback((stageKey) => {
    return stages.find(stage => stage.id === stageKey || stage.slug === stageKey);
  }, [stages]);

  const resolveStageId = useCallback((stageKey) => {
    if (!stageKey) return null;
    if (isUuid(stageKey)) return stageKey;
    return getStageByKey(stageKey)?.id || null;
  }, [getStageByKey]);

  const isDealInStage = useCallback((deal, stageKey) => {
    if (!stageKey) return false;
    const stage = getStageByKey(stageKey);
    const stageId = stage?.id || stageKey;
    const stageSlug = stage?.slug;
    return (
      deal.stage_id === stageId ||
      deal.stage === stageId ||
      (stageSlug && deal.stage === stageSlug)
    );
  }, [getStageByKey]);

  const handlePipelineChange = (event) => {
    setSelectedPipelineId(event.target.value);
  };

  // Drag & Drop handlers
  const handleDragStart = useCallback((event) => {
    setActiveDealId(event.active.id);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    
    setActiveDealId(null);
    
    if (!over) return;

    const dealId = active.id;
    const overType = over?.data?.current?.type;
    const overContainerId = over?.data?.current?.sortable?.containerId;
    const newStageKey = overType === 'column' ? over.id : overContainerId;
    const overDealId = overType === 'deal' ? over.id : null;
    
    if (!newStageKey) return;
    
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    
    const currentStageKey = deal.stage_id || deal.stage;
    const currentStageId = resolveStageId(currentStageKey);
    const resolvedNewStageId = resolveStageId(newStageKey);
    
    if (!resolvedNewStageId || !currentStageId) return;

    // Sortiere Deals in der Stage
    const orderStageDeals = (stageDeals) => {
      return [...stageDeals].sort((a, b) => {
        const aPos = a.position ?? Infinity;
        const bPos = b.position ?? Infinity;
        if (aPos !== bPos) return aPos - bPos;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    };

    // Reorder innerhalb derselben Stage
    if (currentStageId === resolvedNewStageId) {
      const stageDeals = orderStageDeals(deals.filter(d => isDealInStage(d, currentStageKey)));
      const activeIndex = stageDeals.findIndex(d => d.id === dealId);
      if (activeIndex === -1) return;

      const overIndex = overDealId
        ? stageDeals.findIndex(d => d.id === overDealId)
        : stageDeals.length - 1;
      const targetIndex = overIndex === -1 ? stageDeals.length - 1 : overIndex;
      
      if (activeIndex === targetIndex) return;
      
      const nextStageDeals = arrayMove(stageDeals, activeIndex, targetIndex);
      const otherDeals = deals.filter(d => !isDealInStage(d, currentStageKey));
      const nextDeals = [...otherDeals, ...nextStageDeals];

      setDeals(nextDeals);

      try {
        await reorderDealsInStage(currentStageId, nextStageDeals.map(d => d.id));
      } catch (err) {
        console.error('Failed to reorder deals:', err);
      }
      return;
    }

    // Move zu einer anderen Stage
    const previousDeals = deals;

    const sourceDeals = orderStageDeals(deals.filter(d => isDealInStage(d, currentStageKey)));
    const targetDeals = orderStageDeals(deals.filter(d => isDealInStage(d, newStageKey)));
    const otherDeals = deals.filter(
      d => !isDealInStage(d, currentStageKey) && !isDealInStage(d, newStageKey)
    );

    const activeIndex = sourceDeals.findIndex(d => d.id === dealId);
    if (activeIndex === -1) return;

    const targetStage = getStageByKey(newStageKey);
    const movedDeal = {
      ...sourceDeals[activeIndex],
      stage_id: resolvedNewStageId,
      stage: targetStage?.slug || resolvedNewStageId,
    };
    
    const nextSourceDeals = sourceDeals.filter(d => d.id !== dealId);
    const insertIndex = overDealId
      ? targetDeals.findIndex(d => d.id === overDealId)
      : targetDeals.length;
    const safeIndex = insertIndex < 0 ? targetDeals.length : insertIndex;
    const nextTargetDeals = [
      ...targetDeals.slice(0, safeIndex),
      movedDeal,
      ...targetDeals.slice(safeIndex),
    ];
    const nextTargetOrder = nextTargetDeals.map(d => d.id);
    const nextDeals = [...otherDeals, ...nextSourceDeals, ...nextTargetDeals];

    // Optimistic Update
    setDeals(nextDeals);

    try {
      await moveDealToStage(dealId, resolvedNewStageId);
      if (nextTargetOrder.length) {
        await reorderDealsInStage(resolvedNewStageId, nextTargetOrder);
      }
      notify('Deal erfolgreich verschoben', { type: 'success' });
    } catch (err) {
      console.error('Failed to move deal:', err);
      setDeals(previousDeals);
      notify('Fehler beim Verschieben des Deals', { type: 'error' });
    }
  }, [deals, notify, resolveStageId, isDealInStage, getStageByKey]);

  const handleDragCancel = useCallback(() => {
    setActiveDealId(null);
  }, []);

  // Toggle Deal Selection (für HubSpot-Style Checkboxen)
  const toggleDealSelection = useCallback((dealId) => {
    setSelectedDeals(prev => ({
      ...prev,
      [dealId]: !prev[dealId]
    }));
  }, []);

  // Alle Auswahlen aufheben
  const clearSelection = useCallback(() => {
    setSelectedDeals({});
  }, []);

  // Anzahl der ausgewählten Deals
  const selectedCount = Object.values(selectedDeals).filter(Boolean).length;

  // Modal Handler
  const handleOpenDealPreview = useCallback((deal) => {
    setPreviewDeal(deal);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setPreviewDeal(null);
  }, []);

  const handleDealUpdated = useCallback((updatedDeal) => {
    setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d));
  }, []);

  // Deal Creation handlers
  const handleOpenCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const handleDealCreated = useCallback(() => {
    loadDeals();
    notify('Deal erfolgreich erstellt', { type: 'success' });
  }, [loadDeals, notify]);

  // Stage Triggers Modal handlers
  const handleOpenTriggersModal = useCallback((stage, stageDeals) => {
    setTriggersStage(stage);
    setTriggersDeals(stageDeals);
    setIsTriggersModalOpen(true);
  }, []);

  const handleCloseTriggersModal = useCallback(() => {
    setIsTriggersModalOpen(false);
    setTriggersStage(null);
    setTriggersDeals([]);
  }, []);

  // Loading state for pipelines
  if (pipelinesLoading) {
    return (
      <Box sx={{ width: '100%', p: 2 }}>
        <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} variant="rectangular" width={320} height={400} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      </Box>
    );
  }

  const loading = stagesLoading || dealsLoading;

  // Get color for active deal overlay
  const getStageColor = (stageId) => {
    const stage = stages.find(s => s.id === stageId || s.slug === stageId);
    if (stage?.color) return stage.color;
    if (stage?.stage_type && STAGE_COLORS[stage.stage_type]) {
      return STAGE_COLORS[stage.stage_type];
    }
    if (stage?.slug && STAGE_COLORS[stage.slug]) {
      return STAGE_COLORS[stage.slug];
    }
    return STAGE_COLORS.default;
  };

  return (
    <Box sx={{ width: '100%', height: 'calc(100vh - 200px)' }}>
      {/* Pipeline Selection Header */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 2.5, 
          mb: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
              {selectedPipeline?.name || 'Sales Pipeline'}
            </Typography>
            {selectedPipeline?.description && (
              <Typography variant="body2" color="text.secondary">
                {selectedPipeline.description}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl sx={{ minWidth: 250 }} size="small">
              <InputLabel id="pipeline-select-label">Pipeline</InputLabel>
              <Select
                labelId="pipeline-select-label"
                id="pipeline-select"
                value={selectedPipelineId || ''}
                label="Pipeline"
                onChange={handlePipelineChange}
              >
                {pipelines.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreateModal}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                fontWeight: 600,
                textTransform: 'none',
                px: 3,
                py: 1,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(74, 144, 164, 0.3)',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  boxShadow: '0 4px 12px rgba(74, 144, 164, 0.4)',
                },
              }}
            >
              Deal erstellen
            </Button>
          </Box>
        </Box>

        {/* Pipeline Stats */}
        {selectedPipeline && (
          <Box sx={{ display: 'flex', gap: 4, mt: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Deals
              </Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">
                {deals.length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Gesamtwert
              </Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">
                €{deals.reduce((sum, d) => sum + (d.value || 0), 0).toLocaleString('de-DE')}
              </Typography>
            </Box>
            {selectedPipeline.salesCycle && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Sales Cycle
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {selectedPipeline.salesCycle}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* Kanban Board with DnD Context */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={measuringConfig}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              overflowY: 'hidden',
              height: 'calc(100% - 140px)',
              pb: 2,
              px: 0.5,
              '&::-webkit-scrollbar': {
                height: 8,
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: alpha('#000', 0.05),
                borderRadius: 4,
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: alpha('#000', 0.15),
                borderRadius: 4,
                '&:hover': {
                  bgcolor: alpha('#000', 0.25),
                },
              },
            }}
          >
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                selectedDeals={selectedDeals}
                onToggleSelection={toggleDealSelection}
                onDealPreview={handleOpenDealPreview}
                onSettingsClick={handleOpenTriggersModal}
              />
            ))}
            
            {stages.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6, width: '100%' }}>
                <Typography variant="body1" color="text.secondary">
                  Keine Stages für diese Pipeline definiert
                </Typography>
              </Box>
            )}
          </Box>

          <DragOverlay>
            {activeDeal ? (
              <Box sx={{ width: '100%', maxWidth: 288 }}>
                <HubspotDealCard 
                  deal={activeDeal} 
                  isDragging
                  stageColor={getStageColor(activeDeal.stage_id || activeDeal.stage)}
                />
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Deal Preview/Edit Modal */}
      <DealPreviewModal
        open={isModalOpen}
        onClose={handleCloseModal}
        deal={previewDeal}
        stageColor={previewDeal ? getStageColor(previewDeal.stage_id || previewDeal.stage) : undefined}
        stages={stages}
        onDealUpdated={handleDealUpdated}
      />

      {/* Deal Create Modal */}
      <DealCreateModal
        open={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        selectedPipelineId={selectedPipelineId}
        onDealCreated={handleDealCreated}
      />

      {/* Stage Triggers Modal */}
      <StageTriggersModal
        open={isTriggersModalOpen}
        onClose={handleCloseTriggersModal}
        stage={triggersStage}
        stageColor={triggersStage ? getStageColor(triggersStage.id) : undefined}
        deals={triggersDeals}
        onExecuted={loadDeals}
      />
    </Box>
  );
};

export default KanbanBoard;
