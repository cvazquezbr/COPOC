import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Container,
  CircularProgress,
  LinearProgress,
  Alert
} from '@mui/material';

// Function to format the transcription
const formatTranscription = (transcription) => {
    // Replace all occurrences of ">>" with a newline for better readability
    return transcription.replace(/>>/g, '\n');
};

const TranscriptionPage = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  // Create a reference to the worker object.
  const worker = useRef(null);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
      if (!worker.current) {
          // Create a new worker if it doesn't exist yet.
          worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
              type: 'module'
          });
      }

      // Create a callback function for messages from the worker thread.
      const onMessageReceived = (e) => {
          const message = e.data;
          switch (message.status) {
              case 'progress':
                  // Track the progress of the pipeline.
                  setProgress(message.progress);
                  break;
              case 'complete':
                  // When the transcription is complete, update the state.
                  setTranscription(formatTranscription(message.output));
                  setIsTranscribing(false);
                  break;
              case 'error':
                  // Handle any errors that occur during transcription.
                  setErrorMessage(message.data.message);
                  setIsTranscribing(false);
                  break;
              default:
                  // For any other messages, just log them to the console.
                  console.log(message);
                  break;
          }
      };

      // Attach the callback function as an event listener.
      worker.current.addEventListener('message', onMessageReceived);

      // Define a cleanup function for when the component is unmounted.
      return () => worker.current.removeEventListener('message', onMessageReceived);
  });


  const handleTranscribe = async () => {
    if (!videoUrl) {
      setErrorMessage('Please enter a video URL.');
      return;
    }
    setErrorMessage(null);
    setIsTranscribing(true);
    setTranscription('');
    setProgress(0);

    // Send the video URL to the worker.
    worker.current.postMessage({
        audio: videoUrl,
    });
  };

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom align="center">
          Transcrição de Vídeo
        </Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
          Cole a URL de um vídeo para transcrever o áudio. O processo é executado localmente no seu navegador e pode levar alguns minutos.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <TextField
            fullWidth
            label="URL do Vídeo"
            variant="outlined"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={isTranscribing}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleTranscribe}
            disabled={isTranscribing}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {isTranscribing ? <CircularProgress size={24} /> : 'Transcrever'}
          </Button>
        </Box>

        {errorMessage && (
            <Alert severity="error" sx={{ mb: 4 }}>
                {errorMessage}
            </Alert>
        )}

        {isTranscribing && (
          <Box sx={{ my: 4 }}>
            <Typography align="center" gutterBottom>Progresso: {(typeof progress === 'number' ? progress : 0).toFixed(2)}%</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress variant="determinate" value={progress || 0} />
                </Box>
            </Box>
          </Box>
        )}

        {transcription && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Transcrição:
            </Typography>
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    mt: 2,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap', // This will respect newlines and wrap text
                    backgroundColor: 'grey.100', // A light grey background for the transcription box
                    border: '1px solid',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    fontFamily: 'monospace', // A monospaced font can be good for transcriptions
                }}
            >
                {transcription}
            </Paper>

          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default TranscriptionPage;
