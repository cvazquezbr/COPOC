import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import geminiAPI from '../utils/geminiAPI';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, IconButton, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Visibility, VisibilityOff, InfoOutlined as InfoIcon, Close as CloseIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import GeminiInfobox from './GeminiInfobox';

const GeminiAuthSetup = () => {
  const { user, updateSetting } = useUserAuth();
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [showInfobox, setShowInfobox] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-pro');

  useEffect(() => {
    if (user) {
      setApiKey(user.gemini_api_key || '');
      setSelectedModel(user.gemini_model || 'gemini-pro');
    }
  }, [user]);

  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
    updateSetting('gemini_api_key', e.target.value);
    if (error) setError('');
  };

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
    updateSetting('gemini_model', e.target.value);
  };

  const handleRemove = () => {
    setApiKey('');
    updateSetting('gemini_api_key', '');
    toast.info('Chave da API Gemini removida.');
  };

  const handleTestConnection = async () => {
    const trimmedApiKey = apiKey.trim();
    setTestResult(null);
    if (!trimmedApiKey) {
        setTestResult({ severity: 'error', message: 'Por favor, insira uma chave de API para testar.' });
        return;
    }
    setIsTesting(true);
    try {
      geminiAPI.initialize(trimmedApiKey);
      await geminiAPI.generateContent('Diga "Olá, mundo!" em português.', selectedModel);
      setTestResult({ severity: 'success', message: 'Conexão com a API Gemini bem-sucedida!' });
    } catch (err) {
      console.error('Erro no teste de conexão com Gemini:', err);
      setTestResult({ severity: 'error', message: `Falha na conexão: ${err.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  const getMaskedKey = (key) => {
    if (!key || key.length < 8) return 'Chave muito curta para mascarar';
    return `...${key.substring(key.length - 6)}`;
  }

  return (
    <>
      <Box sx={{ p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">API Gemini</Typography>
            <IconButton onClick={() => setShowInfobox(true)}>
                <InfoIcon />
            </IconButton>
        </Box>
        <Typography variant="body2" gutterBottom sx={{mt: 2}}>
          Insira sua chave da API Gemini (Google AI Studio). Esta chave será armazenada de forma segura.
        </Typography>

        {apiKey && (
          <Typography variant="caption" color="textSecondary" gutterBottom>
            Chave atual configurada: {getMaskedKey(apiKey)}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', mt: apiKey ? 1 : 2, mb: 2 }}>
          <TextField
            autoFocus
            margin="dense"
            id="gemini-api-key"
            label="Chave da API Gemini"
            type={showKey ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="Sua chave da API Gemini..."
          />
          <IconButton onClick={toggleShowKey} edge="end" sx={{ ml: 1 }}>
            {showKey ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </Box>

        <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="gemini-model-select-label">Modelo Gemini</InputLabel>
            <Select
                labelId="gemini-model-select-label"
                id="gemini-model-select"
                value={selectedModel}
                label="Modelo Gemini"
                onChange={handleModelChange}
            >
                <MenuItem value="gemini-1.5-pro-latest">Gemini 1.5 Pro</MenuItem>
                <MenuItem value="gemini-1.5-flash-latest">Gemini 1.5 Flash</MenuItem>
                <MenuItem value="gemini-pro">Gemini 1.0 Pro</MenuItem>
            </Select>
        </FormControl>

        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        <Grid container spacing={2} sx={{ pt: 2 }} alignItems="center">
          <Grid item xs={12} sm>
            <Button onClick={handleTestConnection} disabled={isTesting} variant="outlined" fullWidth>
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </Grid>
          <Grid item xs={12} sm="auto">
            {apiKey && (
              <Button onClick={handleRemove} color="error" fullWidth>
                Remover
              </Button>
            )}
          </Grid>
        </Grid>

        {testResult && (
            <Alert severity={testResult.severity} sx={{ mt: 2 }}>
                {testResult.message}
            </Alert>
        )}
      </Box>

      <Dialog open={showInfobox} onClose={() => setShowInfobox(false)} fullWidth maxWidth="lg">
        <DialogTitle>
           <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Instruções de Configuração
            <IconButton onClick={() => setShowInfobox(false)}>
                <CloseIcon />
            </IconButton>
           </Box>
        </DialogTitle>
        <DialogContent>
          <GeminiInfobox />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInfobox(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GeminiAuthSetup;