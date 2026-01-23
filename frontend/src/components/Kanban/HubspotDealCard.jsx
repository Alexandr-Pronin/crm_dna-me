/**
 * DNA ME Deal Card Component
 * Basiert auf HubSpot UX, angepasst an DNA ME Dark Theme
 * 
 * Features:
 * - Versteckter Checkbox (erscheint nur bei Hover oder Auswahl)
 * - Quick Actions Bar (Preview, Note, Email, Call)
 * - Kontakt-Link innerhalb der Karte
 * - DNA ME Biotech Dark Theme Farben
 */
import React, { useState, forwardRef } from 'react';
import { 
  Paper, 
  Box, 
  Typography, 
  Checkbox, 
  IconButton, 
  Tooltip, 
  Link,
  Fade,
  alpha,
} from '@mui/material';
import { 
  VisibilityOutlined,
  EditNoteOutlined,
  EmailOutlined, 
  PhoneOutlined,
  WarningAmberRounded,
  PersonOutline,
  BusinessOutlined,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// DNA ME Dark Theme Farben (aus palette.js)
const DNA_COLORS = {
  // Primär/Sekundär
  primary: '#4A90A4',        // Teal - Biotech
  primaryLight: '#6AAFC2',
  secondary: '#6C5CE7',      // Purple - Accent
  secondaryLight: '#8B7EEB',
  
  // Status
  success: '#28A745',
  warning: '#F59E0B',
  error: '#DC3545',
  info: '#17A2B8',
  
  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  
  // Hintergründe
  bgCard: 'rgba(26, 26, 36, 0.95)',
  bgCardHover: 'rgba(32, 32, 44, 0.98)',
  bgElevated: 'rgba(38, 38, 50, 0.95)',
  
  // Rahmen
  border: '#2a2a3a',
  borderHover: '#3a3a4a',
  borderActive: '#4A90A4',
  
  // Interaktion
  actionHover: 'rgba(255, 255, 255, 0.08)',
  actionSelected: 'rgba(74, 144, 164, 0.16)',
};

const DealCard = forwardRef(({ 
  deal, 
  isDragging = false, 
  selected = false, 
  onToggle,
  onPreview,
  onEmail,
  onCall,
  onNote,
  onContactClick,
  stageColor = DNA_COLORS.primary,
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  // Datum formatieren (DE Format)
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
      
      // Relative Zeit für nahe Daten
      if (diffDays === 0) return 'Heute';
      if (diffDays === 1) return 'Morgen';
      if (diffDays === -1) return 'Gestern';
      if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} Tagen`;
      if (diffDays < 0 && diffDays >= -7) return `Vor ${Math.abs(diffDays)} Tagen`;
      
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return null;
    }
  };

  // Währung formatieren
  const formatCurrency = (value) => {
    if (!value && value !== 0) return null;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Check ob Deal überfällig ist
  const isOverdue = () => {
    if (!deal.expected_close) return false;
    const closeDate = new Date(deal.expected_close);
    return closeDate < new Date();
  };

  // Handlers
  const handleTitleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onPreview) {
      onPreview(deal);
    }
  };

  const handleContactClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onContactClick) {
      onContactClick(deal);
    } else if (deal.lead_id) {
      navigate(`/leads/${deal.lead_id}/show`);
    } else if (deal.contact_id) {
      navigate(`/contacts/${deal.contact_id}/show`);
    }
  };

  const handlePreview = (e) => {
    e.stopPropagation();
    if (onPreview) {
      onPreview(deal);
    }
  };

  const handleEmail = (e) => {
    e.stopPropagation();
    if (onEmail) {
      onEmail(deal);
    } else if (deal.lead_email || deal.contact_email) {
      window.location.href = `mailto:${deal.lead_email || deal.contact_email}`;
    }
  };

  const handleCall = (e) => {
    e.stopPropagation();
    if (onCall) {
      onCall(deal);
    } else if (deal.lead_phone || deal.contact_phone) {
      window.location.href = `tel:${deal.lead_phone || deal.contact_phone}`;
    }
  };

  const handleNote = (e) => {
    e.stopPropagation();
    if (onNote) {
      onNote(deal);
    }
  };

  const handleCheckboxToggle = (e) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle(deal.id);
    }
  };

  const showCheckbox = isHovered || selected;
  const showQuickActions = isHovered && !isDragging;
  const hasDelay = isOverdue();
  const contactName = deal.contact_name || deal.lead_name;
  const companyName = deal.company_name || deal.lead_company;
  const email = deal.lead_email || deal.contact_email;
  const hasContactLink = deal.lead_id || deal.contact_id;

  return (
    <Paper
      ref={ref}
      elevation={isDragging ? 8 : 0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        width: '100%',
        bgcolor: isHovered ? DNA_COLORS.bgCardHover : DNA_COLORS.bgCard,
        border: '1px solid',
        borderColor: selected 
          ? stageColor 
          : (isHovered ? DNA_COLORS.borderHover : DNA_COLORS.border),
        borderRadius: '8px',
        boxShadow: isDragging 
          ? `0 8px 32px ${alpha('#000', 0.4)}` 
          : isHovered 
            ? `0 2px 8px ${alpha('#000', 0.3)}` 
            : 'none',
        transition: 'all 0.15s ease',
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        // Linker Farbstreifen (Stage-Indikator)
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          bgcolor: stageColor,
          opacity: isHovered || selected ? 1 : 0.7,
          transition: 'opacity 0.15s ease',
        },
      }}
    >
      <Box sx={{ p: 1.5, pl: 2, pb: 5 }}> {/* pb: 5 für Platz für Quick Actions */}
        
        {/* === HEADER ROW: Checkbox + Title + Warning === */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          gap: 1, 
          mb: 1.5,
        }}>
          
          {/* Checkbox */}
          <Box 
            sx={{ 
              width: 20, 
              height: 20,
              flexShrink: 0,
              opacity: showCheckbox ? 1 : 0,
              transition: 'opacity 0.1s ease',
              mt: '2px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox 
              checked={selected}
              onChange={handleCheckboxToggle}
              size="small"
              sx={{ 
                p: 0, 
                color: DNA_COLORS.textMuted,
                '&.Mui-checked': { 
                  color: stageColor,
                },
              }} 
            />
          </Box>

          {/* Title */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Link 
              component="button"
              onClick={handleTitleClick}
              underline="hover"
              sx={{ 
                display: 'block',
                textAlign: 'left',
                width: '100%',
                color: DNA_COLORS.textPrimary,
                fontWeight: 600,
                fontSize: '14px',
                lineHeight: 1.4,
                cursor: 'pointer',
                border: 'none',
                background: 'none',
                p: 0,
                // 2 Zeilen erlauben für längere Titel
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                '&:hover': {
                  color: DNA_COLORS.primary,
                },
              }}
            >
              {deal.title || deal.name || 'Unbenannter Deal'}
            </Link>
          </Box>

          {/* Warning Icon */}
          {hasDelay && (
            <Tooltip title="Deal überfällig" arrow placement="top">
              <WarningAmberRounded 
                sx={{ 
                  fontSize: 18, 
                  color: DNA_COLORS.error,
                  flexShrink: 0,
                }} 
              />
            </Tooltip>
          )}
        </Box>

        {/* === FIRMA - Klickbarer Link === */}
        {companyName && (
          <Box sx={{ mb: 1.5, pl: '28px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <BusinessOutlined sx={{ fontSize: 16, color: DNA_COLORS.textMuted }} />
              {deal.company_id || deal.organization_id ? (
                <Link
                  component="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (deal.company_id) {
                      navigate(`/companies/${deal.company_id}/show`);
                    } else if (deal.organization_id) {
                      navigate(`/organizations/${deal.organization_id}/show`);
                    }
                  }}
                  underline="hover"
                  sx={{
                    fontSize: '14px',
                    color: DNA_COLORS.primary,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'none',
                    p: 0,
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    '&:hover': {
                      color: DNA_COLORS.primaryLight,
                    },
                  }}
                >
                  {companyName}
                  <OpenInNew sx={{ fontSize: 12 }} />
                </Link>
              ) : (
                <Typography 
                  sx={{ 
                    fontSize: '14px', 
                    color: DNA_COLORS.textSecondary,
                    fontWeight: 500,
                  }}
                >
                  {companyName}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* === DEAL VALUE - Prominent === */}
        {deal.value > 0 && (
          <Box sx={{ mb: 1.5, pl: '28px' }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: stageColor,
                fontWeight: 700,
                fontSize: '18px',
                lineHeight: 1,
              }}
            >
              {formatCurrency(deal.value)}
            </Typography>
          </Box>
        )}

        {/* === EIGENSCHAFTEN - Kompakte Info-Zeilen === */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 0.5, 
          pl: '28px',
          fontSize: '12px',
        }}>
          {/* Amount */}
          {!deal.value && (
            <InfoLine label="Amount" value="—" />
          )}
          
          {/* Abschlussdatum */}
          {deal.expected_close && (
            <InfoLine 
              label="Close date" 
              value={new Date(deal.expected_close).toLocaleDateString('de-DE')}
              valueColor={hasDelay ? DNA_COLORS.error : undefined}
            />
          )}
          
          {/* Deal Owner */}
          {deal.assigned_to_name && (
            <InfoLine label="Deal owner" value={deal.assigned_to_name} />
          )}
          
          {/* Create Date */}
          {deal.created_at && (
            <InfoLine 
              label="Create date" 
              value={new Date(deal.created_at).toLocaleDateString('de-DE')}
            />
          )}
        </Box>

        {/* === KONTAKT - Mit Icon unten === */}
        {contactName && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mt: 1.5, 
            pl: '28px',
          }}>
            <PersonOutline sx={{ fontSize: 18, color: DNA_COLORS.textMuted }} />
            {hasContactLink ? (
              <Link
                component="button"
                onClick={handleContactClick}
                underline="hover"
                sx={{
                  fontSize: '13px',
                  color: DNA_COLORS.primary,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  p: 0,
                  textAlign: 'left',
                  '&:hover': {
                    color: DNA_COLORS.primaryLight,
                  },
                }}
              >
                {contactName}
              </Link>
            ) : (
              <Typography sx={{ fontSize: '13px', color: DNA_COLORS.textSecondary }}>
                {contactName}
              </Typography>
            )}
          </Box>
        )}

      </Box>

      {/* === QUICK ACTIONS BAR === */}
      <Fade in={showQuickActions} timeout={100}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: alpha(DNA_COLORS.bgElevated, 0.98),
            backdropFilter: 'blur(4px)',
            borderTop: `1px solid ${DNA_COLORS.border}`,
            display: 'flex',
            justifyContent: 'center',
            gap: 0.5,
            py: 0.5,
            px: 1,
            height: 36,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <QuickActionButton 
            icon={<VisibilityOutlined />} 
            tooltip="Vorschau" 
            onClick={handlePreview}
            color={stageColor}
          />
          <QuickActionButton 
            icon={<EditNoteOutlined />} 
            tooltip="Notiz hinzufügen" 
            onClick={handleNote}
            color={stageColor}
          />
          <QuickActionButton 
            icon={<EmailOutlined />} 
            tooltip="E-Mail senden" 
            onClick={handleEmail}
            color={stageColor}
            disabled={!email}
          />
          <QuickActionButton 
            icon={<PhoneOutlined />} 
            tooltip="Anrufen" 
            onClick={handleCall}
            color={stageColor}
            disabled={!deal.lead_phone && !deal.contact_phone}
          />
        </Box>
      </Fade>
    </Paper>
  );
});

DealCard.displayName = 'DealCard';

/**
 * InfoLine - Kompakte Info-Zeile im Format "Label: Value"
 */
const InfoLine = ({ label, value, valueColor }) => (
  <Typography 
    sx={{ 
      fontSize: '12px', 
      color: DNA_COLORS.textSecondary,
      lineHeight: 1.5,
    }}
  >
    <span style={{ color: DNA_COLORS.textMuted }}>{label}:</span>{' '}
    <span style={{ 
      color: valueColor || DNA_COLORS.textPrimary,
      fontWeight: 400,
    }}>
      {value}
    </span>
  </Typography>
);

/**
 * QuickActionButton
 */
const QuickActionButton = ({ icon, tooltip, onClick, color, disabled = false }) => (
  <Tooltip title={tooltip} arrow placement="top">
    <span>
      <IconButton 
        size="small" 
        onClick={onClick}
        disabled={disabled}
        sx={{ 
          color: disabled ? DNA_COLORS.textMuted : DNA_COLORS.textSecondary,
          padding: '4px',
          borderRadius: '4px',
          transition: 'all 0.1s ease',
          '&:hover': { 
            color: disabled ? DNA_COLORS.textMuted : color,
            bgcolor: disabled ? 'transparent' : alpha(color, 0.15),
          },
          '&.Mui-disabled': {
            color: alpha(DNA_COLORS.textMuted, 0.5),
          },
        }}
      >
        {React.cloneElement(icon, { sx: { fontSize: 16 } })}
      </IconButton>
    </span>
  </Tooltip>
);

export default DealCard;
