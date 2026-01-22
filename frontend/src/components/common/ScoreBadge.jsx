/**
 * Lead Score Badge Component
 * Displays score with color coding based on threshold
 */
import { Chip, Tooltip, Box } from '@mui/material';
import { TrendingUp, TrendingDown, Remove } from '@mui/icons-material';

const SCORE_CONFIG = {
  cold: { min: 0, max: 40, color: '#64748B', label: 'Cold' },
  warm: { min: 41, max: 80, color: '#F59E0B', label: 'Warm' },
  hot: { min: 81, max: 120, color: '#EF4444', label: 'Hot' },
  veryHot: { min: 121, max: 999, color: '#DC2626', label: 'Very Hot' },
};

const getScoreConfig = (score) => {
  if (score >= 121) return SCORE_CONFIG.veryHot;
  if (score >= 81) return SCORE_CONFIG.hot;
  if (score >= 41) return SCORE_CONFIG.warm;
  return SCORE_CONFIG.cold;
};

export const ScoreBadge = ({ score = 0, trend, showLabel = false, breakdown }) => {
  const config = getScoreConfig(score);
  
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Remove;
  const trendColor = trend > 0 ? '#28A745' : trend < 0 ? '#DC3545' : '#64748B';
  
  const tooltipContent = breakdown ? (
    <Box sx={{ p: 0.5 }}>
      <Box sx={{ mb: 0.5, fontWeight: 600 }}>Score Breakdown</Box>
      <Box sx={{ fontSize: '0.75rem' }}>
        <div>Demographic: {breakdown.demographic}/40</div>
        <div>Engagement: {breakdown.engagement}/60</div>
        <div>Behavior: {breakdown.behavior}/100</div>
      </Box>
    </Box>
  ) : `${config.label} Lead (${score} points)`;
  
  return (
    <Tooltip title={tooltipContent} arrow>
      <Chip
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span style={{ fontWeight: 600 }}>{score}</span>
            {showLabel && (
              <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                {config.label}
              </span>
            )}
            {trend !== undefined && trend !== 0 && (
              <TrendIcon sx={{ fontSize: 14, color: trendColor }} />
            )}
          </Box>
        }
        size="small"
        sx={{
          bgcolor: `${config.color}20`,
          color: config.color,
          fontWeight: 600,
          borderRadius: 1,
          border: `1px solid ${config.color}40`,
          '& .MuiChip-label': {
            px: 1,
          },
        }}
      />
    </Tooltip>
  );
};

export default ScoreBadge;
