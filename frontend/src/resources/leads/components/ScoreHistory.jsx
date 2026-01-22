/**
 * Score History Component
 * Timeline visualization of lead score changes with category filtering
 */
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Person as PersonIcon,
  TouchApp as EngagementIcon,
  Psychology as BehaviorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { getScoreHistory } from '../../../providers/dataProvider';

// Category configuration with colors and icons
const CATEGORY_CONFIG = {
  demographic: {
    label: 'Demographic',
    color: '#4A90A4',
    bgColor: '#4A90A420',
    icon: PersonIcon,
    description: 'Profile-based scoring (Industry, Company Size, Job Title)',
  },
  engagement: {
    label: 'Engagement',
    color: '#6C5CE7',
    bgColor: '#6C5CE720',
    icon: EngagementIcon,
    description: 'Interaction-based scoring (Page Views, Downloads, Events)',
  },
  behavior: {
    label: 'Behavior',
    color: '#28A745',
    bgColor: '#28A74520',
    icon: BehaviorIcon,
    description: 'Pattern-based scoring (Multi-visit, Cross-channel)',
  },
};

/**
 * Parse and format date safely
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return 'Unknown';
    return format(date, 'dd.MM.yyyy HH:mm', { locale: de });
  } catch {
    return 'Unknown';
  }
};

/**
 * Format relative time
 */
const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    if (!isValid(date)) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: de });
  } catch {
    return '';
  }
};

/**
 * Single Timeline Entry
 */
const TimelineEntry = ({ entry, isLast }) => {
  const category = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.engagement;
  const CategoryIcon = category.icon;
  const isPositive = entry.points_awarded > 0;

  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      {/* Timeline line */}
      {!isLast && (
        <Box
          sx={{
            position: 'absolute',
            left: 19,
            top: 40,
            bottom: -16,
            width: 2,
            bgcolor: 'divider',
            zIndex: 0,
          }}
        />
      )}

      {/* Timeline dot with icon */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: category.bgColor,
          border: `2px solid ${category.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <CategoryIcon sx={{ fontSize: 18, color: category.color }} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, ml: 2, pb: 3 }}>
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: category.color,
              boxShadow: `0 2px 8px ${category.color}20`,
            },
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {entry.rule_name || entry.scoring_rule?.name || 'Score Change'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {entry.rule_slug || entry.scoring_rule?.slug || ''}
              </Typography>
            </Box>
            
            {/* Points badge */}
            <Chip
              icon={isPositive ? <TrendingUpIcon sx={{ fontSize: 14 }} /> : <TrendingDownIcon sx={{ fontSize: 14 }} />}
              label={`${isPositive ? '+' : ''}${entry.points_awarded}`}
              size="small"
              sx={{
                bgcolor: isPositive ? '#28A74520' : '#DC354520',
                color: isPositive ? '#28A745' : '#DC3545',
                fontWeight: 700,
                fontSize: '0.8rem',
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
          </Box>

          {/* Description if available */}
          {entry.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {entry.description}
            </Typography>
          )}

          {/* Footer with meta info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* Category chip */}
            <Tooltip title={category.description}>
              <Chip
                label={category.label}
                size="small"
                sx={{
                  bgcolor: category.bgColor,
                  color: category.color,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            </Tooltip>

            {/* Time */}
            <Tooltip title={formatDate(entry.created_at || entry.applied_at)}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeTime(entry.created_at || entry.applied_at)}
                </Typography>
              </Box>
            </Tooltip>

            {/* Expiration if present */}
            {entry.expires_at && (
              <Typography variant="caption" color="warning.main">
                Expires: {formatDate(entry.expires_at)}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Category Filter Buttons
 */
const CategoryFilter = ({ selectedCategory, onChange }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <FilterIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          Filter by Category
        </Typography>
      </Box>
      <ToggleButtonGroup
        value={selectedCategory}
        exclusive
        onChange={(_, value) => onChange(value)}
        size="small"
        sx={{
          flexWrap: 'wrap',
          gap: 1,
          '& .MuiToggleButton-root': {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px !important',
            px: 2,
            py: 0.75,
            textTransform: 'none',
            '&.Mui-selected': {
              borderColor: 'primary.main',
            },
          },
        }}
      >
        <ToggleButton value={null}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            All
          </Typography>
        </ToggleButton>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <ToggleButton
              key={key}
              value={key}
              sx={{
                '&.Mui-selected': {
                  bgcolor: config.bgColor,
                  color: config.color,
                  borderColor: `${config.color} !important`,
                },
              }}
            >
              <Icon sx={{ fontSize: 16, mr: 0.75 }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {config.label}
              </Typography>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
};

/**
 * Summary Stats
 */
const ScoreSummary = ({ history }) => {
  if (!history || history.length === 0) return null;

  const stats = history.reduce(
    (acc, entry) => {
      const points = entry.points_awarded || 0;
      acc.total += points;
      if (entry.category) {
        acc.byCategory[entry.category] = (acc.byCategory[entry.category] || 0) + points;
      }
      return acc;
    },
    { total: 0, byCategory: {} }
  );

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 3,
        p: 2,
        bgcolor: 'background.default',
        borderRadius: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ minWidth: 100 }}>
        <Typography variant="caption" color="text.secondary">
          Total Points
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {stats.total > 0 ? '+' : ''}{stats.total}
        </Typography>
      </Box>
      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
        const points = stats.byCategory[key] || 0;
        if (points === 0) return null;
        return (
          <Box key={key} sx={{ minWidth: 80 }}>
            <Typography variant="caption" color="text.secondary">
              {config.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: config.color }}>
              {points > 0 ? '+' : ''}{points}
            </Typography>
          </Box>
        );
      })}
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" color="text.secondary">
          Events
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {history.length}
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * Main Score History Component
 */
const ScoreHistory = ({ leadId, limit = 50 }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!leadId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getScoreHistory(leadId, { limit });
        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch score history:', err);
        setError(err.message || 'Failed to load score history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [leadId, limit]);

  // Filter history by category
  const filteredHistory = selectedCategory
    ? history.filter((entry) => entry.category === selectedCategory)
    : history;

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
            <Typography sx={{ ml: 2 }} color="text.secondary">
              Loading score history...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ mb: 0 }}>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Score History
        </Typography>

        {/* Summary */}
        <ScoreSummary history={history} />

        {/* Category Filter */}
        <CategoryFilter selectedCategory={selectedCategory} onChange={setSelectedCategory} />

        {/* Timeline */}
        {filteredHistory.length === 0 ? (
          <Box
            sx={{
              py: 4,
              textAlign: 'center',
              bgcolor: 'background.default',
              borderRadius: 2,
            }}
          >
            <Typography color="text.secondary">
              {selectedCategory
                ? `No ${CATEGORY_CONFIG[selectedCategory]?.label || ''} score events found`
                : 'No score history available'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {filteredHistory.map((entry, index) => (
              <TimelineEntry
                key={entry.id || index}
                entry={entry}
                isLast={index === filteredHistory.length - 1}
              />
            ))}
          </Box>
        )}

        {/* Load more hint */}
        {filteredHistory.length >= limit && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Showing last {limit} entries
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreHistory;
export { ScoreHistory, CATEGORY_CONFIG };
