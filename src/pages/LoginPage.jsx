import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Link,
} from '@mui/material';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { user, sendOtp, verifyOtp } = useUserAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await sendOtp(email);
    if (result.success) {
      setOtpSent(true);
      setError('');
    } else {
      if (result.error === 'User not found') {
        setError(
          <>
            Usuário não encontrado. Por favor,{' '}
            <Link component={RouterLink} to="/signup">
              cadastre-se
            </Link>
            .
          </>
        );
      } else {
        setError('Falha ao enviar OTP. Verifique seu email.');
      }
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await verifyOtp(email, otp);
    if (success) {
      navigate('/');
    } else {
      setError('OTP inválido ou expirado.');
    }
    setLoading(false);
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ mt: 8, p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Entrar
        </Typography>
        {error && <Alert severity="error" sx={{ width: '100%', mt: 2 }}>{error}</Alert>}
        
        <Box component="form" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Endereço de Email"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || otpSent}
          />

          {!otpSent ? (
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading || !email}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Enviar Código OTP'}
            </Button>
          ) : (
            <>
              <TextField
                margin="normal"
                required
                fullWidth
                id="otp"
                label="Código OTP"
                name="otp"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                sx={{ mt: 2 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || !otp}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Verificar OTP'}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSendOtp}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                Reenviar OTP
              </Button>
            </>
          )}

          <Divider sx={{ my: 2 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Link component={RouterLink} to="/signup" variant="body2">
              {"Não tem uma conta? Cadastre-se"}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginPage;

