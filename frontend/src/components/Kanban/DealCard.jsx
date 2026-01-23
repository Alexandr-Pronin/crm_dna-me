/**
 * Deal Card Component
 * "Dumme" Komponente - nur visuelle Darstellung
 * DnD-Logik wird extern über KanbanItem gesteuert
 */
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  Tooltip,
  LinearProgress,
  alpha,
} from '@mui/material';
import {
  CalendarToday as CalendarIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const DealCard = ({ deal, stageColor = '#6C5CE7', onClick }) => {
  const navigate = useNavigate();

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
      
      // Zeige relative Zeit für nahe Daten
      if (diffDays === 0) return 'Heute';
      if (diffDays === 1) return 'Morgen';
      if (diffDays === -1) return 'Gestern';
      if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} Tagen`;
      
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return null;
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Score-basierte Farbe
  const getScoreColor = (score) => {
    if (score >= 80) return '#10B981'; // Grün
    if (score >= 60) return '#F59E0B'; // Gelb
    if (score >= 40) return '#F97316'; // Orange
    return '#EF4444'; // Rot
  };

  const handleClick = (e) => {
    // Verhindere Navigation während Drag
    if (e.defaultPrevented) return;
    
    if (onClick) {
      onClick(deal);
    } else {
      navigate(`/deals/${deal.id}/show`);
    }
  };

  // Priorität ermitteln (falls vorhanden)
  const getPriorityInfo = () => {
    const priority = deal.priority || deal.urgency;
    if (!priority) return null;
    
    const priorities = {
      high: { label: 'Hoch', color: '#EF4444' },
      medium: { label: 'Mittel', color: '#F59E0B' },
      low: { label: 'Niedrig', color: '#10B981' },
    };
    
    return priorities[priority.toLowerCase()] || null;
  };

  const priorityInfo = getPriorityInfo();
  const score = deal.score ?? deal.lead_score;

  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'visible',
        // Hover-Effekte (keine Transitions für Performance)
        '&:hover': {
          boxShadow: `0 4px 16px ${alpha('#000', 0.1)}`,
          borderColor: alpha(stageColor, 0.5),
        },
      }}
    >
      {/* Farbiger Streifen oben */}
      <Box 
        sx={{ 
          height: 3, 
          bgcolor: stageColor,
          borderRadius: '8px 8px 0 0',
        }} 
      />
      
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header Row: Drag Handle + Title */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
          <DragIcon 
            sx={{ 
              fontSize: 20, 
              color: 'text.secondary',
              mt: 0.25,
              flexShrink: 0,
              opacity: 0.8,
              '&:hover': {
                opacity: 1,
                color: stageColor,
              },
            }} 
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              onDoubleClick={handleClick}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.4,
                color: 'text.primary',
                // Kein Cursor-Pointer - zeigt an, dass man Doppelklicken muss
                '&:hover': {
                  color: stageColor,
                },
              }}
            >
              {deal.title || deal.name || 'Untitled Deal'}
            </Typography>
            
            {/* Company Name (falls vorhanden) */}
            {(deal.company_name || deal.lead_company) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <BusinessIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {deal.company_name || deal.lead_company}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Deal Value - prominent */}
        {deal.value > 0 && (
          <Box sx={{ mb: 1.5, ml: 3.25 }}>
            <Typography 
              variant="h6" 
              fontWeight={700}
              sx={{ 
                color: stageColor,
                lineHeight: 1,
              }}
            >
              €{deal.value.toLocaleString('de-DE')}
            </Typography>
          </Box>
        )}

        {/* Contact Info */}
        {(deal.contact_name || deal.lead_name) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, ml: 3.25 }}>
            <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              {deal.contact_name || deal.lead_name}
            </Typography>
          </Box>
        )}

        {/* Email */}
        {(deal.lead_email || deal.contact_email) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, ml: 3.25 }}>
            <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {deal.lead_email || deal.contact_email}
            </Typography>
          </Box>
        )}

        {/* Score Bar (falls vorhanden) */}
        {score !== undefined && score !== null && (
          <Box sx={{ mt: 1.5, mb: 1, ml: 3.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TrendingUpIcon sx={{ fontSize: 14, color: getScoreColor(score) }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Score
                </Typography>
              </Box>
              <Typography 
                variant="caption" 
                fontWeight={700}
                sx={{ color: getScoreColor(score) }}
              >
                {score}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={score}
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: alpha(getScoreColor(score), 0.15),
                '& .MuiLinearProgress-bar': {
                  bgcolor: getScoreColor(score),
                  borderRadius: 2,
                },
              }}
            />
          </Box>
        )}

        {/* Footer Row: Avatar + Date + Priority */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mt: 1.5,
            ml: 3.25,
            pt: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Avatar + Name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {deal.assigned_to_name && (
              <Tooltip title={deal.assigned_to_name}>
                <Avatar
                  sx={{
                    width: 24,
                    height: 24,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: stageColor,
                    color: 'white',
                  }}
                >
                  {getInitials(deal.assigned_to_name)}
                </Avatar>
              </Tooltip>
            )}
            
            {/* Expected Close Date */}
            {deal.expected_close && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatDate(deal.expected_close)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Priority Badge */}
          {priorityInfo && (
            <Chip
              label={priorityInfo.label}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: alpha(priorityInfo.color, 0.1),
                color: priorityInfo.color,
                border: 'none',
              }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default DealCard;
