import React, { useState, useEffect, useRef } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, LinearProgress, Alert, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import getFriendlyErrorMessage from '../utils/friendlyErrors';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');

  // State for FFmpeg status
  const [ffmpegStatus, setFfmpegStatus] = useState({
    ready: false,
    error: null,
    message: 'Aguardando FFmpeg...',
  });

  // State for the AI transcriber model status
  const [transcriberStatus, setTranscriberStatus] = useState({
      ready: false,
      error: null,
      message: 'Aguardando modelo de IA...',
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

    // --- Worker Message Handler ---
    worker.current.onmessage = (event) => {
      const msg = event.data;

      switch (msg.status) {
        // FFmpeg statuses
        case 'ffmpeg_loading':
          setFfmpegStatus({ ready: false, error: null, message: 'Carregando FFmpeg...' });
          break;
        case 'ffmpeg_ready':
          setFfmpegStatus({ ready: true, error: null, message: 'FFmpeg pronto.' });
          break;
        case 'ffmpeg_error':
          setFfmpegStatus({ ready: false, error: getFriendlyErrorMessage(msg.error), message: 'Erro no FFmpeg.' });
          break;

        // Transcriber statuses
        case 'transcriber_loading':
          setTranscriberStatus({ ready: false, error: null, message: 'Carregando modelo de IA...' });
          break;
        case 'transcriber_ready':
          setTranscriberStatus({ ready: true, error: null, message: 'Modelo de IA pronto.' });
          break;
        case 'transcriber_error':
            setTranscriberStatus({ ready: false, error: getFriendlyErrorMessage(msg.error), message: 'Erro no modelo de IA.' });
            break;

        // Model download progress
        case 'model_download_progress':
          const { file, progress } = msg.progress;
          setTranscriberStatus(prev => ({ ...prev, message: `Baixando modelo: ${file} (${progress.toFixed(2)}%)` }));
          // Also update the main UI progress bar
          setUiStatus({
              type: 'loading',
              message: `Baixando modelo de IA: ${file}`,
              progress: progress
          });
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
        case 'error':
          setUiStatus({ type: 'error', message: getFriendlyErrorMessage(msg.error), progress: 0 });
          break;
      }
    };

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
        let error = `Falha na verificação da URL: ${preflight.status}`;
        try {
          const errJson = await preflight.json();
          if (errJson.error) error = errJson.error;
        } catch (e) { /* ignore json parse error */ }
        throw new Error(error);
      }

      const contentType = preflight.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Expected audio but received HTML');
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

  const systemReady = ffmpegStatus.ready && transcriberStatus.ready;

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>Voltar</Button>
        <Typography variant="h4" component="h1" gutterBottom>Gestão de Transcrições</Typography>

        {/* --- System Status Card --- */}
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
            <Box sx={{ mb: 1 }}>
              <Typography component="span" fontWeight="bold">FFmpeg: </Typography>
              {ffmpegStatus.error ? <Typography component="span" color="red">❌ {ffmpegStatus.error}</Typography> :
               ffmpegStatus.ready ? <Typography component="span" color="green">✅ Pronto</Typography> :
               <Typography component="span" color="orange">⏳ Carregando...</Typography>
              }
            </Box>
            <Box>
              <Typography component="span" fontWeight="bold">Modelo de IA: </Typography>
              {transcriberStatus.error ? <Typography component="span" color="red">❌ {transcriberStatus.error}</Typography> :
               transcriberStatus.ready ? <Typography component="span" color="green">✅ Pronto</Typography> :
               <Typography component="span" color="orange">⏳ {transcriberStatus.message}</Typography>
              }
            </Box>

            {(!systemReady && !ffmpegStatus.error && !transcriberStatus.error) && <Alert severity="info" sx={{ mt: 2 }}>O sistema está preparando as ferramentas. Isso pode levar um minuto na primeira vez.</Alert>}
            {(ffmpegStatus.error || transcriberStatus.error) && <Alert severity="error" sx={{ mt: 2 }}>O sistema encontrou um erro e não pode continuar.</Alert>}
            {systemReady && <Alert severity="success" sx={{ mt: 2 }}>Sistema pronto para transcrever.</Alert>}

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

        {/* --- Progress and Result Area --- */}
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
