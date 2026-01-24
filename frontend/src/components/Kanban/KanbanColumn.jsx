/**
 * Kanban Column Component
 * Verwendet die wiederverwendbaren Primitives für saubere Trennung
 * Aktualisiert für HubSpot-Style Deal Cards
 */
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumnContainer, KanbanItem } from './KanbanPrimitives';
import HubspotDealCard from './HubspotDealCard';

// Stage Farben Mapping
const STAGE_COLORS = {
  // B2C Pipeline
  awareness: '#64748B',
  interest: '#F59E0B',
  consideration: '#4A90A4',
  decision: '#6C5CE7',
  purchase: '#17A2B8',
  // B2B Pipeline
  qualification: '#F59E0B',
  discovery: '#4A90A4',
  technical_validation: '#6C5CE7',
  commercial_negotiation: '#8B5CF6',
  contract_sent: '#10B981',
  // B2B2C Pipeline
  partnership_discussion: '#F59E0B',
  due_diligence: '#4A90A4',
  pilot_partnership: '#6C5CE7',
  contract_negotiation: '#8B5CF6',
  // Common
  won: '#10B981',
  lost: '#EF4444',
  closed_won: '#10B981',
  closed_lost: '#EF4444',
  // Default
  default: '#64748B',
};

const getStageColor = (stageId, stageSlug) => {
  // Versuche mit ID, dann mit Slug
  return STAGE_COLORS[stageId] || 
         STAGE_COLORS[stageSlug] || 
         STAGE_COLORS.default;
};

const KanbanColumn = ({ 
  stage, 
  deals, 
  onDealPreview,
  selectedDeals = {},
  onToggleSelection,
  onSettingsClick,
}) => {
  // Berechne Gesamtwert der Deals in dieser Stage
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  
  // Hole Stage-Farbe
  const stageColor = getStageColor(stage.id, stage.slug);

  // Deal IDs für SortableContext
  const dealIds = deals.map(d => d.id);

  return (
    <KanbanColumnContainer
      id={stage.id}
      title={stage.name}
      count={deals.length}
      color={stageColor}
      totalValue={totalValue}
      onSettingsClick={onSettingsClick ? () => onSettingsClick(stage, deals) : undefined}
      showSettings={!!onSettingsClick}
    >
      <SortableContext 
        items={dealIds} 
        strategy={verticalListSortingStrategy}
      >
        {deals.map((deal) => (
          <KanbanItem 
            key={deal.id} 
            id={deal.id} 
            deal={deal}
          >
            <HubspotDealCard 
              deal={deal} 
              stageColor={stageColor}
              selected={!!selectedDeals[deal.id]}
              onToggle={onToggleSelection}
              onPreview={onDealPreview}
            />
          </KanbanItem>
        ))}
      </SortableContext>
    </KanbanColumnContainer>
  );
};

export default KanbanColumn;
