
import React, { useState, useRef, useEffect } from 'react';
import {
  Container, TextField, Button, Typography, Box, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem, Grid
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import getFriendlyErrorMessage from '../utils/friendlyErrors';
import { useUserAuth } from '../context/UserAuthContext';
import { useLayout } from '../context/LayoutContext';
import geminiAPI from '../utils/geminiAPI';
import { saveTranscription, updateTranscription, deleteTranscription } from '../utils/transcriptionState';

const TranscriptionPage = () => {
  const navigate = useNavigate();
  const { user } = useUserAuth();
  const {
    briefings,
    fetchBriefings,
    transcriptions,
    fetchTranscriptions,
    selectedTranscriptionId,
    setSelectedTranscriptionId
  } = useLayout();
  const [transcriptionName, setTranscriptionName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedBriefingId, setSelectedBriefingId] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState('Aguardando...');
  const [workerReady, setWorkerReady] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [userEvaluation, setUserEvaluation] = useState(null);
  const [error, setError] = useState(null);
  const worker = useRef(null);

  useEffect(() => {
    fetchBriefings();
    fetchTranscriptions();
  }, [fetchBriefings, fetchTranscriptions]);

  useEffect(() => {
    if (selectedTranscriptionId) {
      const selected = transcriptions.find(t => t.id === selectedTranscriptionId);
      if (selected) {
        setTranscriptionName(selected.name || '');
        setVideoUrl(selected.video_url || '');
        setSelectedBriefingId(selected.briefing_id || '');
        const data = selected.transcription_data || {};
        setCaptionText(data.captionText || '');
        setTranscription(data.transcription || '');
        setEvaluationResult(data.evaluationResult || null);
        setUserEvaluation(data.userEvaluation || null);
      }
    } else {
      setTranscriptionName('');
      setVideoUrl('');
      setSelectedBriefingId('');
      setCaptionText('');
      setTranscription('');
      setEvaluationResult(null);
      setUserEvaluation(null);
      setIsTranscribing(false);
      setIsEvaluating(false);
      setStatus('Aguardando...');
      setError(null);
    }
  }, [selectedTranscriptionId, transcriptions]);

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
        case 'ffmpeg_log':
          console.log('FFmpeg:', e.data.message);
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
      setUserEvaluation(JSON.parse(JSON.stringify(result)));
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

  const handleUpdateEvaluation = (index, field, value) => {
    const updatedAvaliacoes = [...userEvaluation.avaliacoes];
    updatedAvaliacoes[index] = { ...updatedAvaliacoes[index], [field]: value };

    let updatedScore = userEvaluation.score_final.pontuacao_obtida;
    if (field === 'nota') {
      updatedScore = updatedAvaliacoes.reduce((acc, curr) => acc + (Number(curr.nota) || 0), 0);
    }

    setUserEvaluation({
      ...userEvaluation,
      avaliacoes: updatedAvaliacoes,
      score_final: {
        ...userEvaluation.score_final,
        pontuacao_obtida: updatedScore
      }
    });
  };

  const handleUpdateFeedback = (value) => {
    setUserEvaluation({
      ...userEvaluation,
      feedback_consolidado: { ...userEvaluation.feedback_consolidado, texto: value }
    });
  };

  const handleSave = async () => {
    if (!transcriptionName) {
      toast.error('O nome da transcrição é obrigatório para salvar.');
      return;
    }

    const transcriptionData = {
      captionText,
      transcription,
      evaluationResult,
      userEvaluation,
    };

    try {
      if (selectedTranscriptionId) {
        await updateTranscription(selectedTranscriptionId, transcriptionName, videoUrl, selectedBriefingId, transcriptionData);
        toast.success('Transcrição atualizada com sucesso!');
      } else {
        const result = await saveTranscription(transcriptionName, videoUrl, selectedBriefingId, transcriptionData);
        toast.success('Transcrição salva com sucesso!');
        setSelectedTranscriptionId(result.id);
      }
      await fetchTranscriptions();
    } catch (e) {
      toast.error(`Erro ao salvar: ${e.message}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedTranscriptionId) return;
    if (window.confirm('Tem certeza que deseja excluir esta transcrição?')) {
      try {
        await deleteTranscription(selectedTranscriptionId);
        toast.success('Transcrição excluída com sucesso!');
        setSelectedTranscriptionId(null);
        await fetchTranscriptions();
      } catch (e) {
        toast.error(`Erro ao excluir: ${e.message}`);
      }
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2 }}>
          Voltar
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Gestão de Transcrições
          </Typography>
          <Box>
            {selectedTranscriptionId && (
              <Button variant="outlined" color="error" onClick={handleDelete} sx={{ mr: 1 }}>
                Excluir
              </Button>
            )}
            <Button variant="contained" color="success" onClick={handleSave}>
              Salvar
            </Button>
          </Box>
        </Box>

        <TextField
          label="Nome da Transcrição"
          variant="outlined"
          fullWidth
          value={transcriptionName}
          onChange={(e) => setTranscriptionName(e.target.value)}
          sx={{ mb: 2 }}
        />

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

        {userEvaluation && (
          <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h5">
                Resultado da Avaliação
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setUserEvaluation(JSON.parse(JSON.stringify(evaluationResult)))}
                disabled={!evaluationResult}
              >
                Resetar para IA
              </Button>
            </Box>
            <Typography variant="caption" color="textSecondary" align="left" display="block" sx={{ mb: 2 }}>
              As respostas abaixo foram geradas pela IA. Você pode editá-las conforme necessário.
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mb: 4 }}>
              {userEvaluation.avaliacoes.map((av, index) => {
                const aiAv = evaluationResult?.avaliacoes?.[index];
                return (
                  <Paper variant="outlined" key={av.id_criterio} sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flexGrow: 1 }}>
                        {av.nome}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Box>
                          <InputLabel id={`nota-label-${index}`} sx={{ fontSize: '0.75rem' }}>Nota</InputLabel>
                          <Select
                            labelId={`nota-label-${index}`}
                            value={av.nota}
                            onChange={(e) => handleUpdateEvaluation(index, 'nota', e.target.value)}
                            size="small"
                          >
                            <MenuItem value={1}>1</MenuItem>
                            <MenuItem value={2}>2</MenuItem>
                            <MenuItem value={3}>3</MenuItem>
                          </Select>
                          {aiAv && Number(av.nota) !== Number(aiAv.nota) && (
                            <Typography variant="caption" color="textSecondary" display="block" align="center">
                              IA: {aiAv.nota}
                            </Typography>
                          )}
                        </Box>

                        <Box>
                          <InputLabel id={`status-label-${index}`} sx={{ fontSize: '0.75rem' }}>Status</InputLabel>
                          <Select
                            labelId={`status-label-${index}`}
                            value={av.status}
                            onChange={(e) => handleUpdateEvaluation(index, 'status', e.target.value)}
                            size="small"
                            sx={{
                                color: getStatusColor(av.status) === 'default' ? 'inherit' : `${getStatusColor(av.status)}.main`,
                                fontWeight: 'bold'
                            }}
                          >
                            <MenuItem value="RUIM">RUIM</MenuItem>
                            <MenuItem value="BOM">BOM</MenuItem>
                            <MenuItem value="ÓTIMO">ÓTIMO</MenuItem>
                          </Select>
                          {aiAv && av.status !== aiAv.status && (
                            <Typography variant="caption" color="textSecondary" display="block" align="center">
                              IA: {aiAv.status}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Comentário / Feedback"
                          multiline
                          fullWidth
                          minRows={3}
                          value={av.comentario}
                          onChange={(e) => handleUpdateEvaluation(index, 'comentario', e.target.value)}
                          variant="outlined"
                          size="small"
                        />
                        {aiAv && av.comentario !== aiAv.comentario && (
                           <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: 'divider' }}>
                             <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', display: 'block' }}>IA Original:</Typography>
                             <Typography variant="caption" color="textSecondary">{aiAv.comentario}</Typography>
                           </Box>
                        )}
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="O que faltou / Itens Ausentes"
                          multiline
                          fullWidth
                          minRows={3}
                          value={av.detalhes_ausentes || ''}
                          onChange={(e) => handleUpdateEvaluation(index, 'detalhes_ausentes', e.target.value)}
                          variant="outlined"
                          size="small"
                          color="error"
                          focused={!!av.detalhes_ausentes}
                        />
                        {aiAv && (av.detalhes_ausentes !== aiAv.detalhes_ausentes) && (
                           <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: 'error.light' }}>
                             <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', display: 'block' }}>IA Original (Ausente):</Typography>
                             <Typography variant="caption" color="textSecondary">{aiAv.detalhes_ausentes || '(nada identificado)'}</Typography>
                           </Box>
                        )}
                      </Grid>
                    </Grid>
                  </Paper>
                );
              })}
            </Box>

            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Score Final: {userEvaluation.score_final?.pontuacao_obtida} / {userEvaluation.score_final?.pontuacao_maxima}
              </Typography>
              {evaluationResult?.score_final && userEvaluation.score_final?.pontuacao_obtida !== evaluationResult.score_final?.pontuacao_obtida && (
                  <Typography variant="caption" color="textSecondary">
                      Score original da IA: {evaluationResult.score_final.pontuacao_obtida}
                  </Typography>
              )}
            </Box>

            <Typography variant="h6" gutterBottom>
              Feedback Consolidado:
            </Typography>
            <TextField
              multiline
              fullWidth
              rows={4}
              value={userEvaluation.feedback_consolidado?.texto || ''}
              onChange={(e) => handleUpdateFeedback(e.target.value)}
              variant="outlined"
              sx={{ bgcolor: 'background.default' }}
            />
            {evaluationResult?.feedback_consolidado && userEvaluation.feedback_consolidado?.texto !== evaluationResult.feedback_consolidado?.texto && (
              <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'grey.100' }}>
                <Typography variant="caption" color="textSecondary" display="block" gutterBottom>Conteúdo Original da IA:</Typography>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                  "{evaluationResult.feedback_consolidado.texto}"
                </Typography>
              </Paper>
            )}
          </Paper>
        )}
      </Box>
    </Container>
  );
};

export default TranscriptionPage;
