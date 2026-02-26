/**
 * EmailImportDialog
 *
 * Dialog with Drag-and-Drop for .eml files. For a single file: parse → show preview
 * (name, company) → then import. For multiple files: import with defaults.
 * Company can be selected from existing or created from suggested domain (e.g. @dna-me.net → dna-me).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Collapse,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Email as EmailIcon,
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  ErrorOutline as ErrorIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  Business as BusinessIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { API_URL, httpClient } from '../../../providers/dataProvider';
import { useDataProvider } from 'react-admin';

const ALLOWED_EXTENSIONS = ['.eml'];
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

const COMPANY_CHOICE_NONE = 'none';
const COMPANY_CHOICE_EXISTING = 'existing';
const COMPANY_CHOICE_NEW = 'new';

export default function EmailImportDialog({ open, onClose, onImported }) {
  const dataProvider = useDataProvider();
  const [step, setStep] = useState('drop'); // 'drop' | 'preview' | 'result'
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);

  // Single-file preview: { eml_raw, parsed, fileName }
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    company_choice: COMPANY_CHOICE_NONE,
    organization_id: '',
    new_organization_name: '',
    new_organization_domain: '',
  });

  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  const reset = useCallback(() => {
    setStep('drop');
    setDragActive(false);
    setParsing(false);
    setImporting(false);
    setResults([]);
    setPreview(null);
    setForm({
      first_name: '',
      last_name: '',
      company_choice: COMPANY_CHOICE_NONE,
      organization_id: '',
      new_organization_name: '',
      new_organization_domain: '',
    });
    setError(null);
    dragCounter.current = 0;
  }, []);

  const handleClose = useCallback(() => {
    if (importing || parsing) return;
    const hadImports = results.some((r) => r.success && !r.duplicate);
    reset();
    onClose?.();
    if (hadImports) onImported?.();
  }, [importing, parsing, results, reset, onClose, onImported]);

  // Load organizations when preview step is shown
  useEffect(() => {
    if (step !== 'preview' || !open) return;
    setOrganizationsLoading(true);
    dataProvider
      .getList('organizations', {
        pagination: { page: 1, perPage: 500 },
        sort: { field: 'name', order: 'ASC' },
      })
      .then(({ data }) => setOrganizations(data || []))
      .catch(() => setOrganizations([]))
      .finally(() => setOrganizationsLoading(false));
  }, [step, open, dataProvider]);

  const validateFile = useCallback((file) => {
    if (!file) return 'Keine Datei erkannt.';
    const name = file.name?.toLowerCase() ?? '';
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const isOctetStream = file.type === 'application/octet-stream';
    const isMessageRfc = file.type === 'message/rfc822';
    if (!hasValidExt && !isOctetStream && !isMessageRfc) {
      return `„${file.name}" ist keine .eml-Datei.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `„${file.name}" ist zu groß (max. ${MAX_FILE_SIZE_MB} MB).`;
    }
    return null;
  }, []);

  const readFileAsText = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
      reader.readAsText(file);
    });
  }, []);

  const parseOneFile = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const raw = await readFileAsText(file);
      const { json } = await httpClient(`${API_URL}/email/parse-eml`, {
        method: 'POST',
        body: JSON.stringify({ eml_raw: raw }),
      });
      setPreview({
        eml_raw: raw,
        parsed: json,
        fileName: file.name,
      });
      setForm((prev) => ({
        ...prev,
        first_name: json.first_name ?? '',
        last_name: json.last_name ?? '',
        company_choice: json.suggested_company_name ? COMPANY_CHOICE_NEW : COMPANY_CHOICE_NONE,
        organization_id: '',
        new_organization_name: json.suggested_company_name ?? '',
        new_organization_domain: json.suggested_company_domain ?? '',
      }));
      setStep('preview');
    } catch (err) {
      const msg = err?.body?.message || err?.message || 'E-Mail konnte nicht gelesen werden.';
      setError(msg);
    } finally {
      setParsing(false);
    }
  }, [validateFile, readFileAsText]);

  const runImportFromPreview = useCallback(async () => {
    if (!preview) return;
    setImporting(true);
    setError(null);
    const payload = {
      eml_raw: preview.eml_raw,
      first_name: form.first_name?.trim() || undefined,
      last_name: form.last_name?.trim() || undefined,
    };
    if (form.company_choice === COMPANY_CHOICE_EXISTING && form.organization_id) {
      payload.organization_id = form.organization_id;
    } else if (form.company_choice === COMPANY_CHOICE_NEW && form.new_organization_name?.trim()) {
      payload.new_organization_name = form.new_organization_name.trim();
      if (form.new_organization_domain?.trim()) {
        payload.new_organization_domain = form.new_organization_domain.trim();
      }
    }
    try {
      const { json } = await httpClient(`${API_URL}/email/import-eml`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = json?.data ?? json;
      setResults([{ success: true, ...data, fileName: preview.fileName }]);
      setStep('result');
      setPreview(null);
    } catch (err) {
      const msg = err?.body?.message || err?.message || 'Import fehlgeschlagen.';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }, [preview, form]);

  const importSingleEml = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      return { success: false, error: validationError, fileName: file.name };
    }
    try {
      const raw = await readFileAsText(file);
      const { json } = await httpClient(`${API_URL}/email/import-eml`, {
        method: 'POST',
        body: JSON.stringify({ eml_raw: raw }),
      });
      const data = json?.data ?? json;
      return { success: true, ...data, fileName: file.name };
    } catch (err) {
      const msg = err?.body?.message || err?.message || 'Import fehlgeschlagen.';
      return { success: false, error: msg, fileName: file.name };
    }
  }, [validateFile, readFileAsText]);

  const importFiles = useCallback(
    async (files) => {
      setError(null);
      setResults([]);
      const emlFiles = Array.from(files);
      if (emlFiles.length === 0) {
        setError('Keine Dateien erkannt.');
        return;
      }
      if (emlFiles.length === 1) {
        await parseOneFile(emlFiles[0]);
        return;
      }
      setImporting(true);
      const importResults = [];
      for (const file of emlFiles) {
        const result = await importSingleEml(file);
        importResults.push(result);
        setResults([...importResults]);
      }
      setStep('result');
      setImporting(false);
    },
    [parseOneFile, importSingleEml],
  );

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) setDragActive(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragActive(false);
      const files = e.dataTransfer?.files;
      if (files?.length > 0) importFiles(files);
    },
    [importFiles],
  );

  const handleFileSelect = useCallback(
    (e) => {
      const files = e.target?.files;
      if (files?.length > 0) importFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [importFiles],
  );

  const handleClickZone = () => {
    if (!importing && !parsing) fileInputRef.current?.click();
  };

  const borderColor = dragActive ? 'primary.main' : error ? 'error.light' : 'divider';
  const bgColor = dragActive ? 'action.hover' : 'transparent';
  const successCount = results.filter((r) => r.success && !r.duplicate).length;
  const dupCount = results.filter((r) => r.success && r.duplicate).length;
  const errCount = results.filter((r) => !r.success).length;

  const showPreview = step === 'preview' && preview;
  const showResults = step === 'result' && results.length > 0;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { minHeight: 360 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmailIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>
          {showPreview ? 'Import prüfen' : showResults ? 'Ergebnis' : 'E-Mail Import (.eml)'}
        </Typography>
        <IconButton size="small" onClick={handleClose} disabled={importing || parsing}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {showPreview && (
          <>
            <Button
              size="small"
              startIcon={<ArrowBackIcon />}
              onClick={() => { setStep('drop'); setPreview(null); setError(null); }}
              sx={{ mb: 2 }}
            >
              Zurück
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Prüfe die erkannten Daten und wähle optional eine Firma. Anschließend wird die E-Mail importiert.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Vorname"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="Nachname"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                fullWidth
                size="small"
              />
              <TextField
                label="E-Mail"
                value={preview.parsed.from_email ?? ''}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                helperText="Absender (nur Anzeige)"
              />
              <TextField
                label="Betreff / Konversation"
                value={preview.parsed.subject ?? ''}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
              />
              {preview.parsed.date && (
                <Typography variant="caption" color="text.secondary">
                  Datum: {new Date(preview.parsed.date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
              )}

              <Divider sx={{ my: 1 }} />

              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BusinessIcon fontSize="small" />
                Firma
              </Typography>
              <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Firma zuordnen</InputLabel>
                <Select
                  value={form.company_choice}
                  label="Firma zuordnen"
                  onChange={(e) => setForm((f) => ({ ...f, company_choice: e.target.value }))}
                  disabled={organizationsLoading}
                >
                  <MenuItem value={COMPANY_CHOICE_NONE}>Keine Firma</MenuItem>
                  <MenuItem value={COMPANY_CHOICE_EXISTING}>Bestehende Firma auswählen</MenuItem>
                  <MenuItem value={COMPANY_CHOICE_NEW}>Neue Firma erstellen</MenuItem>
                </Select>
              </FormControl>

              {form.company_choice === COMPANY_CHOICE_EXISTING && (
                <FormControl fullWidth size="small">
                  <InputLabel>Firma</InputLabel>
                  <Select
                    value={form.organization_id}
                    label="Firma"
                    onChange={(e) => setForm((f) => ({ ...f, organization_id: e.target.value }))}
                  >
                    {organizations.map((org) => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name}
                        {org.domain ? ` (${org.domain})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {form.company_choice === COMPANY_CHOICE_NEW && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField
                    label="Name der neuen Firma"
                    placeholder="z. B. dna-me"
                    value={form.new_organization_name}
                    onChange={(e) => setForm((f) => ({ ...f, new_organization_name: e.target.value }))}
                    fullWidth
                    size="small"
                    helperText="Aus E-Mail-Domain vorgeschlagen (z. B. @dna-me.net → dna-me)"
                  />
                  <TextField
                    label="Domain (optional)"
                    placeholder="z. B. dna-me.net"
                    value={form.new_organization_domain}
                    onChange={(e) => setForm((f) => ({ ...f, new_organization_domain: e.target.value }))}
                    fullWidth
                    size="small"
                  />
                </Box>
              )}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <DialogActions sx={{ px: 0, pt: 2 }}>
              <Button onClick={() => { setStep('drop'); setPreview(null); }}>
                Abbrechen
              </Button>
              <Button
                variant="contained"
                onClick={runImportFromPreview}
                disabled={importing}
                startIcon={importing ? <CircularProgress size={16} /> : null}
              >
                {importing ? 'Wird importiert…' : 'Importieren'}
              </Button>
            </DialogActions>
            <Box sx={{ height: 24 }} />
          </>
        )}

        {!showPreview && !showResults && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Ziehe eine <strong>.eml</strong>-Datei hierher (oder klicke). Bei einer Datei siehst du vor dem Import
              eine Vorschau und kannst Name sowie Firma anpassen oder eine neue Firma anlegen.
            </Typography>

            <Box
              id="emailDropZone"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClickZone}
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                p: 4,
                border: '2px dashed',
                borderColor,
                borderRadius: 2,
                bgcolor: bgColor,
                cursor: importing || parsing ? 'wait' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                minHeight: 140,
                '&:hover': {
                  borderColor: importing || parsing ? borderColor : 'primary.light',
                  bgcolor: importing || parsing ? bgColor : 'action.hover',
                },
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".eml,message/rfc822"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              {parsing ? (
                <>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary">
                    E-Mail wird gelesen…
                  </Typography>
                </>
              ) : importing ? (
                <>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary">
                    E-Mail(s) werden importiert…
                  </Typography>
                </>
              ) : dragActive ? (
                <>
                  <UploadIcon sx={{ fontSize: 44, color: 'primary.main' }} />
                  <Typography variant="body1" color="primary.main" fontWeight={600}>
                    Hier ablegen
                  </Typography>
                </>
              ) : (
                <>
                  <UploadIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    .eml-Datei(en) hierhin ziehen
                    <br />
                    oder <strong>klicken</strong> zum Auswählen
                  </Typography>
                </>
              )}
            </Box>

            <Collapse in={Boolean(error) && results.length === 0}>
              {error && (
                <Alert severity="error" icon={<ErrorIcon />} sx={{ mt: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
            </Collapse>
          </>
        )}

        {showResults && (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {successCount > 0 && (
                <Chip icon={<SuccessIcon />} label={`${successCount} importiert`} color="success" size="small" variant="outlined" />
              )}
              {dupCount > 0 && (
                <Chip label={`${dupCount} Duplikat${dupCount > 1 ? 'e' : ''}`} color="info" size="small" variant="outlined" />
              )}
              {errCount > 0 && (
                <Chip icon={<ErrorIcon />} label={`${errCount} Fehler`} color="error" size="small" variant="outlined" />
              )}
            </Box>
            <Box sx={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {results.map((r, idx) => (
                <Alert
                  key={idx}
                  severity={r.success ? (r.duplicate ? 'info' : 'success') : 'error'}
                  sx={{ py: 0.5 }}
                >
                  <Box>
                    {r.success ? (
                      <>
                        <Typography variant="body2" fontWeight={500}>
                          {r.from_name || r.from_email}
                          {r.from_name ? ` <${r.from_email}>` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.subject}
                          {r.date && (
                            <> · {new Date(r.date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</>
                          )}
                        </Typography>
                        {r.lead_created && (
                          <Box sx={{ mt: 0.5 }}>
                            <Chip icon={<PersonAddIcon />} label="Neuer Lead" color="info" size="small" />
                          </Box>
                        )}
                        {r.duplicate && (
                          <Typography variant="caption" color="text.secondary">(bereits importiert)</Typography>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2">{r.fileName}: {r.error}</Typography>
                    )}
                  </Box>
                </Alert>
              ))}
            </Box>
          </>
        )}
      </DialogContent>

      {!showPreview && (
        <DialogActions>
          <Button onClick={handleClose} disabled={importing || parsing}>
            {showResults ? 'Schließen' : 'Abbrechen'}
          </Button>
          {showResults && (
            <Button variant="contained" onClick={() => { setStep('drop'); setResults([]); }}>
              Weitere importieren
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}
