import React, { useState, useEffect, useRef } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, LinearProgress, Alert, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import getFriendlyErrorMessage from '../utils/friendlyErrors';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');

  // Consolidated state for FFmpeg status
  const [ffmpegStatus, setFfmpegStatus] = useState({
    ready: false,
    error: null,
    message: 'Carregando FFmpeg...',
  });

  // Consolidated state for the transcription process UI
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

    worker.current.onmessage = (event) => {
      const message = event.data;
      switch (message.status) {
        case 'ffmpeg_loading':
          setFfmpegStatus({ ready: false, error: null, message: 'Carregando FFmpeg...' });
          break;
        case 'ffmpeg_ready':
          setFfmpegStatus({ ready: true, error: null, message: 'FFmpeg pronto.' });
          break;
        case 'ffmpeg_error':
          const friendlyFfmpegError = getFriendlyErrorMessage(message.error);
          setFfmpegStatus({ ready: false, error: friendlyFfmpegError, message: 'Erro no FFmpeg.' });
          break;
        case 'progress':
            let progressPercentage = uiStatus.progress;
            let progressMessage = uiStatus.message;

            if (typeof message.progress === 'string') {
                progressMessage = message.progress;
                if (message.progress.startsWith('Downloading')) {
                    progressPercentage = 25;
                    progressMessage = 'Baixando arquivo de áudio...';
                } else if (message.progress.startsWith('Extracting')) {
                    progressPercentage = 35;
                    progressMessage = 'Extraindo e convertendo áudio...';
                }
            } else if (message.progress && message.progress.file) {
                // This handles the model download progress
                progressPercentage = 40 + (message.progress.progress || 0) * 0.5; // Scale model download from 40% to 90%
                progressMessage = `Baixando modelo de IA: ${message.progress.file} (${message.progress.progress.toFixed(2)}%)`;
            }

            setUiStatus({
                type: 'loading',
                message: progressMessage,
                progress: progressPercentage,
            });
            break;
        case 'complete':
            setUiStatus({ type: 'success', message: 'Transcrição concluída com sucesso!', progress: 100 });
            setTranscription(message.output);
            break;
        case 'error':
            const friendlyError = getFriendlyErrorMessage(message.error);
            setUiStatus({ type: 'error', message: friendlyError, progress: 0 });
            break;
      }
    };

    return () => {
      worker.current.terminate();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => navigate('/');

  const handleTranscribe = async () => {
    if (!videoUrl) {
      setUiStatus({ type: 'error', message: 'Por favor, insira a URL de um vídeo.', progress: 0 });
      return;
    }
    setTranscription('');
    setUiStatus({ type: 'loading', message: 'Inicializando...', progress: 5 });

    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}`;

    try {
      setUiStatus({ type: 'loading', message: 'Verificando a URL do vídeo...', progress: 10 });
      const preflightResponse = await fetch(proxyUrl);

      // Handle non-OK responses (e.g., 404, 500)
      if (!preflightResponse.ok) {
        let errorFromServer = `pre-flight check failed: ${preflightResponse.status}`;
        try {
          // Try to parse a JSON error from the proxy
          const errorJson = await preflightResponse.json();
          if (errorJson && errorJson.error) {
            errorFromServer = errorJson.error;
          }
        } catch (e) {
          // If JSON parsing fails, use the raw text
          errorFromServer = await preflightResponse.text();
        }

        setUiStatus({ type: 'error', message: getFriendlyErrorMessage(errorFromServer), progress: 0 });
        return;
      }

      // Handle the specific error where the response is OK but the content is an HTML page
      const contentType = preflightResponse.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        setUiStatus({ type: 'error', message: getFriendlyErrorMessage('Expected audio but received HTML'), progress: 0 });
        return;
      }

      // Optional: Check for valid media types to provide clearer feedback
      if (!contentType || (!contentType.startsWith('audio/') && !contentType.startsWith('video/') && !contentType.startsWith('application/octet-stream'))) {
          setUiStatus({ type: 'error', message: `Erro: O tipo de arquivo (${contentType}) não parece ser um áudio ou vídeo válido.`, progress: 0 });
          return;
      }

    } catch (e) {
      // Handle network errors (e.g., DNS, CORS, no connection)
      setUiStatus({ type: 'error', message: getFriendlyErrorMessage(e), progress: 0 });
      return;
    }

    setUiStatus({ type: 'loading', message: 'URL verificada. Enviando para o processador de áudio...', progress: 20 });

    worker.current.postMessage({
      audio: proxyUrl,
      model: 'Xenova/whisper-tiny',
      language: 'portuguese',
      task: 'transcribe',
    });
  };

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
              <Typography component="span" fontWeight="bold">Status FFmpeg: </Typography>
              {ffmpegStatus.error ? <Typography component="span" color="red" fontWeight="bold">❌ Erro</Typography> :
               ffmpegStatus.ready ? <Typography component="span" color="green" fontWeight="bold">✅ Carregado e Pronto</Typography> :
               <Typography component="span" color="orange" fontWeight="bold">⏳ Carregando...</Typography>
              }
            </Box>
            {ffmpegStatus.error && (
              <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                <Typography fontWeight="bold">Erro:</Typography>
                <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{ffmpegStatus.error}</Typography>
                {ffmpegStatus.error.includes('crossOriginIsolated') && (
                  <Box sx={{ mt: 1 }}>
                    <Typography fontWeight="bold">Como corrigir:</Typography>
                    <ol>
                      <li>Verifique se vite.config.js tem os headers COOP/COEP</li>
                      <li>Verifique se vercel.json tem os headers COOP/COEP</li>
                      <li>Reinicie o servidor de desenvolvimento completamente</li>
                      <li>Faça novo deploy no Vercel (se em produção)</li>
                      <li>Limpe o cache do navegador (Ctrl+Shift+R)</li>
                    </ol>
                  </Box>
                )}
              </Alert>
            )}
            {!ffmpegStatus.error && ffmpegStatus.ready && <Alert severity="success" sx={{ mt: 1 }}>Tudo pronto para transcrever.</Alert>}
          </CardContent>
        </Card>

        <Typography variant="body1" gutterBottom sx={{ mt: 2 }}>Insira a URL do vídeo que você deseja transcrever. O áudio será extraído e transcrito para texto.</Typography>
        <TextField
          label="URL do Vídeo"
          variant="outlined"
          fullWidth
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          sx={{ my: 2 }}
          disabled={isTranscribing || !ffmpegStatus.ready}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={isTranscribing || !ffmpegStatus.ready}
          fullWidth
          size="large"
          sx={{ mb: 2 }}
        >
          {isTranscribing ? <CircularProgress size={24} color="inherit" /> : 'Transcrever'}
        </Button>

        {(isTranscribing || uiStatus.type === 'error' || uiStatus.type === 'success') && (
            <Box sx={{ width: '100%', my: 2 }}>
                <Alert severity={uiStatus.type}>
                    {uiStatus.message}
                </Alert>
                {isTranscribing && <LinearProgress variant="determinate" value={uiStatus.progress || 0} sx={{mt: 1}} />}
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
