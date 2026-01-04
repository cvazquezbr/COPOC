import React, { useState, useEffect, useRef } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, LinearProgress, Alert, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import getFriendlyErrorMessage from '../utils/friendlyErrors';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');

  // Unified system status
  const [systemStatus, setSystemStatus] = useState({
    status: 'initializing', // 'initializing', 'ready', 'error'
    message: 'Iniciando sistema de transcrição...',
  });

  // State for the active transcription process UI
  const [uiStatus, setUiStatus] = useState({
    type: 'info', // 'info', 'loading', 'success', 'error'
    message: 'Aguardando URL do vídeo.',
    progress: 0,
  });

  const isTranscribing = uiStatus.type === 'loading';
  const worker = useRef(null);

  useEffect(() => {
    worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
      type: 'module'
    });

    // Handle unexpected worker errors
    worker.current.onerror = (error) => {
        console.error("Worker error:", error);
        setSystemStatus({
            status: 'error',
            message: `Ocorreu um erro crítico no worker: ${error.message}`
        });
    };

    // --- Worker Message Handler ---
    worker.current.onmessage = (event) => {
      const msg = event.data;

      switch (msg.status) {
        // Initialization statuses
        case 'ffmpeg_loading':
          setSystemStatus({ status: 'initializing', message: 'Carregando FFmpeg...' });
          break;
        case 'ffmpeg_ready':
          setSystemStatus({ status: 'initializing', message: 'FFmpeg pronto. Carregando modelo de IA...' });
          break;
        case 'transcriber_loading':
          setSystemStatus({ status: 'initializing', message: 'Carregando modelo de IA...' });
          break;
        case 'model_download_progress':
          const { file, progress } = msg.progress;
          setSystemStatus(prev => ({ ...prev, message: `Baixando modelo: ${file} (${progress.toFixed(2)}%)` }));
          break;
        case 'transcriber_ready':
            setSystemStatus({ status: 'initializing', message: 'Modelo de IA pronto. Finalizando...' });
            break;
        case 'INIT_COMPLETE':
            setSystemStatus({ status: 'ready', message: 'Sistema pronto para transcrever.' });
            break;

        // Initialization or critical errors
        case 'ERROR': // From worker's own catch block during init
        case 'ffmpeg_error':
        case 'transcriber_error':
          setSystemStatus({ status: 'error', message: getFriendlyErrorMessage(msg.error) });
          break;

        // Transcription process statuses
        case 'audio_downloading':
          setUiStatus({ type: 'loading', message: 'Baixando e verificando áudio...', progress: 0 });
          break;
        case 'audio_converting':
          setUiStatus({ type: 'loading', message: 'Convertendo áudio para o formato correto...', progress: 50 });
          break;
        case 'transcribing':
          setUiStatus({ type: 'loading', message: 'Processando áudio e transcrevendo...', progress: 75 });
          break;

        // Final states
        case 'complete':
          setUiStatus({ type: 'success', message: 'Transcrição concluída com sucesso!', progress: 100 });
          setTranscription(msg.output);
          break;
        case 'error': // For transcription-specific errors
          setUiStatus({ type: 'error', message: getFriendlyErrorMessage(msg.error), progress: 0 });
          break;
      }
    };

    // Start the initialization process
    worker.current.postMessage({ type: 'INIT' });

    return () => worker.current.terminate();
  }, []);

  const handleBack = () => navigate('/');

  const handleTranscribe = async () => {
    if (!videoUrl) {
      setUiStatus({ type: 'error', message: 'Por favor, insira a URL de um vídeo.', progress: 0 });
      return;
    }
    setTranscription('');
    setUiStatus({ type: 'loading', message: 'Inicializando verificação...', progress: 0 });

    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}`;

    try {
      setUiStatus({ type: 'loading', message: 'Verificando a URL...', progress: 0 });
      const preflight = await fetch(proxyUrl);
      if (!preflight.ok) {
        let errorText = `Falha na verificação da URL: ${preflight.status}`;
        try {
          const errBody = await preflight.text();
          // Vercel might return HTML for some errors, let's show it.
          errorText = errBody.includes('<') ? `Erro do servidor (HTML recebido)` : (await JSON.parse(errBody)).error || errorText;
        } catch (e) { /* ignore parse error */ }
        throw new Error(errorText);
      }
      const contentType = preflight.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('A URL retornou uma página HTML em vez de um arquivo de mídia.');
      }
    } catch (e) {
      setUiStatus({ type: 'error', message: getFriendlyErrorMessage(e), progress: 0 });
      return;
    }

    setUiStatus({ type: 'loading', message: 'URL verificada. Iniciando processo...', progress: 0 });
    worker.current.postMessage({
      audio: proxyUrl,
      language: 'portuguese',
      task: 'transcribe',
    });
  };

  const systemReady = systemStatus.status === 'ready';

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>Voltar</Button>
        <Typography variant="h4" component="h1" gutterBottom>Gestão de Transcrições</Typography>

        <Card sx={{ my: 2, bgcolor: 'grey.50', border: '2px solid #ddd' }}>
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>Status do Sistema</Typography>
            <Box sx={{ mb: 1 }}>
              <Typography component="span" fontWeight="bold">Cross-Origin Isolation: </Typography>
              {(typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated) ?
                <Typography component="span" color="green" fontWeight="bold">✅ Habilitado</Typography> :
                <Typography component="span" color="red" fontWeight="bold">❌ Desabilitado</Typography>
              }
            </Box>
            <Box>
              <Typography component="span" fontWeight="bold">Status: </Typography>
              {systemStatus.status === 'initializing' && <Typography component="span" color="orange">⏳ {systemStatus.message}</Typography>}
              {systemStatus.status === 'ready' && <Typography component="span" color="green">✅ {systemStatus.message}</Typography>}
              {systemStatus.status === 'error' && <Typography component="span" color="red">❌ {systemStatus.message}</Typography>}
            </Box>
            {systemStatus.status === 'error' && <Alert severity="error" sx={{ mt: 2 }}>O sistema encontrou um erro e não pode continuar. Verifique o console para detalhes.</Alert>}
          </CardContent>
        </Card>

        <Typography variant="body1" gutterBottom sx={{ mt: 2 }}>Insira a URL do vídeo ou áudio. O sistema irá baixar, converter e transcrever o conteúdo.</Typography>
        <TextField
          label="URL do Vídeo ou Áudio"
          variant="outlined"
          fullWidth
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          sx={{ my: 2 }}
          disabled={isTranscribing || !systemReady}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={isTranscribing || !systemReady}
          fullWidth
          size="large"
          sx={{ mb: 2 }}
        >
          {isTranscribing ? <CircularProgress size={24} color="inherit" /> : 'Transcrever'}
        </Button>

        {(isTranscribing || uiStatus.type === 'error' || uiStatus.type === 'success') && (
            <Box sx={{ width: '100%', my: 2 }}>
                <Alert severity={uiStatus.type} sx={{wordBreak: 'break-word'}}>
                    {uiStatus.message}
                </Alert>
                {isTranscribing && <LinearProgress variant="determinate" value={uiStatus.progress} sx={{mt: 1}} />}
            </Box>
        )}

        {transcription && (
          <Paper elevation={3} sx={{ p: 2, mt: 4, maxHeight: '400px', overflow: 'auto' }}>
            <Typography variant="h6" component="h2">Transcrição:</Typography>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{transcription}</Typography>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default TranscriptionPage;
