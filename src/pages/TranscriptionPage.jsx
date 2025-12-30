import React, { useState, useRef, useEffect } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const worker = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const handleMessage = (event) => {
      const { type, detail, audioData } = event.data;
      switch (type) {
        case 'ffmpeg-loaded':
          setFfmpegReady(true);
          setProgressStatus('');
          break;
        case 'audio-extracted':
          worker.current.postMessage({
            audioData: audioData,
            model: 'Xenova/whisper-tiny',
            language: 'portuguese',
            task: 'transcribe',
          });
          break;
        case 'progress':
          setProgressStatus(detail);
          break;
        case 'error':
          alert(`An error occurred in the FFmpeg process: ${detail}`);
          setIsTranscribing(false);
          setProgressStatus('');
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    setProgress(0);
    setProgressStatus('Initializing...');

    // Setup transcription worker
    worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
      type: 'module'
    });

    worker.current.onmessage = (event) => {
      const message = event.data;
      switch (message.status) {
        case 'progress':
          setProgress(message.progress.progress || 0);
          setProgressStatus(`Downloading model: ${message.progress.file}`);
          break;
        case 'complete':
          setTranscription(message.output);
          setIsTranscribing(false);
          setProgressStatus('');
          worker.current.terminate();
          break;
        case 'error':
          alert('Ocorreu um erro durante a transcrição: ' + message.error);
          setIsTranscribing(false);
          setProgressStatus('');
          worker.current.terminate();
          break;
      }
    };

    // Send video to iframe for audio extraction
    const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}`;
    iframeRef.current.contentWindow.postMessage({ type: 'extract-audio', videoUrl: proxyUrl }, '*');
  };

  return (
    <Container maxWidth="md">
        <iframe
            ref={iframeRef}
            src="/ffmpeg-loader.html"
            style={{ display: 'none' }}
            title="FFmpeg Loader"
        />
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
          disabled={!ffmpegReady || isTranscribing}
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
