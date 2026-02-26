import React, { useState } from 'react';
import { useLogin, useNotify } from 'react-admin';
import { Box, Card, CardContent, TextField, Button, Typography, Avatar } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

import { Link } from 'react-router-dom';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [show2FA, setShow2FA] = useState(false);
  const login = useLogin();
  const notify = useNotify();

  const handleSubmit = (e) => {
    e.preventDefault();
    const credentials = { username: email, password };
    if (show2FA) {
      credentials.code = code;
    }

    login(credentials)
      .catch((error) => {
        if (error.require2fa) {
          setShow2FA(true);
          notify('Bitte 2FA-Code eingeben', { type: 'info' });
        } else {
          notify(typeof error === 'string' ? error : (error && error.message) || 'Anmeldung fehlgeschlagen', { type: 'warning' });
        }
      });
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="#111e2a"
    >
      <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
        <LockOutlinedIcon />
      </Avatar>
      <Typography component="h1" variant="h5" sx={{ color: '#fff' }}>
        DNA Marketing Engine
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
        <Card sx={{ minWidth: 300 }}>
          <CardContent>
            {!show2FA ? (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="E-Mail Adresse"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Passwort"
                  type="password"
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            ) : (
              <TextField
                margin="normal"
                required
                fullWidth
                name="code"
                label="2FA Code"
                type="text"
                id="code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {show2FA ? 'Verifizieren' : 'Anmelden'}
            </Button>
            <Box textAlign="center" mt={2}>
              <Typography variant="body2">
                Noch kein Konto?{' '}
                <Link to="/register" style={{ textDecoration: 'none', color: '#90caf9' }}>
                  Jetzt registrieren
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default LoginPage;
