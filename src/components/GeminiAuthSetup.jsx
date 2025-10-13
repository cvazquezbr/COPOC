import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../context/UserAuthContext';
import geminiAPI from '../utils/geminiAPI';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, IconButton, Alert, FormControl, InputLabel, Select, MenuItem, Grid } from '@mui/material';
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
  const [models, setModels] = useState([]);

  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-pro');

  useEffect(() => {
    if (user) {
      setApiKey(user.gemini_api_key || '');
      setSelectedModel(user.gemini_model || 'gemini-pro');
    }
  }, [user]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!apiKey) return;
      try {
        geminiAPI.initialize(apiKey);
        const modelList = await geminiAPI.listModels();
        setModels(modelList);
        if (modelList.length > 0 && !modelList.some(m => m.name === selectedModel)) {
          setSelectedModel(modelList[0].name);
        }
      } catch (error) {
        console.error("Failed to fetch Gemini models:", error);
        toast.error("Não foi possível buscar os modelos Gemini. Verifique sua chave de API.");
        setModels([]);
      }
    };
    fetchModels();
  }, [apiKey]);

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
      <Box>
        <Grid container spacing={2} alignItems="center" justifyContent="space-between">
          <Grid item>
            <Typography variant="h6" component="div">
              API Gemini
            </Typography>
          </Grid>
          <Grid item>
            <IconButton onClick={() => setShowInfobox(true)} aria-label="show info">
              <InfoIcon />
            </IconButton>
          </Grid>
        </Grid>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
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
            onChange={handleApiKeyChange}
            placeholder="Cole sua chave da API aqui"
            size="small"
          />
          <IconButton onClick={toggleShowKey} edge="end" sx={{ ml: 1 }} aria-label="toggle key visibility">
            {showKey ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </Box>

        {apiKey && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, wordBreak: 'break-all' }}>
            Chave atual: {getMaskedKey(apiKey)}
          </Typography>
        )}

        <FormControl fullWidth size="small">
          <InputLabel id="gemini-model-select-label">Modelo Gemini</InputLabel>
          <Select
            labelId="gemini-model-select-label"
            id="gemini-model-select"
            value={selectedModel}
            label="Modelo Gemini"
            onChange={handleModelChange}
            disabled={!apiKey || models.length === 0}
          >
            {models.length > 0 ? (
              models.map((model) => (
                <MenuItem key={model.name} value={model.name}>
                  <Typography variant="body2" component="span">{model.displayName}</Typography>
                  <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    ({model.name.replace('models/', '')})
                  </Typography>
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>
                {apiKey ? 'Buscando modelos...' : 'Insira a chave para listar os modelos'}
              </MenuItem>
            )}
          </Select>
        </FormControl>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}

        <Grid container spacing={1} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6}>
            <Button
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey}
              variant="outlined"
              fullWidth
            >
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
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