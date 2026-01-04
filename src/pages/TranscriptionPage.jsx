
import React, { useState, useRef, useEffect } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import getFriendlyErrorMessage from '../utils/friendlyErrors';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState('Aguardando...');
  const [workerReady, setWorkerReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const worker = useRef(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessage = (e) => {
      switch (e.data.status) {
        case 'ffmpeg_loading':
          setStatus('Carregando FFmpeg...');
          break;
        case 'ffmpeg_ready':
          setStatus('FFmpeg carregado.');
          break;
        case 'transcriber_loading':
          setStatus('Carregando modelo de transcrição...');
          break;
        case 'transcriber_ready':
          setStatus('Modelo de transcrição carregado.');
          setWorkerReady(true);
          break;
        case 'audio_downloading':
          setStatus('Baixando áudio...');
          break;
        case 'audio_converting':
          setStatus('Convertendo áudio...');
          break;
        case 'transcribing':
          setStatus('Transcrevendo áudio...');
          break;
        case 'complete':
          setTranscription(e.data.output);
          setStatus('Transcrição concluída.');
          setIsTranscribing(false);
          break;
        case 'error':
          setError(e.data.error);
          setStatus('Ocorreu um erro.');
          setIsTranscribing(false);
          break;
        default:
          break;
      }
    };

    worker.current.addEventListener('message', onMessage);

    worker.current.postMessage({ type: 'INIT' });

    return () => {
      worker.current.removeEventListener('message', onMessage);
      worker.current.terminate();
    };
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  const handleTranscribe = async () => {
    if (!videoUrl) {
      alert('Por favor, insira a URL de um vídeo.');
      return;
    }
    setIsTranscribing(true);
    setTranscription('');
    setError(null);
    setStatus('Iniciando...');

    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}`;

    // --- Pre-flight Check ---
    try {
        const preflightResponse = await fetch(proxyUrl);
        if (!preflightResponse.ok) {
            const errorText = await preflightResponse.text();
            throw new Error(`Proxy pre-flight check failed: ${preflightResponse.status} ${preflightResponse.statusText}. Server response: ${errorText}`);
        }
        const contentType = preflightResponse.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            const errorText = await preflightResponse.text();
            throw new Error(`Expected audio but received HTML. Server error: ${errorText}`);
        }
    } catch (e) {
        setError(e.message);
        setIsTranscribing(false);
        return;
    }
    // --- End Pre-flight Check ---

    worker.current.postMessage({
      audio: proxyUrl,
      language: 'portuguese',
      task: 'transcribe',
    });
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>
          Voltar
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Gestão de Transcrições
        </Typography>

        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Status do Sistema</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body1" sx={{ minWidth: '200px' }}><strong>Cross-Origin Isolation:</strong></Typography>
                {crossOriginIsolated ? (
                    <Typography color="green" sx={{ fontWeight: 'bold' }}>✅ Habilitado</Typography>
                ) : (
                    <Typography color="error" sx={{ fontWeight: 'bold' }}>❌ Desabilitado (Headers ausentes)</Typography>
                )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body1" sx={{ minWidth: '200px' }}><strong>Worker de Transcrição:</strong></Typography>
                {workerReady ? (
                    <Typography color="green" sx={{ fontWeight: 'bold' }}>✅ Pronto</Typography>
                ) : (
                    <Typography color="orange" sx={{ fontWeight: 'bold' }}>⏳ Carregando...</Typography>
                )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body1" sx={{ minWidth: '200px' }}><strong>Progresso:</strong></Typography>
                <Typography>{status}</Typography>
            </Box>
        </Paper>

        <Typography variant="body1" gutterBottom>
          Insira a URL do vídeo que você deseja transcrever. O áudio será extraído e transcrito para texto.
        </Typography>
        <TextField
          label="URL do Vídeo"
          variant="outlined"
          fullWidth
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          sx={{ my: 2 }}
          disabled={isTranscribing || !workerReady}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={isTranscribing || !workerReady || !videoUrl}
          fullWidth
          size="large"
          sx={{ mb: 2 }}
        >
          {isTranscribing ? <CircularProgress size={24} color="inherit" /> : 'Transcrever'}
        </Button>

        {error && (
          <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {getFriendlyErrorMessage(error)}
          </Alert>
        )}

        {transcription && (
          <Paper elevation={3} sx={{ p: 2, mt: 4, maxHeight: '400px', overflow: 'auto' }}>
            <Typography variant="h6" component="h2">
              Transcrição:
            </Typography>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {transcription}
            </Typography>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default TranscriptionPage;
