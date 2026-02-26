import React, { useState } from 'react';
import { useNotify, useRedirect } from 'react-admin';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Avatar,
    IconButton,
    Popover,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { API_URL } from '../../providers/dataProvider';

// Liste der Avatar-Dateien aus /public/avatars (row-N-column-M.png)
const AVATAR_FILES = (() => {
    const list = [];
    for (let row = 1; row <= 5; row++) {
        for (let col = 1; col <= 9; col++) list.push(`row-${row}-column-${col}.png`);
    }
    for (let row = 6; row <= 9; row++) {
        for (let col = 5; col <= 9; col++) list.push(`row-${row}-column-${col}.png`);
    }
    return list;
})();

const RegisterPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(null);
    const [avatarAnchor, setAvatarAnchor] = useState(null);
    const notify = useNotify();
    const redirect = useRedirect();

    const avatarPickerOpen = Boolean(avatarAnchor);

    const handleAvatarClick = (e) => setAvatarAnchor(e.currentTarget);
    const handleAvatarPickerClose = () => setAvatarAnchor(null);
    const handleSelectAvatar = (filename) => {
        setSelectedAvatar(`/avatars/${filename}`);
        handleAvatarPickerClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, avatar: selectedAvatar || undefined }),
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
            sx={{ backgroundColor: 'rgb(17, 30, 42)' }}
        >
            <Box
                sx={{
                    m: 1,
                    position: 'relative',
                    '&:hover .avatar-add-overlay': { opacity: 1 },
                }}
            >
                <IconButton
                    onClick={handleAvatarClick}
                    className="avatar-add-overlay"
                    sx={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1,
                        opacity: selectedAvatar ? 0 : 1,
                        transition: 'opacity 0.2s',
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                    }}
                    size="small"
                >
                    <AddPhotoAlternateIcon fontSize="small" />
                </IconButton>
                <Avatar
                    sx={{
                        width: 56,
                        height: 56,
                        bgcolor: selectedAvatar ? 'transparent' : 'secondary.main',
                        cursor: 'pointer',
                    }}
                    src={selectedAvatar || undefined}
                    onClick={handleAvatarClick}
                >
                    {!selectedAvatar && <LockOutlinedIcon />}
                </Avatar>
            </Box>
            <Popover
                open={avatarPickerOpen}
                anchorEl={avatarAnchor}
                onClose={handleAvatarPickerClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                PaperProps={{
                    sx: {
                        p: 1.5,
                        maxHeight: 320,
                        backgroundColor: 'rgb(17, 30, 42)',
                        border: '1px solid rgba(255,255,255,0.12)',
                    },
                }}
            >
                <Typography variant="subtitle2" sx={{ color: 'grey.400', mb: 1, px: 0.5 }}>
                    Avatar wählen
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: 0.5,
                        overflow: 'auto',
                    }}
                >
                    {AVATAR_FILES.map((filename) => (
                        <Box
                            key={filename}
                            component="button"
                            type="button"
                            onClick={() => handleSelectAvatar(filename)}
                            sx={{
                                width: 44,
                                height: 44,
                                p: 0,
                                border: '2px solid transparent',
                                borderRadius: 1,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                bgcolor: 'transparent',
                                '&:hover': { borderColor: 'primary.main' },
                                '&:focus': { outline: 'none', borderColor: 'primary.main' },
                            }}
                        >
                            <img
                                src={`/avatars/${filename}`}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                }}
                            />
                        </Box>
                    ))}
                </Box>
            </Popover>
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
