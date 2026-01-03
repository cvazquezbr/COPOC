import React, { useState, useEffect } from 'react';
import { Container, TextField, Button, Typography, Box, Paper, CircularProgress, LinearProgress, Alert, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ffmpegService from '../services/ffmpegService';
import { fetchFile } from '@ffmpeg/util';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const [audioUrl, setAudioUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        if (typeof crossOriginIsolated === 'undefined' || !crossOriginIsolated) {
          throw new Error(
            'Cross-origin isolation não está habilitada. FFmpeg.wasm requer headers COOP e COEP. Verifique vite.config.js e vercel.json.'
          );
        }
        await ffmpegService.load();
        setFfmpegReady(true);
      } catch (err) {
        console.error('Erro ao carregar FFmpeg:', err);
        setError(err.message);
      }
    };
    loadFFmpeg();
  }, []);

  const handleBack = () => navigate('/');

  const handleTranscribe = async () => {
    if (!audioUrl || !ffmpegReady) return;

    setLoading(true);
    setLoadingMessage('Iniciando...');
    setError(null);
    setTranscription('');

    try {
      const ffmpeg = ffmpegService.getFFmpeg();
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(audioUrl)}`;

      setLoadingMessage('Baixando áudio...');
      const audioData = await fetchFile(proxyUrl);

      setLoadingMessage('Escrevendo áudio no sistema virtual...');
      await ffmpeg.writeFile('input.audio', audioData);

      setLoadingMessage('Convertendo formato de áudio...');
      await ffmpeg.exec(['-i', 'input.audio', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', 'output.wav']);

      setLoadingMessage('Lendo áudio convertido...');
      const outputData = await ffmpeg.readFile('output.wav');
      const audioBlob = new Blob([outputData.buffer], { type: 'audio/wav' });

      setLoadingMessage('Enviando para API de transcrição...');
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');

      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro na API: ${response.status} - ${errText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(`Erro na API: ${result.error}`);
      }
      setTranscription(result.transcription);

      await ffmpeg.deleteFile('input.audio');
      await ffmpeg.deleteFile('output.wav');
    } catch (err) {
      console.error('Erro na transcrição:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
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
                    {error ? <Typography component="span" color="red" fontWeight="bold">❌ Erro</Typography> :
                     ffmpegReady ? <Typography component="span" color="green" fontWeight="bold">✅ Carregado e Pronto</Typography> :
                     <Typography component="span" color="orange" fontWeight="bold">⏳ Carregando...</Typography>
                    }
                </Box>
                {!error && ffmpegReady && <Alert severity="success" sx={{mt: 1}}>Tudo pronto para transcrever.</Alert>}
            </CardContent>
        </Card>

        {error && (
          <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            <Typography fontWeight="bold">Erro:</Typography>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{error}</Typography>
             {error.includes('Cross-origin isolation') && (
              <Box sx={{mt: 1}}>
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

        <Typography variant="body1" gutterBottom sx={{mt: 2}}>Insira a URL do vídeo que você deseja transcrever. O áudio será extraído e transcrito para texto.</Typography>
        <TextField
          label="URL do Vídeo/Áudio"
          variant="outlined"
          fullWidth
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
          sx={{ my: 2 }}
          disabled={!ffmpegReady || loading}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={!ffmpegReady || loading || !audioUrl}
          fullWidth
          size="large"
          sx={{ mb: 2 }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Transcrever'}
        </Button>

        {loading && (
          <Box sx={{ width: '100%', my: 2 }}>
            <Typography variant="body2" color="text.secondary">{loadingMessage}</Typography>
            <LinearProgress />
          </Box>
        )}

        {transcription && (
          <Paper elevation={3} sx={{ p: 2, mt: 4, maxHeight: '400px', overflow: 'auto' }}>
            <Typography variant="h6" component="h2">Transcrição Concluída:</Typography>
            <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{transcription}</Typography>
            <Button onClick={() => navigator.clipboard.writeText(transcription)} sx={{mt: 1}}>Copiar</Button>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default TranscriptionPage;
