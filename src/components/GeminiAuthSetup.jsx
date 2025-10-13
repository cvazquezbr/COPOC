import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import geminiAPI from '../utils/geminiAPI';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Typography, Box, IconButton, Alert, FormControl, InputLabel, Select,
  MenuItem, Grid, useTheme, useMediaQuery, CircularProgress
} from '@mui/material';
import { Visibility, VisibilityOff, InfoOutlined as InfoIcon, Close as CloseIcon } from '@mui/icons-material';
import { toast } from 'sonner';
import GeminiInfobox from './GeminiInfobox';

const GeminiAuthSetup = () => {
  const { user, saveSettings, fetchUser } = useUserAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [showInfobox, setShowInfobox] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [models, setModels] = useState([]);

  useEffect(() => {
    if (user) {
      setApiKey(user.gemini_api_key || '');
      setSelectedModel(user.gemini_model || 'gemini-pro');
    }
  }, [user]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) {
        setModels([]);
        return;
      }
      try {
        geminiAPI.initialize(apiKey);
        const modelList = await geminiAPI.listModels();
        setModels(modelList);
      } catch (error) {
        console.error("Failed to fetch Gemini models:", error);
        setModels([]);
      }
    };
    fetchModels();
  }, [apiKey]);

  const handleSave = async () => {
    setIsSaving(true);
    setTestResult(null);
    try {
      await saveSettings({
        gemini_api_key: apiKey,
        gemini_model: selectedModel,
      });
      // No need to call fetchUser, saveSettings does it.
    } catch (err) {
      // Error toast is handled in saveSettings
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      await saveSettings({
        gemini_api_key: '',
      });
      setApiKey('');
    } finally {
      setIsSaving(false);
    }
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

  return (
    <>
      <Box>
        <Typography variant="h6" component="div" sx={{ mb: 1 }}>
          API Gemini
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Insira sua chave da API do Google AI Studio para ativar os recursos de IA.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <TextField
            autoFocus
            id="gemini-api-key"
            label="Chave da API Gemini"
            type={showKey ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Cole sua chave da API aqui"
            size="small"
          />
          <IconButton onClick={() => setShowKey(!showKey)} edge="end" sx={{ ml: 1 }} aria-label="toggle key visibility">
            {showKey ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </Box>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="gemini-model-select-label">Modelo Gemini</InputLabel>
          <Select
            labelId="gemini-model-select-label"
            id="gemini-model-select"
            value={selectedModel}
            label="Modelo Gemini"
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={!apiKey}
          >
            {models.length > 0 ? (
              models.map((model) => (
                <MenuItem key={model.name} value={model.name}>
                  <Typography variant="body2" component="span" noWrap>
                    {model.displayName}
                  </Typography>
                  <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    ({model.name.replace('models/', '')})
                  </Typography>
                </MenuItem>
              ))
            ) : (
              <MenuItem value={selectedModel} disabled>
                {apiKey ? 'Buscando modelos...' : 'Insira a chave para listar os modelos'}
              </MenuItem>
            )}
          </Select>
        </FormControl>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 0 }} direction={isMobile ? 'column' : 'row'}>
          <Grid item xs={12} sm>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              variant="contained"
              fullWidth
            >
              {isSaving ? <CircularProgress size={24} color="inherit" /> : 'Salvar'}
            </Button>
          </Grid>
          <Grid item xs={12} sm>
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey}
              variant="outlined"
              fullWidth
            >
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </Grid>
          <Grid item xs={12} sm>
            {apiKey && (
              <Button onClick={handleRemove} color="error" variant="outlined" fullWidth>
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

      <Dialog open={showInfobox} onClose={() => setShowInfobox(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Instruções de Configuração
          <IconButton onClick={() => setShowInfobox(false)} aria-label="close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
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