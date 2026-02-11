import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Link
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import TranslateIcon from '@mui/icons-material/Translate';
import { toast } from 'sonner';
import { useUserAuth } from '../context/UserAuthContext';
import geminiAPI from '../utils/geminiAPI';

const InstagramExtractorPage = () => {
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const [urlInput, setUrlInput] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workerReady, setWorkerReady] = useState(false);
  const [globalIsProcessing, setGlobalIsProcessing] = useState(false);
  const worker = useRef(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessage = (e) => {
      if (e.data.status === 'transcriber_ready') {
        setWorkerReady(true);
      } else if (e.data.status === 'ffmpeg_log') {
        console.log('FFmpeg Log:', e.data.message);
      }
    };

    worker.current.addEventListener('message', onMessage);
    worker.current.postMessage({ type: 'INIT' });

    return () => {
      if (worker.current) {
        worker.current.removeEventListener('message', onMessage);
        worker.current.terminate();
        worker.current = null;
      }
    };
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  const handleExtract = async () => {
    // Split by newlines or commas and filter empty strings
    const urls = urlInput
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      toast.error('Por favor, insira pelo menos uma URL do Instagram.');
      return;
    }

    if (urls.length > 30) {
      toast.error('O limite é de 30 URLs por vez.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch('/api/instagram/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || errData.message || 'Erro ao processar a solicitação.');
      }

      const data = await response.json();
      setResults(data);
      toast.success('Extração concluída!');
    } catch (err) {
      console.error('Error extracting URLs:', err);
      setError(err.message);
      toast.error('Erro ao extrair URLs.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado para a área de transferência!');
  };

  const handleTranscribeAndTranslate = async (index) => {
    const result = results[index];
    if (!result.mp4_url) return;

    // Update processing state for this item
    const updateResult = (updates) => {
      setResults(prev => {
        const newResults = [...prev];
        newResults[index] = { ...newResults[index], ...updates };
        return newResults;
      });
    };

    updateResult({ isProcessing: true, processingStatus: 'Iniciando transcrição...' });
    setGlobalIsProcessing(true);

    try {
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(result.mp4_url)}`;

      // --- Pre-flight Check ---
      try {
          const preflightResponse = await fetch(proxyUrl);
          if (!preflightResponse.ok) {
              const errorText = await preflightResponse.text();
              let detailedError = `Falha no proxy: ${preflightResponse.status}`;
              try {
                  const errJson = JSON.parse(errorText);
                  if (errJson.error) detailedError += ` - ${errJson.error}`;
                  if (errJson.detectedHost) detailedError += ` (Host: ${errJson.detectedHost})`;
              } catch (e) {
                  // Not JSON, use raw text if short
                  if (errorText.length < 100) detailedError += ` - ${errorText}`;
              }
              throw new Error(detailedError);
          }
          const contentType = preflightResponse.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
              throw new Error('O proxy retornou HTML em vez de um arquivo de mídia. O link pode ter expirado.');
          }
      } catch (e) {
          console.error('Pre-flight check failed:', e);
          updateResult({ isProcessing: false, processingStatus: `Erro: ${e.message}` });
          toast.error(`Erro: ${e.message}`);
          setGlobalIsProcessing(false);
          return;
      }
      // --- End Pre-flight Check ---

      // Transcription promise
      const transcription = await new Promise((resolve, reject) => {
        const onMessage = (e) => {
          if (e.data.status === 'complete') {
            worker.current.removeEventListener('message', onMessage);
            resolve(e.data.output);
          } else if (e.data.status === 'error') {
            worker.current.removeEventListener('message', onMessage);
            reject(new Error(e.data.error));
          } else if (e.data.status === 'audio_downloading') {
            updateResult({ processingStatus: 'Baixando áudio...' });
          } else if (e.data.status === 'audio_converting') {
            updateResult({ processingStatus: 'Convertendo áudio...' });
          } else if (e.data.status === 'transcribing') {
            updateResult({ processingStatus: 'Transcrevendo...' });
          } else if (e.data.status === 'ffmpeg_log') {
            console.log(`FFmpeg [Item ${index}]:`, e.data.message);
          }
        };
        worker.current.addEventListener('message', onMessage);
        worker.current.postMessage({
          audio: proxyUrl,
          language: 'portuguese',
          task: 'transcribe',
        });
      });

      updateResult({ transcription, processingStatus: 'Aguardando 2s para tradução...' });

      // 2-second delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateResult({ processingStatus: 'Traduzindo para espanhol...' });

      if (!user?.gemini_api_key) {
        throw new Error('Chave da API Gemini não configurada.');
      }

      geminiAPI.initialize(user.gemini_api_key);
      const translation = await geminiAPI.translateText(transcription, 'Espanhol', user.gemini_model);

      updateResult({ translation, isProcessing: false, processingStatus: 'Concluído' });
      toast.success('Transcrição e tradução concluídas!');
    } catch (err) {
      console.error('Error in transcribe/translate:', err);
      updateResult({ isProcessing: false, processingStatus: `Erro: ${err.message}` });
      toast.error(`Erro: ${err.message}`);
    } finally {
      setGlobalIsProcessing(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>
          Voltar
        </Button>
        <Typography variant="h4" component="h1" gutterBottom>
          Extração de Vídeos Instagram
        </Typography>

        <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>Status do Sistema</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="body1" sx={{ minWidth: '200px' }}><strong>Cross-Origin Isolation:</strong></Typography>
            {window.crossOriginIsolated ? (
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
        </Paper>

        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="body1" gutterBottom>
            Insira até 30 URLs de posts ou Reels do Instagram (uma por linha ou separadas por vírgula).
          </Typography>
          <TextField
            label="URLs do Instagram"
            multiline
            rows={5}
            fullWidth
            variant="outlined"
            placeholder="https://www.instagram.com/p/...\nhttps://www.instagram.com/reels/..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            disabled={isLoading}
            sx={{ mt: 2, mb: 2 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleExtract}
            disabled={isLoading || !urlInput.trim()}
            fullWidth
            size="large"
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayCircleOutlineIcon />}
          >
            {isLoading ? 'Processando...' : 'Extrair Links MP4'}
          </Button>

          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            Nota: Os links MP4 gerados pelo Instagram têm validade temporária.
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 4 }}>
            {error}
          </Alert>
        )}

        {results.length > 0 && (
          <TableContainer component={Paper} elevation={3}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>URL Original</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Link MP4</TableCell>
                  <TableCell align="center">Ações</TableCell>
                  <TableCell align="center">Transcrição / Tradução</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((result, index) => (
                  <React.Fragment key={index}>
                  <TableRow>
                    <TableCell sx={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Tooltip title={result.original_url}>
                        <Link href={result.original_url} target="_blank" rel="noopener">
                          {result.original_url}
                        </Link>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {result.status === 'success' ? (
                        <Typography color="success.main" variant="body2" sx={{ fontWeight: 'bold' }}>Sucesso</Typography>
                      ) : (
                        <Tooltip title={result.error || 'Erro desconhecido'}>
                          <Typography color="error.main" variant="body2" sx={{ fontWeight: 'bold', cursor: 'help' }}>Erro</Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.mp4_url ? (
                        <Tooltip title={result.mp4_url}>
                          <Typography variant="body2">{result.mp4_url}</Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {result.mp4_url && (
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <IconButton size="small" onClick={() => copyToClipboard(result.mp4_url)} title="Copiar Link MP4">
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            component="a"
                            href={result.mp4_url}
                            target="_blank"
                            rel="noopener"
                            title="Abrir Vídeo"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {result.mp4_url && result.status === 'success' && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={result.isProcessing ? <CircularProgress size={16} /> : <TranslateIcon />}
                          onClick={() => handleTranscribeAndTranslate(index)}
                          disabled={globalIsProcessing || !workerReady}
                        >
                          {result.isProcessing ? 'Processando...' : 'Transcrever e Traduzir'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {result.processingStatus && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="caption" color="primary">
                          Status: {result.processingStatus}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {(result.transcription || result.translation) && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                          {result.transcription && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Transcrição (PT):</Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{result.transcription}</Typography>
                              <IconButton size="small" onClick={() => {
                                navigator.clipboard.writeText(result.transcription);
                                toast.success('Transcrição copiada!');
                              }} title="Copiar Transcrição">
                                <ContentCopyIcon fontSize="inherit" />
                              </IconButton>
                            </Box>
                          )}
                          {result.translation && (
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>Tradução (ES):</Typography>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{result.translation}</Typography>
                              <IconButton size="small" onClick={() => {
                                navigator.clipboard.writeText(result.translation);
                                toast.success('Tradução copiada!');
                              }} title="Copiar Tradução">
                                <ContentCopyIcon fontSize="inherit" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Container>
  );
};

export default InstagramExtractorPage;
