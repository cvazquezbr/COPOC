
import React, { useState, useRef } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, LinearProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const worker = useRef(null);

  const handleBack = () => {
    navigate('/');
  };

  const handleTranscribe = () => {
    if (!videoUrl) {
      alert('Por favor, insira a URL de um vídeo.');
      return;
    }
    setIsTranscribing(true);
    setTranscription('');
    setError(null);
    setProgress(0);
    setProgressStatus('Initializing...');

    worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
        type: 'module'
    });

    worker.current.onmessage = (event) => {
        const message = event.data;
        switch (message.status) {
            case 'progress':
                if (typeof message.progress === 'string') {
                    setProgressStatus(message.progress);
                    if (message.progress === 'Downloading audio...') {
                        setProgress(10);
                    } else if (message.progress === 'Extracting audio...') {
                        setProgress(20);
                    } else {
                        setProgress(0);
                    }
                } else if (message.progress) {
                    // This is for model download progress
                    const downloadProgress = message.progress.progress || 0;
                    setProgress(20 + downloadProgress * 0.6); // Scale model download to be between 20% and 80%
                    setProgressStatus(`Downloading model: ${message.progress.file}`);
                }
                break;
            case 'complete':
                setTranscription(message.output);
                setIsTranscribing(false);
                setProgress(0);
                setProgressStatus('');
                worker.current.terminate();
                break;
            case 'error':
                setError(message.error);
                setIsTranscribing(false);
                setProgress(0);
                setProgressStatus('');
                worker.current.terminate();
                break;
        }
    };

    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}`;

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
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>
          Voltar
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Gestão de Transcrições
        </Typography>
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
          disabled={isTranscribing}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={isTranscribing}
          fullWidth
          size="large"
          sx={{ mb: 2 }}
        >
          {isTranscribing ? <CircularProgress size={24} color="inherit" /> : 'Transcrever'}
        </Button>

        {isTranscribing && (
          <Box sx={{ width: '100%', my: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {progressStatus} {progress > 0 && `(${progress.toFixed(2)}%)`}
            </Typography>
            <LinearProgress variant="determinate" value={progress || 0} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
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
