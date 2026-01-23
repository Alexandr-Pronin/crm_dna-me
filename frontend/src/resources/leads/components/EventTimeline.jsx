/**
 * Event Timeline Component
 * Chronological timeline of marketing events with expandable metadata
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
  Collapse,
  IconButton,
} from '@mui/material';
import {
  // Event Type Icons
  Web as WebIcon,
  Email as EmailIcon,
  LinkedIn as LinkedInIcon,
  Handshake as SalesIcon,
  Campaign as AdsIcon,
  Event as ConferenceIcon,
  CloudUpload as ApiIcon,
  Edit as ManualIcon,
  Upload as ImportIcon,
  // Generic Icons
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Source as SourceIcon,
  // Event Action Icons
  Visibility as PageViewIcon,
  Description as FormIcon,
  Download as DownloadIcon,
  PlayCircle as VideoIcon,
  Send as SendIcon,
  MarkEmailRead as OpenedIcon,
  TouchApp as ClickedIcon,
  Reply as ReplyIcon,
  PersonAdd as ConnectionIcon,
  Check as AcceptedIcon,
  Message as MessageIcon,
  CalendarMonth as MeetingIcon,
  Phone as CallIcon,
  RequestQuote as ProposalIcon,
  Gavel as ContractIcon,
  ThumbUp as WonIcon,
  ThumbDown as LostIcon,
  PersonAddAlt as RegisteredIcon,
  ShoppingCart as OrderIcon,
  CreditCard as SubscriptionIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';
import { getLeadEvents } from '../../../providers/dataProvider';

// Source configuration with colors and icons
const SOURCE_CONFIG = {
  waalaxy: {
    label: 'Waalaxy',
    color: '#FF6B35',
    bgColor: '#FF6B3520',
    icon: LinkedInIcon,
  },
  portal: {
    label: 'Portal',
    color: '#4A90A4',
    bgColor: '#4A90A420',
    icon: WebIcon,
  },
  lemlist: {
    label: 'Lemlist',
    color: '#9B59B6',
    bgColor: '#9B59B620',
    icon: EmailIcon,
  },
  ads: {
    label: 'Ads',
    color: '#F1C40F',
    bgColor: '#F1C40F20',
    icon: AdsIcon,
  },
  conference: {
    label: 'Conference',
    color: '#E74C3C',
    bgColor: '#E74C3C20',
    icon: ConferenceIcon,
  },
  website: {
    label: 'Website',
    color: '#3498DB',
    bgColor: '#3498DB20',
    icon: WebIcon,
  },
  linkedin: {
    label: 'LinkedIn',
    color: '#0A66C2',
    bgColor: '#0A66C220',
    icon: LinkedInIcon,
  },
  manual: {
    label: 'Manual',
    color: '#95A5A6',
    bgColor: '#95A5A620',
    icon: ManualIcon,
  },
  api: {
    label: 'API',
    color: '#27AE60',
    bgColor: '#27AE6020',
    icon: ApiIcon,
  },
  import: {
    label: 'Import',
    color: '#8E44AD',
    bgColor: '#8E44AD20',
    icon: ImportIcon,
  },
};

// Event type to icon mapping
const getEventIcon = (eventType) => {
  const iconMap = {
    // Website Events
    page_visited: PageViewIcon,
    form_submitted: FormIcon,
    demo_requested: MeetingIcon,
    pricing_viewed: PageViewIcon,
    roi_calculator_submitted: FormIcon,
    download_completed: DownloadIcon,
    video_watched: VideoIcon,
    // Email Events
    email_sent: SendIcon,
    email_opened: OpenedIcon,
    email_clicked: ClickedIcon,
    email_replied: ReplyIcon,
    email_bounced: EmailIcon,
    email_unsubscribed: EmailIcon,
    // LinkedIn Events
    linkedin_connection_sent: ConnectionIcon,
    linkedin_connection_accepted: AcceptedIcon,
    linkedin_message_sent: MessageIcon,
    linkedin_message_replied: ReplyIcon,
    linkedin_profile_viewed: PageViewIcon,
    // Sales Events
    meeting_scheduled: MeetingIcon,
    meeting_completed: MeetingIcon,
    call_completed: CallIcon,
    proposal_sent: ProposalIcon,
    contract_sent: ContractIcon,
    deal_won: WonIcon,
    deal_lost: LostIcon,
    note_created: ManualIcon,
    // Product Events
    user_registered: RegisteredIcon,
    order_placed: OrderIcon,
    order_completed: OrderIcon,
    subscription_started: SubscriptionIcon,
    subscription_cancelled: SubscriptionIcon,
    // Marketing Events
    webinar_registered: ConferenceIcon,
    webinar_attended: ConferenceIcon,
    conference_visited: ConferenceIcon,
    trade_show_scanned: ConferenceIcon,
  };
  return iconMap[eventType] || SourceIcon;
};

// Get human-readable event label
const getEventLabel = (eventType) => {
  const labels = {
    // Website Events
    page_visited: 'Page Visited',
    form_submitted: 'Form Submitted',
    demo_requested: 'Demo Requested',
    pricing_viewed: 'Pricing Viewed',
    roi_calculator_submitted: 'ROI Calculator Submitted',
    download_completed: 'Download Completed',
    video_watched: 'Video Watched',
    // Email Events
    email_sent: 'Email Sent',
    email_opened: 'Email Opened',
    email_clicked: 'Email Clicked',
    email_replied: 'Email Replied',
    email_bounced: 'Email Bounced',
    email_unsubscribed: 'Unsubscribed',
    // LinkedIn Events
    linkedin_connection_sent: 'Connection Request Sent',
    linkedin_connection_accepted: 'Connection Accepted',
    linkedin_message_sent: 'Message Sent',
    linkedin_message_replied: 'Message Replied',
    linkedin_profile_viewed: 'Profile Viewed',
    // Sales Events
    meeting_scheduled: 'Meeting Scheduled',
    meeting_completed: 'Meeting Completed',
    call_completed: 'Call Completed',
    proposal_sent: 'Proposal Sent',
    contract_sent: 'Contract Sent',
    deal_won: 'Deal Won',
    deal_lost: 'Deal Lost',
    note_created: 'Note',
    // Product Events
    user_registered: 'User Registered',
    order_placed: 'Order Placed',
    order_completed: 'Order Completed',
    subscription_started: 'Subscription Started',
    subscription_cancelled: 'Subscription Cancelled',
    // Marketing Events
    webinar_registered: 'Webinar Registered',
    webinar_attended: 'Webinar Attended',
    conference_visited: 'Conference Visited',
    trade_show_scanned: 'Trade Show Scanned',
  };
  // Format unknown event types: replace underscores and capitalize
  return labels[eventType] || eventType.split('_').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
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
 * Metadata Display Component
 */
const MetadataDisplay = ({ metadata }) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No additional metadata
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {Object.entries(metadata).map(([key, value]) => (
        <Box
          key={key}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
            p: 1,
            bgcolor: 'background.default',
            borderRadius: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              minWidth: 100,
              textTransform: 'capitalize',
            }}
          >
            {key.replace(/_/g, ' ')}:
          </Typography>
          <Typography
            variant="caption"
            sx={{
              flex: 1,
              wordBreak: 'break-word',
              fontFamily: typeof value === 'object' ? 'monospace' : 'inherit',
            }}
          >
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

/**
 * Single Timeline Entry
 */
const TimelineEntry = ({ event, isLast }) => {
  const [expanded, setExpanded] = useState(false);
  
  const source = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.manual;
  const EventIcon = getEventIcon(event.event_type);
  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
  const hasCampaign = event.campaign_id || event.utm_campaign || event.utm_source;

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
      <Tooltip title={source.label}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            bgcolor: source.bgColor,
            border: `2px solid ${source.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            zIndex: 1,
          }}
        >
          <EventIcon sx={{ fontSize: 18, color: source.color }} />
        </Box>
      </Tooltip>

      {/* Content */}
      <Box sx={{ flex: 1, ml: 2, pb: 3 }}>
        <Box
          sx={{
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: expanded ? source.color : 'divider',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: source.color,
              boxShadow: `0 2px 8px ${source.color}20`,
            },
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                {getEventLabel(event.event_type)}
              </Typography>
              {event.event_category && (
                <Typography variant="caption" color="text.secondary">
                  {event.event_category}
                </Typography>
              )}
            </Box>
            
            {/* Score points badge (if present) */}
            {event.score_points > 0 && (
              <Chip
                label={`+${event.score_points}`}
                size="small"
                sx={{
                  bgcolor: '#28A74520',
                  color: '#28A745',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
            )}
          </Box>

          {/* Source and Campaign Info */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            {/* Source chip */}
            <Chip
              icon={<source.icon sx={{ fontSize: 14 }} />}
              label={source.label}
              size="small"
              sx={{
                bgcolor: source.bgColor,
                color: source.color,
                fontSize: '0.7rem',
                height: 22,
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />

            {/* Campaign info */}
            {hasCampaign && (
              <Chip
                label={event.utm_campaign || event.campaign_id || `${event.utm_source}/${event.utm_medium}`}
                size="small"
                variant="outlined"
                sx={{
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            )}

            {/* Time */}
            <Tooltip title={formatDate(event.occurred_at)}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeTime(event.occurred_at)}
                </Typography>
              </Box>
            </Tooltip>
          </Box>

          {/* Expand/Collapse Button for Metadata */}
          {(hasMetadata || hasCampaign) && (
            <Box sx={{ mt: 1 }}>
              <IconButton
                onClick={() => setExpanded(!expanded)}
                size="small"
                sx={{
                  p: 0.5,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: source.bgColor,
                  },
                }}
              >
                {expanded ? (
                  <ExpandLessIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                )}
                <Typography variant="caption" sx={{ ml: 0.5, mr: 0.5 }}>
                  {expanded ? 'Hide Details' : 'Show Details'}
                </Typography>
              </IconButton>

              <Collapse in={expanded}>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
                  {/* UTM Details */}
                  {hasCampaign && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
                        Campaign Tracking
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {event.campaign_id && (
                          <Chip label={`Campaign: ${event.campaign_id}`} size="small" variant="outlined" />
                        )}
                        {event.utm_source && (
                          <Chip label={`Source: ${event.utm_source}`} size="small" variant="outlined" />
                        )}
                        {event.utm_medium && (
                          <Chip label={`Medium: ${event.utm_medium}`} size="small" variant="outlined" />
                        )}
                        {event.utm_campaign && (
                          <Chip label={`UTM Campaign: ${event.utm_campaign}`} size="small" variant="outlined" />
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Metadata */}
                  {hasMetadata && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
                        Event Metadata
                      </Typography>
                      <MetadataDisplay metadata={event.metadata} />
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Source Filter Buttons
 */
const SourceFilter = ({ selectedSource, onChange, availableSources }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <FilterIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          Filter by Source
        </Typography>
      </Box>
      <ToggleButtonGroup
        value={selectedSource}
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
        {availableSources.map((sourceKey) => {
          const config = SOURCE_CONFIG[sourceKey];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <ToggleButton
              key={sourceKey}
              value={sourceKey}
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
const EventSummary = ({ events }) => {
  if (!events || events.length === 0) return null;

  const stats = events.reduce(
    (acc, event) => {
      acc.total += 1;
      if (event.source) {
        acc.bySource[event.source] = (acc.bySource[event.source] || 0) + 1;
      }
      acc.totalPoints += event.score_points || 0;
      return acc;
    },
    { total: 0, bySource: {}, totalPoints: 0 }
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
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" color="text.secondary">
          Total Events
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {stats.total}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 80 }}>
        <Typography variant="caption" color="text.secondary">
          Score Impact
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, color: stats.totalPoints > 0 ? '#28A745' : 'text.secondary' }}>
          {stats.totalPoints > 0 ? '+' : ''}{stats.totalPoints}
        </Typography>
      </Box>
      {Object.entries(stats.bySource)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([sourceKey, count]) => {
          const config = SOURCE_CONFIG[sourceKey];
          if (!config) return null;
          return (
            <Box key={sourceKey} sx={{ minWidth: 70 }}>
              <Typography variant="caption" color="text.secondary">
                {config.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, color: config.color }}>
                {count}
              </Typography>
            </Box>
          );
        })}
    </Box>
  );
};

/**
 * Main Event Timeline Component
 */
const EventTimeline = ({ leadId, limit = 50 }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!leadId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getLeadEvents(leadId, { limit });
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [leadId, limit]);

  // Get available sources from events
  const availableSources = [...new Set(events.map((e) => e.source))].filter(Boolean);

  // Filter events by source
  const filteredEvents = selectedSource
    ? events.filter((event) => event.source === selectedSource)
    : events;

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
            <Typography sx={{ ml: 2 }} color="text.secondary">
              Loading events...
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
          Marketing Events
        </Typography>

        {/* Summary */}
        <EventSummary events={events} />

        {/* Source Filter */}
        {availableSources.length > 1 && (
          <SourceFilter
            selectedSource={selectedSource}
            onChange={setSelectedSource}
            availableSources={availableSources}
          />
        )}

        {/* Timeline */}
        {filteredEvents.length === 0 ? (
          <Box
            sx={{
              py: 4,
              textAlign: 'center',
              bgcolor: 'background.default',
              borderRadius: 2,
            }}
          >
            <Typography color="text.secondary">
              {selectedSource
                ? `No events from ${SOURCE_CONFIG[selectedSource]?.label || selectedSource} found`
                : 'No events recorded yet'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {filteredEvents.map((event, index) => (
              <TimelineEntry
                key={event.id || index}
                event={event}
                isLast={index === filteredEvents.length - 1}
              />
            ))}
          </Box>
        )}

        {/* Load more hint */}
        {filteredEvents.length >= limit && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Showing last {limit} events
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default EventTimeline;
export { EventTimeline, SOURCE_CONFIG, getEventLabel, getEventIcon };
