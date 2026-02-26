/**
 * Letzte Aktivitäten – zeigt alle relevanten Events (Lead-Notizen, Import, Portal, etc.)
 * Für CRM: Kundenaktivität, DB-Updates, später erweiterbar um System-Events (Login, neue User).
 */
import { useState, useEffect, useCallback } from 'react';
import { useDataProvider } from 'react-admin';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  List as MuiList,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Pagination,
  Link,
} from '@mui/material';
import { Refresh as RefreshIcon, EventNote as EventNoteIcon } from '@mui/icons-material';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { de } from 'date-fns/locale';

const SOURCE_LABELS = {
  waalaxy: 'Waalaxy',
  portal: 'Portal',
  lemlist: 'Lemlist',
  ads: 'Ads',
  conference: 'Conference',
  website: 'Website',
  linkedin: 'LinkedIn',
  manual: 'Manual',
  api: 'API',
  import: 'Import',
  imap: 'E-Mail',
  trigger: 'Automatisierung',
  system: 'System',
};

const formatRelativeTime = (value) => {
  if (!value) return 'Unbekannt';
  const dateValue = typeof value === 'string' ? parseISO(value) : new Date(value);
  if (!isValid(dateValue)) return 'Unbekannt';
  return formatDistanceToNow(dateValue, { addSuffix: true, locale: de });
};

const EVENT_TYPE_LABELS = {
  eml_import: 'E-Mail importiert',
  note_created: 'Notiz erstellt',
  email_sent: 'E-Mail gesendet',
  email_received: 'E-Mail erhalten',
  lead_created: 'Lead erstellt',
  deal_created: 'Deal erstellt',
  deal_notification_sent: 'Deal-Benachrichtigung gesendet',
  enrolled_in_sequence: 'In E-Mail-Sequenz eingeschrieben',
  team_member_registered: 'Neuer Benutzer registriert',
  team_member_created: 'Neues Teammitglied hinzugefügt',
};

const humanizeEventType = (eventType, metadata) => {
  if (!eventType) return 'Aktivität aktualisiert';
  if (metadata?.label) return metadata.label;
  if (EVENT_TYPE_LABELS[eventType]) return EVENT_TYPE_LABELS[eventType];
  return eventType
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const buildLeadLabel = (lead, metadata) => {
  if (lead) {
    const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
    if (fullName && lead.email) return `${fullName} (${lead.email})`;
    if (fullName) return fullName;
    return lead.email || lead.id || 'Unbekannter Lead';
  }
  if (metadata?.team_member_name || metadata?.team_member_email) {
    const name = metadata.team_member_name || '';
    const email = metadata.team_member_email || '';
    return name && email ? `${name} (${email})` : name || email || 'System';
  }
  return 'System';
};

const ACTIVITIES_PER_PAGE = 10;

const RecentActivitiesCard = () => {
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const dataProvider = useDataProvider();

  const loadRecentActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, total: totalCount } = await dataProvider.getList('events', {
        pagination: { page, perPage: ACTIVITIES_PER_PAGE },
        sort: { field: 'occurred_at', order: 'DESC' },
        filter: {},
      });
      setRecentActivities(Array.isArray(data) ? data : []);
      setTotal(totalCount ?? 0);
    } catch (err) {
      console.error('Failed to load recent activities:', err);
      setError('Aktivitäten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [dataProvider, page]);

  useEffect(() => {
    loadRecentActivities();
  }, [loadRecentActivities]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Letzte Aktivitäten</Typography>
          <Tooltip title="Aktivitäten aktualisieren">
            <IconButton size="small" onClick={loadRecentActivities} disabled={loading} aria-label="Aktivitäten aktualisieren">
              {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {!error && (
          <MuiList disablePadding>
            {recentActivities.length === 0 && !loading && (
              <ListItem>
                <ListItemText primary="Keine Aktivitäten gefunden." />
              </ListItem>
            )}

            {recentActivities.map((entry, index) => {
              const eventLabel = humanizeEventType(entry.event_type, entry.metadata);
              const leadLabel = buildLeadLabel(entry.lead, entry.metadata);
              const sourceLabel = entry.source
                ? SOURCE_LABELS[entry.source] || entry.source
                : null;
              const meta = entry.metadata || {};
              const detail =
                entry.event_type === 'deal_created' && meta.deal_name
                  ? `„${meta.deal_name}"`
                  : (meta.subject ? `„${meta.subject}"` : null);
              const secondaryText = [
                formatRelativeTime(entry.occurred_at),
                sourceLabel ? `Quelle: ${sourceLabel}` : null,
                detail,
              ]
                .filter(Boolean)
                .join(' • ');
              const leadUrl = entry.lead?.id ? `#/leads/${entry.lead.id}/show` : null;

              return (
                <Box key={entry.id}>
                  <ListItem alignItems="flex-start" disableGutters>
                    <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                      <EventNoteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          <Typography component="span" variant="body1">
                            {leadLabel}
                          </Typography>
                          <Typography component="span" variant="body1" color="text.secondary">
                            —
                          </Typography>
                          <Typography component="span" variant="body1">
                            {eventLabel}
                          </Typography>
                          {sourceLabel && (
                            <Chip size="small" label={sourceLabel} sx={{ ml: 0.5 }} />
                          )}
                        </Box>
                      }
                      secondary={secondaryText}
                    />
                    {leadUrl ? (
                      <Link
                        href={leadUrl}
                        underline="hover"
                        sx={{ ml: 1, alignSelf: 'center', whiteSpace: 'nowrap' }}
                      >
                        Lead öffnen
                      </Link>
                    ) : null}
                  </ListItem>
                  {index < recentActivities.length - 1 && <Divider component="li" />}
                </Box>
              );
            })}
          </MuiList>
        )}

        {total > ACTIVITIES_PER_PAGE && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination
              count={Math.max(1, Math.ceil(total / ACTIVITIES_PER_PAGE))}
              page={page}
              onChange={(_, p) => setPage(p)}
              color="primary"
              size="small"
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivitiesCard;
