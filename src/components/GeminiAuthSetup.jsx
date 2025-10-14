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
  const { user, saveSettings } = useUserAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showKey, setShowKey] = useState(false);
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
        gemini_model: 'gemini-pro',
      });
      setApiKey('');
      setSelectedModel('gemini-pro');
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: isMobile ? 2 : 3 }}>
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
            sx={{ minWidth: 0 }} // Force wrapping
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
            MenuProps={{
              sx: {
                '& .MuiPaper-root': {
                  maxWidth: '90vw',
                },
              },
            }}
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

        {testResult && (
          <Alert severity={testResult.severity} sx={{ mt: 2, wordBreak: 'break-word' }}>
            {testResult.message}
          </Alert>
        )}
      </Box>

      <Box sx={{ p: isMobile ? 2 : 3, pt: 1, borderTop: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} direction={isMobile ? 'column' : 'row'}>
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
      </Box>
    </Box>
  );
};

export default GeminiAuthSetup;