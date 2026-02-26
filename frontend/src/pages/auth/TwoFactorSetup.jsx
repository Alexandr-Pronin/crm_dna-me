import React, { useState } from 'react';
import { useNotify } from 'react-admin';
import { Box, Card, CardContent, TextField, Button, Typography, CircularProgress } from '@mui/material';
import { QRCodeCanvas } from 'qrcode.react';
import { API_URL } from '../../providers/dataProvider';

const TwoFactorSetup = () => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const notify = useNotify();

    const fetchSetup = async () => {
        setLoading(true);
        try {
            const authToken = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/auth/2fa/setup`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
            });
            const data = await response.json();
            if (data.qrCode) {
                setQrCodeUrl(data.qrCode);
                setSecret(data.secret);
            } else {
                notify('Fehler beim Abrufen des QR-Codes', { type: 'warning' });
            }
        } catch (error) {
            notify('Fehler beim Laden der 2FA-Konfiguration', { type: 'warning' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        try {
            const authToken = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/auth/2fa/verify`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token }),
            });
            
            if (!response.ok) {
                throw new Error('Verifizierung fehlgeschlagen');
            }

            setIsEnabled(true);
            notify('2FA erfolgreich aktiviert');
            setQrCodeUrl('');
            setSecret('');
            setToken('');
        } catch (error) {
            notify('Ungültiger Code', { type: 'warning' });
        }
    };

    return (
        <Box p={2}>
            <Typography variant="h5" gutterBottom>Zwei-Faktor-Authentifizierung (2FA) einrichten</Typography>
            
            {!isEnabled ? (
                <Card>
                    <CardContent>
                        {!qrCodeUrl ? (
                            <Box>
                                <Typography paragraph>
                                    Schützen Sie Ihr Konto mit der Zwei-Faktor-Authentifizierung.
                                </Typography>
                                <Button variant="contained" onClick={fetchSetup} disabled={loading}>
                                    {loading ? <CircularProgress size={24} /> : '2FA Einrichten'}
                                </Button>
                            </Box>
                        ) : (
                            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                                <Typography>Scannen Sie diesen QR-Code mit Ihrer Authenticator-App (z.B. Google Authenticator):</Typography>
                                <QRCodeCanvas value={qrCodeUrl} size={256} />
                                <Typography variant="caption" color="textSecondary" sx={{ wordBreak: 'break-all' }}>
                                    Secret: {secret}
                                </Typography>
                                
                                <TextField
                                    label="Code eingeben"
                                    value={token}
                                    onChange={(e) => setToken(e.target.value)}
                                    fullWidth
                                    margin="normal"
                                    autoComplete="off"
                                />
                                <Button variant="contained" onClick={handleVerify} disabled={!token}>
                                    Aktivieren
                                </Button>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent>
                        <Typography color="success.main">2FA ist aktiviert!</Typography>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default TwoFactorSetup;
