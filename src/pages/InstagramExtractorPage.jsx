import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Link,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import TranslateIcon from '@mui/icons-material/Translate';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
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
  const [translatorReady, setTranslatorReady] = useState(false);
  const [translatorStatus, setTranslatorStatus] = useState('idle'); // idle, loading, ready, error
  const [translationEngine, setTranslationEngine] = useState('gemini');
  const [globalIsProcessing, setGlobalIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [lastBatchTime, setLastBatchTime] = useState(null);
  const worker = useRef(null);

  useEffect(() => {
    if (translationEngine === 'local' && !translatorReady && translatorStatus === 'idle') {
      worker.current?.postMessage({ type: 'INIT', loadTranslator: true });
    }
  }, [translationEngine, translatorReady, translatorStatus]);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL('../utils/worker.js', import.meta.url), {
        type: 'module'
      });
    }

    const onMessage = (e) => {
      const { status, model } = e.data;
      if (status === 'transcriber_ready') {
        setWorkerReady(true);
      } else if (status === 'translator_ready') {
        setTranslatorReady(true);
        setTranslatorStatus('ready');
      } else if (status === 'translator_loading') {
        setTranslatorStatus('loading');
      } else if (status === 'translator_error') {
        setTranslatorStatus('error');
      } else if (status === 'model_download_progress') {
        if (model === 'translation') {
          setTranslatorStatus(`loading (${Math.round(e.data.progress.progress || 0)}%)`);
        }
      }
    };

    worker.current.addEventListener('message', onMessage);
    worker.current.postMessage({ type: 'INIT', loadTranslator: translationEngine === 'local' });

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
    setLastBatchTime(null);
    const startTime = Date.now();

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
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      toast.success(`Extração concluída em ${durationSec}s!`);
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

  const processItem = async (index, currentResults, silent = false) => {
    const result = currentResults[index];
    if (!result.mp4_url || result.status !== 'success') return result;

    let updatedResult = { ...result };

    // Update processing state for this item
    const updateResultInUI = (updates) => {
      setResults(prev => {
        const newResults = [...prev];
        newResults[index] = { ...newResults[index], ...updates };
        return newResults;
      });
    };

    updateResultInUI({ isProcessing: true, processingStatus: 'Iniciando transcrição...' });

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
          updatedResult = { ...updatedResult, isProcessing: false, processingStatus: `Erro: ${e.message}`, transcriptionStatus: 'error' };
          updateResultInUI(updatedResult);
          if (!silent) toast.error(`Erro: ${e.message}`);
          return updatedResult;
      }

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
            updateResultInUI({ processingStatus: 'Baixando áudio...' });
          } else if (e.data.status === 'audio_converting') {
            updateResultInUI({ processingStatus: 'Convertendo áudio...' });
          } else if (e.data.status === 'transcribing') {
            updateResultInUI({ processingStatus: 'Transcrevendo...' });
          }
        };
        worker.current.addEventListener('message', onMessage);
        worker.current.postMessage({
          audio: proxyUrl,
          language: 'portuguese',
          task: 'transcribe',
        });
      });

      updatedResult = { ...updatedResult, transcription, transcriptionStatus: 'success', processingStatus: 'Aguardando 2s para tradução...' };
      updateResultInUI(updatedResult);

      // 2-second delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        updateResultInUI({ processingStatus: `Traduzindo para espanhol (${translationEngine === 'gemini' ? 'Gemini' : 'Local'})...` });

        let translation = '';
        if (translationEngine === 'gemini') {
          if (!user?.gemini_api_key) {
            throw new Error('Chave da API Gemini não configurada.');
          }
          geminiAPI.initialize(user.gemini_api_key);
          translation = await geminiAPI.translateText(transcription, 'Espanhol', user.gemini_model);
        } else {
          // Local translation via worker
          translation = await new Promise((resolve, reject) => {
            const onTranslateMessage = (e) => {
              if (e.data.status === 'translation_complete') {
                worker.current.removeEventListener('message', onTranslateMessage);
                resolve(e.data.output);
              } else if (e.data.status === 'error') {
                worker.current.removeEventListener('message', onTranslateMessage);
                reject(new Error(e.data.error));
              } else if (e.data.status === 'translating') {
                updateResultInUI({ processingStatus: 'Traduzindo (Local)...' });
              }
            };
            worker.current.addEventListener('message', onTranslateMessage);
            worker.current.postMessage({
              type: 'TRANSLATE',
              text: transcription,
              src_lang: 'portuguese',
              tgt_lang: 'spanish'
            });
          });
        }

        updatedResult = { ...updatedResult, translation, translationStatus: 'success', isProcessing: false, processingStatus: 'Concluído' };
        updateResultInUI(updatedResult);
        if (!silent) toast.success('Transcrição e tradução concluídas!');
        return updatedResult;
      } catch (transError) {
        console.error('Error in translation:', transError);
        updatedResult = { ...updatedResult, isProcessing: false, processingStatus: `Erro na tradução: ${transError.message}`, translationStatus: 'error' };
        updateResultInUI(updatedResult);
        if (!silent) toast.error(`Erro na tradução: ${transError.message}`);
        return updatedResult;
      }
    } catch (err) {
      console.error('Error in transcription:', err);
      updatedResult = { ...updatedResult, isProcessing: false, processingStatus: `Erro na transcrição: ${err.message}`, transcriptionStatus: 'error' };
      updateResultInUI(updatedResult);
      if (!silent) toast.error(`Erro na transcrição: ${err.message}`);
      return updatedResult;
    }
  };

  const handleTranscribeAndTranslate = async (index) => {
    setGlobalIsProcessing(true);
    try {
      await processItem(index, results);
    } finally {
      setGlobalIsProcessing(false);
    }
  };

  const handleExportExcel = (dataToExport = results) => {
    if (dataToExport.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    const formattedData = dataToExport.map(r => ({
      'Link Original': r.original_url,
      'Link MP4': r.mp4_url || '-',
      'Status Extração': r.status === 'success' ? 'Sucesso' : 'Erro',
      'Status Transcrição': r.transcriptionStatus === 'success' ? 'Concluído' : (r.transcriptionStatus === 'error' ? 'Erro' : 'Pendente'),
      'Status Tradução': r.translationStatus === 'success' ? 'Concluído' : (r.translationStatus === 'error' ? 'Erro' : 'Pendente'),
      'Texto Transcrito': r.transcription || '',
      'Texto Traduzido': r.translation || ''
    }));

    const csv = Papa.unparse(formattedData, {
      delimiter: ";",
      header: true,
    });

    const csvData = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(csvData, `instagram_extraction_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Planilha exportada com sucesso!');
  };

  const handleProcessAll = async () => {
    const indices = results
      .map((r, i) => (r.mp4_url && r.status === 'success') ? i : -1)
      .filter(i => i !== -1);

    if (indices.length === 0) {
      toast.error('Não há links válidos para processar.');
      return;
    }

    setGlobalIsProcessing(true);
    setBatchProgress({ current: 0, total: indices.length });
    setLastBatchTime(null);

    let latestResults = [...results];
    const startTime = Date.now();

    try {
      for (const index of indices) {
        const updatedResult = await processItem(index, latestResults, true);
        latestResults[index] = updatedResult;
        setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      const durationMs = Date.now() - startTime;
      const durationSec = Math.floor(durationMs / 1000);
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;
      const timeString = minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`;

      setLastBatchTime(timeString);
      toast.success(`Processamento em lote concluído em ${timeString}!`);
      // Use latestResults to avoid stale state closure
      handleExportExcel(latestResults);
    } catch (error) {
      console.error('Erro no processamento em lote:', error);
      toast.error('Erro durante o processamento em lote.');
    } finally {
      setGlobalIsProcessing(false);
      // Pequeno atraso para o usuário ver o 100% antes de mostrar o tempo total
      setTimeout(() => {
        setBatchProgress({ current: 0, total: 0 });
      }, 500);
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
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="body1" sx={{ minWidth: '200px' }}><strong>Worker de Tradução:</strong></Typography>
            {translatorReady ? (
              <Typography color="green" sx={{ fontWeight: 'bold' }}>✅ Pronto</Typography>
            ) : (
              translatorStatus === 'idle' ? (
                <Typography color="textSecondary">Não iniciado</Typography>
              ) : translatorStatus === 'error' ? (
                <Typography color="error" sx={{ fontWeight: 'bold' }}>❌ Erro</Typography>
              ) : (
                <Typography color="orange" sx={{ fontWeight: 'bold' }}>⏳ {translatorStatus === 'loading' ? 'Carregando...' : translatorStatus}</Typography>
              )
            )}
          </Box>
        </Paper>

        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Box sx={{ mb: 3 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontWeight: 'bold', mb: 1 }}>Motor de Tradução</FormLabel>
              <RadioGroup
                row
                value={translationEngine}
                onChange={(e) => setTranslationEngine(e.target.value)}
              >
                <FormControlLabel value="gemini" control={<Radio size="small" />} label="Gemini (Nuvem)" />
                <FormControlLabel value="local" control={<Radio size="small" />} label="Transformers.js (Local - Meta M2M100)" />
              </RadioGroup>
              <Typography variant="caption" color="textSecondary">
                O motor local baixa o modelo (aprox. 480MB) e processa inteiramente no seu navegador.
              </Typography>
            </FormControl>
          </Box>

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
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="secondary"
              startIcon={globalIsProcessing && batchProgress.total > 0 ? <CircularProgress size={20} color="inherit" /> : <AutoModeIcon />}
              onClick={handleProcessAll}
              disabled={globalIsProcessing || !workerReady || (translationEngine === 'local' && !translatorReady)}
            >
              {globalIsProcessing && batchProgress.total > 0 ? 'Processando Lote...' : 'Processar Todos'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportExcel}
              disabled={globalIsProcessing}
            >
              Exportar Planilha (Excel)
            </Button>
            {batchProgress.total > 0 ? (
              <Box sx={{ flexGrow: 1, minWidth: '200px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                    Processando: {batchProgress.current} de {batchProgress.total}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                    {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(batchProgress.current / batchProgress.total) * 100}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
            ) : (
              lastBatchTime && (
                <Typography variant="body2" color="textSecondary" sx={{ ml: 'auto', fontWeight: 'bold' }}>
                  Tempo do último lote: {lastBatchTime}
                </Typography>
              )
            )}
          </Box>
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
                          disabled={globalIsProcessing || !workerReady || (translationEngine === 'local' && !translatorReady)}
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
