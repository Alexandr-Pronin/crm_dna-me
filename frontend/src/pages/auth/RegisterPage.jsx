import React, { useState } from 'react';
import { useNotify, useRedirect } from 'react-admin';
import { Box, Card, CardContent, TextField, Button, Typography, Avatar } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { API_URL } from '../../providers/dataProvider';

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const notify = useNotify();
    const redirect = useRedirect();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }), // Let backend decide role
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Registrierung fehlgeschlagen');
            }
            
            notify('Registrierung erfolgreich. Bitte anmelden.');
            redirect('/login');
        } catch (error) {
            notify(error.message || 'Registrierung fehlgeschlagen', { type: 'warning' });
        }
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            bgcolor="grey.100"
        >
            <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
                <LockOutlinedIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
                Registrieren
            </Typography>
            <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                <Card sx={{ minWidth: 300 }}>
                    <CardContent>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="name"
                            label="Name"
                            name="name"
                            autoComplete="name"
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="email"
                            label="E-Mail Adresse"
                            name="email"
                            autoComplete="email"
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
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Registrieren
                        </Button>
                        <Button
                            fullWidth
                            variant="text"
                            onClick={() => redirect('/login')}
                        >
                            Bereits ein Konto? Anmelden
                        </Button>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
};

export default RegisterPage;
