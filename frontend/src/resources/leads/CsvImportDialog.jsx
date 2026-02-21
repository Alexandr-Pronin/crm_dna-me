import { useState, useCallback, useRef, useMemo } from 'react';
import { useNotify, useRefresh } from 'react-admin';
import Papa from 'papaparse';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  CloudUpload as CloudUploadIcon,
  TableChart as TableChartIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  FilePresent as FileIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { bulkImportLeads } from '../../providers/dataProvider';

const SYSTEM_FIELDS = [
  { key: 'email', label: 'E-Mail *', required: true, group: 'lead' },
  { key: 'first_name', label: 'Vorname', required: false, group: 'lead' },
  { key: 'last_name', label: 'Nachname', required: false, group: 'lead' },
  { key: 'phone', label: 'Telefon', required: false, group: 'lead' },
  { key: 'job_title', label: 'Position', required: false, group: 'lead' },
  { key: 'linkedin_url', label: 'LinkedIn URL', required: false, group: 'lead' },
  { key: 'company_name', label: 'Firma (Name)', required: false, group: 'org' },
  { key: 'company_domain', label: 'Firma (Domain)', required: false, group: 'org' },
  { key: 'industry', label: 'Branche', required: false, group: 'org' },
  { key: 'company_size', label: 'Firmengröße', required: false, group: 'org' },
  { key: 'country', label: 'Land (2-Buchstaben)', required: false, group: 'org' },
];

const HEADER_ALIASES = {
  email: ['email', 'e-mail', 'mail', 'e_mail', 'emailaddress', 'email_address', 'e-mail-adresse'],
  first_name: ['first_name', 'firstname', 'vorname', 'first name', 'given_name', 'givenname'],
  last_name: ['last_name', 'lastname', 'nachname', 'last name', 'surname', 'family_name', 'familyname'],
  phone: ['phone', 'telefon', 'telephone', 'tel', 'phone_number', 'phonenumber', 'telefonnummer', 'mobil', 'mobile'],
  job_title: ['job_title', 'jobtitle', 'position', 'title', 'titel', 'rolle', 'role', 'job title', 'berufsbezeichnung'],
  linkedin_url: ['linkedin_url', 'linkedin', 'linkedinurl', 'linkedin url', 'linkedin_profile', 'linkedin-url'],
  company_name: ['company_name', 'company', 'firma', 'firmenname', 'organisation', 'organization', 'unternehmen', 'company name'],
  company_domain: ['company_domain', 'domain', 'website', 'firmenwebsite', 'webseite', 'url', 'company domain', 'firmendomain'],
  industry: ['industry', 'branche', 'industrie', 'sector', 'sektor'],
  company_size: ['company_size', 'firmengröße', 'firmengroesse', 'size', 'größe', 'groesse', 'mitarbeiter', 'employees', 'company size'],
  country: ['country', 'land', 'country_code', 'countrycode', 'ländercode'],
};

const STEPS = ['Datei auswählen', 'Spalten zuordnen', 'Prüfen & Importieren'];
const CHUNK_SIZE = 500;

function autoMapHeaders(csvHeaders) {
  const mapping = {};
  for (const header of csvHeaders) {
    const normalized = header.toLowerCase().trim().replace(/[^a-z0-9äöüß_\- ]/g, '');
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => a === normalized)) {
        mapping[header] = field;
        break;
      }
    }
    if (!mapping[header]) {
      mapping[header] = '';
    }
  }
  return mapping;
}

function validateRows(rows, mapping) {
  const errors = [];
  const emailCol = Object.entries(mapping).find(([, v]) => v === 'email')?.[0];

  if (!emailCol) {
    errors.push({ row: 0, message: 'Keine Spalte ist dem Pflichtfeld "E-Mail" zugeordnet.' });
    return errors;
  }

  const seenEmails = new Set();
  rows.forEach((row, idx) => {
    const email = (row[emailCol] || '').trim().toLowerCase();
    if (!email) {
      errors.push({ row: idx + 2, message: 'E-Mail fehlt.' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: idx + 2, message: `Ungültiges E-Mail-Format: "${email}"` });
    } else if (seenEmails.has(email)) {
      errors.push({ row: idx + 2, message: `Doppelte E-Mail in CSV: "${email}"` });
    }
    if (email) seenEmails.add(email);
  });

  return errors;
}

function mapRowToLead(row, mapping) {
  const lead = {};
  const meta = {};
  for (const [csvHeader, systemField] of Object.entries(mapping)) {
    if (!systemField || !row[csvHeader]) continue;
    const value = row[csvHeader].trim();
    if (!value) continue;

    const fieldDef = SYSTEM_FIELDS.find((f) => f.key === systemField);
    if (fieldDef?.group === 'org') {
      meta[systemField] = value;
    } else {
      lead[systemField] = systemField === 'email' ? value.toLowerCase() : value;
    }
  }
  return { ...lead, ...meta };
}

function CsvImportDialog({ open, onClose }) {
  const notify = useNotify();
  const refresh = useRefresh();

  const fileInputRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: File
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [delimiter, setDelimiter] = useState('auto');

  // Step 2: Mapping
  const [mapping, setMapping] = useState({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Step 3: Import
  const [validationErrors, setValidationErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);

  const previewRows = useMemo(() => csvRows.slice(0, 5), [csvRows]);

  const mappedFieldsCount = useMemo(
    () => Object.values(mapping).filter((v) => v).length,
    [mapping]
  );

  const emailMapped = useMemo(
    () => Object.values(mapping).includes('email'),
    [mapping]
  );

  const handleFileSelect = useCallback(
    (selectedFile) => {
      if (!selectedFile) return;
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setParseError('Bitte eine CSV-Datei (.csv) auswählen.');
        return;
      }

      setFile(selectedFile);
      setParseError(null);
      setImportResult(null);
      setValidationErrors([]);

      const config = {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          if (results.errors.length > 0) {
            const critical = results.errors.filter((e) => e.type === 'Delimiter');
            if (critical.length > 0) {
              setParseError(`CSV-Parsing-Fehler: ${critical[0].message}`);
              return;
            }
          }

          const headers = results.meta.fields || [];
          const rows = results.data.filter((row) =>
            Object.values(row).some((v) => v && v.trim())
          );

          if (headers.length === 0 || rows.length === 0) {
            setParseError('Die CSV-Datei enthält keine Daten oder keine Header-Zeile.');
            return;
          }

          setCsvHeaders(headers);
          setCsvRows(rows);
          setMapping(autoMapHeaders(headers));
          setActiveStep(1);
        },
        error: (err) => {
          setParseError(`Fehler beim Lesen: ${err.message}`);
        },
      };

      if (delimiter !== 'auto') {
        config.delimiter = delimiter;
      }

      Papa.parse(selectedFile, config);
    },
    [delimiter]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleMappingChange = useCallback((csvHeader, systemField) => {
    setMapping((prev) => {
      const updated = { ...prev };
      if (systemField) {
        for (const [key, val] of Object.entries(updated)) {
          if (val === systemField && key !== csvHeader) {
            updated[key] = '';
          }
        }
      }
      updated[csvHeader] = systemField;
      return updated;
    });
  }, []);

  const handleValidateAndProceed = useCallback(() => {
    const errors = validateRows(csvRows, mapping);
    setValidationErrors(errors);
    setActiveStep(2);
  }, [csvRows, mapping]);

  const handleImport = useCallback(async () => {
    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const leads = csvRows
        .map((row) => mapRowToLead(row, mapping))
        .filter((l) => l.email);

      if (leads.length === 0) {
        setImportResult({ success: false, message: 'Keine gültigen Leads gefunden.' });
        setImporting(false);
        return;
      }

      const totalChunks = Math.ceil(leads.length / CHUNK_SIZE);
      let totalQueued = 0;
      const batchIds = [];

      for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
        const chunk = leads.slice(i, i + CHUNK_SIZE);
        const result = await bulkImportLeads({
          leads: chunk,
          source: 'csv_import',
          skip_duplicates: skipDuplicates,
        });
        totalQueued += result.total_leads || chunk.length;
        if (result.batch_id) batchIds.push(result.batch_id);
        setImportProgress(Math.round(((i + chunk.length) / leads.length) * 100));
      }

      setImportProgress(100);
      setImportResult({
        success: true,
        message: `${totalQueued} Leads in ${totalChunks} Batch(es) importiert.`,
        batchIds,
      });
      notify(`${totalQueued} Leads erfolgreich importiert`, { type: 'success' });
      refresh();
    } catch (err) {
      setImportResult({
        success: false,
        message: err.message || 'Import fehlgeschlagen.',
      });
    } finally {
      setImporting(false);
    }
  }, [csvRows, mapping, skipDuplicates, notify, refresh]);

  const handleReset = useCallback(() => {
    setActiveStep(0);
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setParseError(null);
    setMapping({});
    setValidationErrors([]);
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
    setDelimiter('auto');
    setSkipDuplicates(true);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const fatalErrors = useMemo(
    () => validationErrors.filter((e) => e.row === 0),
    [validationErrors]
  );
  const rowErrors = useMemo(
    () => validationErrors.filter((e) => e.row > 0),
    [validationErrors]
  );
  const validRowCount = useMemo(
    () => csvRows.length - rowErrors.length,
    [csvRows, rowErrors]
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableChartIcon />
          <Typography variant="h6">CSV-Import</Typography>
          {file && (
            <Chip
              size="small"
              icon={<FileIcon />}
              label={`${file.name} (${csvRows.length} Zeilen)`}
              variant="outlined"
            />
          )}
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent dividers sx={{ minHeight: 400 }}>
        {/* STEP 0: File Selection */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {parseError && (
              <Alert severity="error" onClose={() => setParseError(null)}>
                {parseError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Trennzeichen</InputLabel>
                <Select
                  value={delimiter}
                  label="Trennzeichen"
                  onChange={(e) => setDelimiter(e.target.value)}
                >
                  <MenuItem value="auto">Automatisch</MenuItem>
                  <MenuItem value=",">Komma (,)</MenuItem>
                  <MenuItem value=";">Semikolon (;)</MenuItem>
                  <MenuItem value="\t">Tab</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: 'primary.main',
                borderRadius: 2,
                p: 6,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'primary.dark',
                },
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                CSV-Datei hierhin ziehen
              </Typography>
              <Typography variant="body2" color="text.secondary">
                oder klicken zum Auswählen
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                UTF-8 Encoding, mit Header-Zeile. Pflichtfeld: E-Mail
              </Typography>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFileSelect(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </Box>

            <Alert severity="info" variant="outlined">
              <Typography variant="body2">
                <strong>Unterstützte Felder:</strong> E-Mail (Pflicht), Vorname, Nachname,
                Telefon, Position, LinkedIn URL, Firma, Domain, Branche, Firmengröße, Land.
                Pro Zeile wird ein Lead angelegt und optional mit einer Organisation verknüpft.
              </Typography>
            </Alert>
          </Box>
        )}

        {/* STEP 1: Column Mapping */}
        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity={emailMapped ? 'success' : 'warning'}>
              {emailMapped
                ? `${mappedFieldsCount} Spalte(n) zugeordnet. E-Mail ist zugeordnet.`
                : 'Bitte die Spalte "E-Mail" einem System-Feld zuordnen (Pflichtfeld).'}
            </Alert>

            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, width: '35%' }}>CSV-Spalte</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '35%' }}>System-Feld</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Beispielwert</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {csvHeaders.map((header) => (
                    <TableRow key={header}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {header}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <FormControl size="small" fullWidth>
                          <Select
                            value={mapping[header] || ''}
                            displayEmpty
                            onChange={(e) => handleMappingChange(header, e.target.value)}
                          >
                            <MenuItem value="">
                              <em>-- Nicht importieren --</em>
                            </MenuItem>
                            <MenuItem disabled sx={{ fontWeight: 600, opacity: '1 !important' }}>
                              Kontakt
                            </MenuItem>
                            {SYSTEM_FIELDS.filter((f) => f.group === 'lead').map((f) => (
                              <MenuItem key={f.key} value={f.key} sx={{ pl: 3 }}>
                                {f.label}
                              </MenuItem>
                            ))}
                            <MenuItem disabled sx={{ fontWeight: 600, opacity: '1 !important' }}>
                              Organisation
                            </MenuItem>
                            {SYSTEM_FIELDS.filter((f) => f.group === 'org').map((f) => (
                              <MenuItem key={f.key} value={f.key} sx={{ pl: 3 }}>
                                {f.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {previewRows[0]?.[header] || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Preview table */}
            <Typography variant="subtitle2" color="text.secondary">
              Vorschau (erste {previewRows.length} Zeilen)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>#</TableCell>
                    {SYSTEM_FIELDS.filter((f) =>
                      Object.values(mapping).includes(f.key)
                    ).map((f) => (
                      <TableCell key={f.key} sx={{ fontWeight: 600 }}>
                        {f.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, idx) => {
                    const mapped = mapRowToLead(row, mapping);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        {SYSTEM_FIELDS.filter((f) =>
                          Object.values(mapping).includes(f.key)
                        ).map((f) => (
                          <TableCell key={f.key}>
                            <Typography variant="caption">
                              {mapped[f.key] || '—'}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <FormControlLabel
              control={
                <Switch
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
              }
              label="Duplikate überspringen (bestehende E-Mails ignorieren)"
            />
          </Box>
        )}

        {/* STEP 2: Validate & Import */}
        {activeStep === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Validation Summary */}
            {fatalErrors.length > 0 && (
              <Alert severity="error">
                {fatalErrors.map((e, i) => (
                  <Typography key={i} variant="body2">{e.message}</Typography>
                ))}
              </Alert>
            )}

            {fatalErrors.length === 0 && (
              <>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${validRowCount} gültige Zeilen`}
                    color="success"
                    variant="outlined"
                  />
                  {rowErrors.length > 0 && (
                    <Chip
                      icon={<WarningIcon />}
                      label={`${rowErrors.length} Fehler (werden übersprungen)`}
                      color="warning"
                      variant="outlined"
                    />
                  )}
                  <Chip
                    label={`${Math.ceil(validRowCount / CHUNK_SIZE)} Batch(es)`}
                    variant="outlined"
                  />
                  <Chip
                    label={skipDuplicates ? 'Duplikate überspringen' : 'Duplikate erlauben'}
                    variant="outlined"
                  />
                </Box>

                {rowErrors.length > 0 && (
                  <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Fehlerhafte Zeilen (werden nicht importiert):
                    </Typography>
                    {rowErrors.slice(0, 50).map((e, i) => (
                      <Typography key={i} variant="caption" display="block" color="error">
                        Zeile {e.row}: {e.message}
                      </Typography>
                    ))}
                    {rowErrors.length > 50 && (
                      <Typography variant="caption" color="text.secondary">
                        ... und {rowErrors.length - 50} weitere Fehler
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Import progress */}
                {importing && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress variant="determinate" value={importProgress} sx={{ height: 8, borderRadius: 4 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                      {importProgress}% — Importiere...
                    </Typography>
                  </Box>
                )}

                {/* Import result */}
                {importResult && (
                  <Alert
                    severity={importResult.success ? 'success' : 'error'}
                    icon={importResult.success ? <CheckCircleIcon /> : <ErrorIcon />}
                  >
                    <Typography variant="body2">{importResult.message}</Typography>
                  </Alert>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          {activeStep > 0 && !importing && !importResult?.success && (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => setActiveStep((s) => s - 1)}
            >
              Zurück
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={importResult?.success ? handleReset : handleClose} disabled={importing}>
            {importResult?.success ? 'Neuer Import' : 'Abbrechen'}
          </Button>

          {activeStep === 1 && (
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={handleValidateAndProceed}
              disabled={!emailMapped}
            >
              Weiter
            </Button>
          )}

          {activeStep === 2 && !importResult?.success && fatalErrors.length === 0 && (
            <Tooltip title={validRowCount === 0 ? 'Keine gültigen Zeilen' : ''}>
              <span>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={importing ? <CircularProgress size={16} /> : <SendIcon />}
                  onClick={handleImport}
                  disabled={importing || validRowCount === 0}
                >
                  {importing ? 'Importiere...' : `${validRowCount} Leads importieren`}
                </Button>
              </span>
            </Tooltip>
          )}

          {importResult?.success && (
            <Button variant="contained" onClick={handleClose}>
              Schließen
            </Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
}

export default CsvImportDialog;
