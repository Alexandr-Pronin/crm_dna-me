/**
 * Generic Status Badge Component
 */
import { Chip } from '@mui/material';

const STATUS_COLORS = {
  // Lead Status
  new: { bg: '#4A90A420', color: '#4A90A4', label: 'New' },
  contacted: { bg: '#6C5CE720', color: '#6C5CE7', label: 'Contacted' },
  qualified: { bg: '#28A74520', color: '#28A745', label: 'Qualified' },
  nurturing: { bg: '#F59E0B20', color: '#F59E0B', label: 'Nurturing' },
  customer: { bg: '#17A2B820', color: '#17A2B8', label: 'Customer' },
  churned: { bg: '#DC354520', color: '#DC3545', label: 'Churned' },
  
  // Lifecycle Stage
  lead: { bg: '#64748B20', color: '#64748B', label: 'Lead' },
  mql: { bg: '#F59E0B20', color: '#F59E0B', label: 'MQL' },
  sql: { bg: '#EF444420', color: '#EF4444', label: 'SQL' },
  opportunity: { bg: '#6C5CE720', color: '#6C5CE7', label: 'Opportunity' },
  
  // Routing Status
  pending: { bg: '#F59E0B20', color: '#F59E0B', label: 'Pending' },
  routed: { bg: '#28A74520', color: '#28A745', label: 'Routed' },
  manual: { bg: '#6C5CE720', color: '#6C5CE7', label: 'Manual' },
  
  // Intent
  research: { bg: '#4A90A420', color: '#4A90A4', label: 'Research' },
  b2b: { bg: '#6C5CE720', color: '#6C5CE7', label: 'B2B' },
  co_creation: { bg: '#28A74520', color: '#28A745', label: 'Co-Creation' },
  
  // Default
  default: { bg: '#64748B20', color: '#64748B', label: 'Unknown' },
};

export const StatusBadge = ({ status, variant = 'filled' }) => {
  const config = STATUS_COLORS[status] || STATUS_COLORS.default;
  const displayLabel = config.label || status;
  
  return (
    <Chip
      label={displayLabel}
      size="small"
      variant={variant === 'outlined' ? 'outlined' : 'filled'}
      sx={{
        bgcolor: variant === 'outlined' ? 'transparent' : config.bg,
        color: config.color,
        borderColor: config.color,
        fontWeight: 500,
        fontSize: '0.75rem',
        height: 24,
        '& .MuiChip-label': {
          px: 1,
        },
      }}
    />
  );
};

export default StatusBadge;
