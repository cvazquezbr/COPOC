
import React, { useState, useRef, useEffect } from 'react';
import {
  Container, TextField, Button, Typography, Box, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import getFriendlyErrorMessage from '../utils/friendlyErrors';
import { useUserAuth } from '../context/UserAuthContext';
import { useLayout } from '../context/LayoutContext';
import geminiAPI from '../utils/geminiAPI';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const { briefings, fetchBriefings } = useLayout();
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedBriefingId, setSelectedBriefingId] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState('Aguardando...');
  const [workerReady, setWorkerReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [error, setError] = useState(null);
  const worker = useRef(null);

  useEffect(() => {
    fetchBriefings();
  }, [fetchBriefings]);

  const selectedBriefing = briefings.find(b => b.id === selectedBriefingId);
  const campaignBriefing = selectedBriefing?.briefing_data?.revisedText || '';

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

  const handleEvaluate = async () => {
    if (!transcription || !selectedBriefingId || !captionText) {
      alert('Certifique-se de que a transcrição, o briefing e a legenda estejam preenchidos.');
      return;
    }

    if (!campaignBriefing) {
      alert('O briefing selecionado não possui conteúdo revisado. Por favor, revise-o na Gestão de Briefings antes de avaliar.');
      return;
    }

    if (!user?.gemini_api_key) {
      setError('Chave da API Gemini não configurada. Por favor, configure-a nas configurações.');
      return;
    }

    setIsEvaluating(true);
    setError(null);
    setEvaluationResult(null);

    try {
      geminiAPI.initialize(user.gemini_api_key);
      const result = await geminiAPI.evaluateContent(
        transcription,
        captionText,
        campaignBriefing,
        user.gemini_model
      );
      setEvaluationResult(result);
    } catch (e) {
      console.error('Erro na avaliação:', e);
      setError(e.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ÓTIMO': return 'success';
      case 'BOM': return 'warning';
      case 'RUIM': return 'error';
      default: return 'default';
    }
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

        <FormControl fullWidth sx={{ mb: 2 }} disabled={isTranscribing}>
          <InputLabel id="select-briefing-label">Selecionar Briefing</InputLabel>
          <Select
            labelId="select-briefing-label"
            value={selectedBriefingId}
            label="Selecionar Briefing"
            onChange={(e) => setSelectedBriefingId(e.target.value)}
          >
            <MenuItem value=""><em>Nenhum</em></MenuItem>
            {briefings.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedBriefing && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'action.hover', maxHeight: '200px', overflow: 'auto' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Conteúdo do Briefing Selecionado (Revisado):
            </Typography>
            <Box sx={{ fontSize: '0.875rem' }}>
              {campaignBriefing ? (
                <div dangerouslySetInnerHTML={{ __html: campaignBriefing }} />
              ) : (
                <Typography color="error" variant="body2">
                  Aviso: Este briefing ainda não possui um conteúdo revisado pela IA.
                </Typography>
              )}
            </Box>
          </Paper>
        )}

        <TextField
          label="Texto de Legenda"
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          value={captionText}
          onChange={(e) => setCaptionText(e.target.value)}
          sx={{ mb: 2 }}
          disabled={isTranscribing}
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
          <Box sx={{ mt: 4 }}>
            <Paper elevation={3} sx={{ p: 2, mb: 3, maxHeight: '400px', overflow: 'auto' }}>
              <Typography variant="h6" component="h2">
                Transcrição:
              </Typography>
              <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                {transcription}
              </Typography>
            </Paper>

            <Button
              variant="contained"
              color="secondary"
              onClick={handleEvaluate}
              disabled={isEvaluating || !campaignBriefing || !captionText}
              fullWidth
              size="large"
              sx={{ mb: 2 }}
            >
              {isEvaluating ? <CircularProgress size={24} color="inherit" /> : 'Avaliar Material'}
            </Button>
          </Box>
        )}

        {evaluationResult && (
          <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
            <Typography variant="h5" gutterBottom align="center">
              Resultado da Avaliação
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <TableContainer component={Box} sx={{ mb: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Critério</strong></TableCell>
                    <TableCell align="center"><strong>Nota</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell><strong>Feedback / O que faltou</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {evaluationResult.avaliacoes.map((av) => (
                    <TableRow key={av.id_criterio}>
                      <TableCell>{av.nome}</TableCell>
                      <TableCell align="center">{av.nota}</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={av.status}
                          color={getStatusColor(av.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{av.comentario}</Typography>
                        {av.detalhes_ausentes && (
                          <Typography variant="caption" color="error" display="block" sx={{ mt: 1, fontWeight: 'bold' }}>
                            Ausente: {av.detalhes_ausentes}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Score Final: {evaluationResult.score_final.pontuacao_obtida} / {evaluationResult.score_final.pontuacao_maxima}
              </Typography>
            </Box>

            <Typography variant="h6" gutterBottom>
              Feedback Consolidado:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="body1" sx={{ fontStyle: 'italic' }}>
                "{evaluationResult.feedback_consolidado.texto}"
              </Typography>
            </Paper>
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default TranscriptionPage;
