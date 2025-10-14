import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import geminiAPI from '../utils/geminiAPI';
import {
  TextField, Button, Typography, Box, IconButton, Alert, FormControl,
  InputLabel, Select, MenuItem, Grid, useTheme, useMediaQuery,
  CircularProgress, InputAdornment
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

const GeminiAuthSetup = () => {
  const { user, saveSettings } = useUserAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Component state
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [models, setModels] = useState([]);

  // Effect to sync component state with user context
  useEffect(() => {
    // Initialize from user context, but allow local edits
    setApiKey(user?.gemini_api_key || '');
    setSelectedModel(user?.gemini_model || 'gemini-pro');
  }, [user?.gemini_api_key, user?.gemini_model]); // Depend on specific properties

  // Effect to fetch models when API key changes
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
        // If the currently selected model is not in the new list, reset it
        if (modelList.length > 0 && !modelList.some(m => m.name === selectedModel)) {
          setSelectedModel(modelList[0].name);
        }
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
      // The user context will update, and the useEffect will sync the state
    } catch (err) {
      // Error toast is already handled in saveSettings
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    setIsSaving(true);
    try {
      // This will trigger a save with empty values
      await saveSettings({
        gemini_api_key: '',
        gemini_model: 'gemini-pro',
      });
      // State will be updated via useEffect listening to user context
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Scrollable Content Area */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: isMobile ? 2 : 3, minHeight: 0 }}>
        <Typography variant="h6" component="div" sx={{ mb: 1 }}>
          API Gemini
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Insira sua chave da API do Google AI Studio para ativar os recursos de IA.
        </Typography>

        <TextField
          autoFocus
          id="gemini-api-key"
          label="Chave da API Gemini"
          type={showKey ? 'text' : 'password'}
          fullWidth
          variant="outlined"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            setTestResult(null); // Clear test result on key change
          }}
          placeholder="Cole sua chave da API aqui"
          size="small"
          sx={{ mb: 2 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle key visibility"
                  onClick={() => setShowKey(!showKey)}
                  edge="end"
                >
                  {showKey ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel id="gemini-model-select-label">Modelo Gemini</InputLabel>
          <Select
            labelId="gemini-model-select-label"
            id="gemini-model-select"
            value={selectedModel}
            label="Modelo Gemini"
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={!apiKey || models.length === 0}
            MenuProps={{
              sx: { '& .MuiPaper-root': { maxWidth: '90vw' } },
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

      {/* Fixed Actions Footer */}
      <Box sx={{ p: isMobile ? 2 : 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center" direction={isMobile ? 'column' : 'row'}>
          <Grid item xs={4}>
            <Button onClick={handleSave} disabled={isSaving} variant="contained" fullWidth>
              {isSaving ? <CircularProgress size={24} color="inherit" /> : 'Salvar'}
            </Button>
          </Grid>
          <Grid item xs={4}>
            <Button onClick={handleTestConnection} disabled={isTesting || !apiKey} variant="outlined" fullWidth>
              {isTesting ? 'Testando...' : 'Testar'}
            </Button>
          </Grid>
          <Grid item xs={4}>
            {apiKey && (
              <Button onClick={handleRemove} color="error" variant="outlined" fullWidth disabled={isSaving}>
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