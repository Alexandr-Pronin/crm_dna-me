/**
 * Pipeline Configurations
 * Three product pipelines as defined in FRONTEND_PLAN.md
 */

export const PIPELINES = {
  'research-lab': {
    id: 'research-lab',
    name: 'Research Lab Services',
    description: 'Academic researchers, PhD students - transactional',
    orderSize: '24-96 samples',
    salesCycle: '7-14 days',
    priceRange: '€75-120 per sample',
    stages: [
      { id: 'awareness', name: 'Awareness', order: 1 },
      { id: 'interest', name: 'Interest', order: 2 },
      { id: 'consideration', name: 'Consideration', order: 3 },
      { id: 'decision', name: 'Decision', order: 4 },
      { id: 'purchase', name: 'Purchase', order: 5 },
      { id: 'won', name: 'Won', order: 6 },
    ],
  },
  'b2b-lab': {
    id: 'b2b-lab',
    name: 'B2B Lab Enablement',
    description: 'Biotech companies, CROs - subscription',
    orderSize: '500-2000 samples/month',
    salesCycle: '30-60 days',
    priceRange: '€50-80 per sample',
    stages: [
      { id: 'awareness', name: 'Awareness', order: 1 },
      { id: 'qualification', name: 'Qualification (MQL)', order: 2 },
      { id: 'discovery', name: 'Discovery (SQL)', order: 3 },
      { id: 'technical_validation', name: 'Technical Validation', order: 4 },
      { id: 'commercial_negotiation', name: 'Commercial Negotiation', order: 5 },
      { id: 'contract_sent', name: 'Contract Sent', order: 6 },
      { id: 'won', name: 'Won', order: 7 },
    ],
  },
  'co-creation': {
    id: 'co-creation',
    name: 'Panel Co-Creation',
    description: 'Regional labs, white-label partnership',
    orderSize: 'Revenue share',
    salesCycle: '90-180 days',
    priceRange: '50/50 revenue split',
    stages: [
      { id: 'awareness', name: 'Awareness', order: 1 },
      { id: 'qualification', name: 'Qualification', order: 2 },
      { id: 'partnership_discussion', name: 'Partnership Discussion', order: 3 },
      { id: 'due_diligence', name: 'Due Diligence', order: 4 },
      { id: 'pilot_partnership', name: 'Pilot Partnership', order: 5 },
      { id: 'contract_negotiation', name: 'Contract Negotiation', order: 6 },
      { id: 'won', name: 'Won', order: 7 },
    ],
  },
};

export const PIPELINE_LIST = Object.values(PIPELINES);

export const getPipelineById = (id) => PIPELINES[id] || null;

export const getPipelineStages = (pipelineId) => {
  const pipeline = PIPELINES[pipelineId];
  return pipeline?.stages || [];
};

export default PIPELINES;
