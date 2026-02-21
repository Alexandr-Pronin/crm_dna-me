/**
 * ImportedNoteCard
 *
 * Card on the lead show page to add a note that is imported into the chat
 * as an internal_note (Notiz) with an "imported" marker.
 */
import { useState } from 'react';
import { useRecordContext, useNotify } from 'react-admin';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField as MuiTextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import { StickyNote2 as NoteIcon, CallMade as ImportIcon } from '@mui/icons-material';
import { API_URL, httpClient } from '../../../providers/dataProvider';

export default function ImportedNoteCard({ onImported }) {
  const record = useRecordContext();
  const notify = useNotify();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!record?.id) return null;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);

    try {
      const params = new URLSearchParams({ lead_id: record.id, limit: '1', sort_by: 'last_message_at', sort_order: 'desc' });
      const { json: listJson } = await httpClient(`${API_URL}/conversations?${params}`);
      const conversations = listJson?.data ?? [];
      let conversationId = conversations[0]?.id;

      if (!conversationId) {
        const { json: createJson } = await httpClient(`${API_URL}/conversations`, {
          method: 'POST',
          body: JSON.stringify({
            lead_id: record.id,
            type: 'internal',
            subject: 'Importierte Notizen',
          }),
        });
        const created = createJson?.data ?? createJson;
        conversationId = created?.id;
      }

      if (!conversationId) {
        setError('Konversation konnte nicht erstellt werden.');
        setSaving(false);
        return;
      }

      const bodyHtml = trimmed.replace(/\n/g, '<br/>');
      await httpClient(`${API_URL}/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message_type: 'internal_note',
          direction: 'internal',
          body_text: trimmed,
          body_html: bodyHtml.startsWith('<') ? bodyHtml : `<p>${bodyHtml}</p>`,
          metadata: { imported: true },
        }),
      });

      setText('');
      notify('Notiz wurde in den Chat importiert.', { type: 'success' });
      onImported?.();
    } catch (err) {
      console.error('Imported note failed:', err);
      setError(err?.message || 'Notiz konnte nicht importiert werden.');
      notify(err?.message || 'Import fehlgeschlagen', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <NoteIcon color="action" />
          <Typography variant="h6"> Alte Nachrichten in Chat importieren</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Text wird als Notiz in den Chat übernommen und dort als „Importiert“ gekennzeichnet.
        </Typography>
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <MuiTextField
          fullWidth
          multiline
          minRows={3}
          maxRows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nachrichtentext eingeben…"
          size="small"
          disabled={saving}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={16} /> : <ImportIcon />}
          onClick={handleSubmit}
          disabled={saving || !text.trim()}
        >
          {saving ? 'Wird importiert…' : 'Als Notiz in Chat übernehmen'}
        </Button>
      </CardContent>
    </Card>
  );
}
