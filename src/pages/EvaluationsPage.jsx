
import React, { useState, useRef, useEffect } from 'react';
import {
  Container, TextField, Button, Typography, Box, Paper, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider,
  FormControl, InputLabel, Select, MenuItem, Grid, LinearProgress, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import getFriendlyErrorMessage from '../utils/friendlyErrors';
import { exportEvaluationsToExcel } from '../utils/exportUtils';
import { useUserAuth } from '../context/UserAuthContext';
import { useLayout } from '../context/LayoutContext';
import geminiAPI from '../utils/geminiAPI';
import { saveTranscription, updateTranscription, deleteTranscription } from '../utils/transcriptionState';
import { extractAudioTranscription } from '../utils/transcriptionParser';
import { LANGUAGES, LANGUAGE_CONFIG, getColumnName, getCellValue } from '../utils/languageConfig';

const EvaluationsPage = () => {
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
  const [videoDuration, setVideoDuration] = useState(0);
  const [existingTranscriptionRaw, setExistingTranscriptionRaw] = useState('');
  const [status, setStatus] = useState('Aguardando...');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [userEvaluation, setUserEvaluation] = useState(null);
  const [error, setError] = useState(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkData, setBulkData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('pt-br');

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
        setVideoDuration(data.videoDuration || 0);
        setExistingTranscriptionRaw('');
        setEvaluationResult(data.evaluationResult || null);
        setUserEvaluation(data.userEvaluation || null);
      }
    } else {
      setTranscriptionName('');
      setVideoUrl('');
      setSelectedBriefingId('');
      setCaptionText('');
      setTranscription('');
      setVideoDuration(0);
      setExistingTranscriptionRaw('');
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

  const handleBack = () => {
    navigate('/');
  };

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setTranscription('');
    setError(null);
    setStatus('Iniciando...');

    try {
      if (!existingTranscriptionRaw) {
        throw new Error('Por favor, forneça o texto contendo a "[TRANSCRIÇÃO DE ÁUDIO]:"');
      }

      const extracted = extractAudioTranscription(existingTranscriptionRaw);
      if (extracted) {
        setTranscription(extracted);
        setStatus('Transcrição extraída do texto fornecido.');
      } else {
        throw new Error('Nenhuma "[TRANSCRIÇÃO DE ÁUDIO]:" encontrada no texto fornecido.');
      }
    } catch (e) {
      setError(e.message);
      setStatus('Ocorreu um erro.');
      toast.error(e.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData = XLSX.utils.sheet_to_json(ws);

      // Add original row number (Excel rows start at 1, headers are row 1, first data row is 2)
      const dataWithIndex = jsonData.map((row, index) => ({
        ...row,
        __rowNum__: index + 2
      }));

      // Filter out "Duplicado" status
      const filteredData = dataWithIndex.filter(row => {
        const statusCol = getColumnName(row, 'status');
        return row[statusCol] !== 'Duplicado';
      });
      console.log("[Bulk Upload] Dados brutos (exemplo da primeira linha):", filteredData[0]);
      console.log("[Bulk Upload] Colunas detectadas na planilha:", Object.keys(filteredData[0] || {}));

      setOriginalData(jsonData);
      setBulkData(filteredData);
      setBulkProgress({ current: 0, total: filteredData.length });
      toast.info(`${filteredData.length} registros carregados (excluindo duplicados).`);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkProcess = async () => {
    if (bulkData.length === 0) {
      toast.error('Nenhum dado carregado para processar.');
      return;
    }
    if (!selectedBriefingId) {
      toast.error('Por favor, selecione um briefing antes de iniciar o processamento em massa.');
      return;
    }
    if (!user?.gemini_api_key) {
      toast.error('Chave da API Gemini não configurada.');
      return;
    }

    const getWordCount = (text) => {
      if (!text) return 0;
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    setIsBulkProcessing(true);
    const results = [];
    let pendingEvaluations = [];
    geminiAPI.initialize(user.gemini_api_key);
    const startTime = Date.now();
    const CHUNK_SIZE = 5;

    const evaluateWithRetry = async (transcriptionText, caption, name) => {
      let quotaRetries = 0;
      let commRetries = 0;
      const maxQuotaRetries = 5;
      const maxCommRetries = 3;

      while (true) {
        try {
          return await geminiAPI.evaluateContent(
            transcriptionText,
            caption || '',
            campaignBriefing,
            user.gemini_model,
            selectedLanguage
          );
        } catch (err) {
          const waitMatch = err.message.match(/retry in ([\d.]+)s/);
          if (waitMatch && waitMatch[1]) {
            const waitSeconds = parseFloat(waitMatch[1]);
            if (quotaRetries < maxQuotaRetries) {
              console.log(`[Bulk] Quota excedida. Tentativa ${quotaRetries + 1}. Aguardando ${waitSeconds}s...`);
              for (let s = Math.ceil(waitSeconds); s > 0; s--) {
                setBulkStatus(`Quota excedida. Retentando em ${s}s... (${name})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              quotaRetries++;
              continue;
            }
          } else {
            // General communication or JSON error
            if (commRetries < maxCommRetries) {
              commRetries++;
              console.warn(`[Bulk] Erro de comunicação (${commRetries}/${maxCommRetries}). Retentando em 2s...`, err.message);
              setBulkStatus(`Erro de comunicação. Retentando (${commRetries}/${maxCommRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          }
          throw err;
        }
      }
    };

    const evaluateMultipleWithRetry = async (chunk) => {
      let quotaRetries = 0;
      let commRetries = 0;
      const maxQuotaRetries = 5;
      const maxCommRetries = 3;

      while (true) {
        try {
          return await geminiAPI.evaluateMultipleContent(
            chunk,
            campaignBriefing,
            user.gemini_model,
            selectedLanguage
          );
        } catch (err) {
          const waitMatch = err.message.match(/retry in ([\d.]+)s/);
          if (waitMatch && waitMatch[1]) {
            const waitSeconds = parseFloat(waitMatch[1]);
            if (quotaRetries < maxQuotaRetries) {
              console.log(`[Bulk Grouped] Quota excedida. Tentativa ${quotaRetries + 1}. Aguardando ${waitSeconds}s...`);
              for (let s = Math.ceil(waitSeconds); s > 0; s--) {
                setBulkStatus(`Quota excedida (Agrupada). Retentando em ${s}s...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
              quotaRetries++;
              continue;
            }
          } else {
            // General communication or JSON error
            if (commRetries < maxCommRetries) {
              commRetries++;
              console.warn(`[Bulk Grouped] Erro de comunicação (${commRetries}/${maxCommRetries}). Retentando em 2s...`, err.message);
              setBulkStatus(`Erro de comunicação (Agrupada). Retentando (${commRetries}/${maxCommRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          }
          throw err;
        }
      }
    };

    const sanitizeEvaluation = (evalResult) => {
      if (!evalResult || !evalResult.avaliacoes) return evalResult;

      const sanitized = { ...evalResult };
      const config = LANGUAGE_CONFIG[selectedLanguage];
      const missingDetailsKey = config.jsonKeys.missingDetails;

      sanitized.avaliacoes = sanitized.avaliacoes.map(av => {
        if (av.nota === 3 || av.status === config.statuses.OTIMO) {
          // Use bracket notation to handle both 'detalhes_ausentes' and 'detalles_ausentes'
          return { ...av, [missingDetailsKey]: '' };
        }
        return av;
      });
      return sanitized;
    };

    const processChunk = async (chunkToProcess) => {
      if (chunkToProcess.length === 0) return;

      console.log(`[Bulk Grouped] Processando lote de ${chunkToProcess.length} itens.`);
      setBulkStatus(`IA: Avaliando lote de ${chunkToProcess.length} itens...`);

      try {
        let groupedResult = await evaluateMultipleWithRetry(chunkToProcess);

        // Sanitize results
        if (groupedResult.resultados) {
          groupedResult.resultados = groupedResult.resultados.map(res => ({
            ...res,
            ...sanitizeEvaluation(res)
          }));
        }
        console.log(`[Bulk Grouped] Resultado recebido:`, groupedResult);

        // Map results back to records
        for (const item of chunkToProcess) {
          const evalResult = groupedResult.resultados?.find(r => r.id === item.id);

          if (evalResult) {
            console.log(`[Bulk Grouped] Salvando: ${item.id}`);
            setBulkStatus(`Salvando Avaliação: ${item.id}`);

            const isVideoTooLong = item.duration > 60;
            let finalEval = evalResult ? { ...evalResult } : null;

            if (isVideoTooLong && finalEval) {
              const config = LANGUAGE_CONFIG[selectedLanguage];
              if (finalEval.avaliacoes) {
                finalEval.avaliacoes = finalEval.avaliacoes.map(av => ({
                  ...av,
                  nota: 1,
                  status: config.statuses.RUIM
                }));
              }
              const prefix = config.messages.videoTooLong;
              if (finalEval.feedback_consolidado && finalEval.feedback_consolidado.texto && !finalEval.feedback_consolidado.texto.startsWith(prefix)) {
                 finalEval.feedback_consolidado.texto = prefix + finalEval.feedback_consolidado.texto;
              }
              if (finalEval.score_final && finalEval.avaliacoes) {
                finalEval.score_final.pontuacao_obtida = finalEval.avaliacoes.reduce((acc, curr) => acc + (Number(curr.nota) || 0), 0);
              }
            }

            const transcriptionData = {
              captionText: item.caption,
              transcription: item.transcription,
              videoDuration: item.duration,
              evaluationResult: finalEval,
              userEvaluation: finalEval,
            };
            await saveTranscription(item.id, (item.row['URL'] || '').trim(), selectedBriefingId, transcriptionData);

            results.push({
              row: item.row,
              transcription: item.transcription,
              evaluation: evalResult,
              ai_status: 'Sucesso'
            });
          } else {
            console.warn(`[Bulk Grouped] Resultado não encontrado para ID: ${item.id}`);
            results.push({
              row: item.row,
              transcription: item.transcription,
              ai_status: 'Erro: IA não retornou avaliação para este item no lote.'
            });
          }
        }
      } catch (err) {
        console.error(`[Bulk Grouped] Erro na avaliação agrupada:`, err);
        chunkToProcess.forEach(item => {
          results.push({
            row: item.row,
            transcription: item.transcription,
            ai_status: `Erro na avaliação agrupada: ${err.message}`
          });
        });
      }
    };

    for (let i = 0; i < bulkData.length; i++) {
      const row = bulkData[i];
      setBulkProgress({ current: i + 1, total: bulkData.length });

      const urlCol = getColumnName(row, 'url');
      const videoUrl = (row[urlCol] || '').trim();
      if (!videoUrl) {
        console.warn(`[Bulk] Pulando linha ${i + 2}: URL ausente.`);
        results.push({
          row: row,
          ai_status: 'Pulado: URL ausente'
        });
        continue;
      }

      const challengeIdCol = getColumnName(row, 'challengeId');
      const challengeId = row[challengeIdCol] || '';
      const rowNum = String(row.__rowNum__ || (i + 1)).padStart(3, '0');
      const nameColKey = getColumnName(row, 'name');
      const nameCol = row[nameColKey] || '';
      const nameParts = nameCol.trim().split(/\s+/).filter(p => p.length > 0);
      const firstWord = nameParts[0] || '';
      const lastWord = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
      const name = `${transcriptionName}${challengeId}${rowNum}${firstWord}${lastWord}`;

      setBulkStatus(`Processando: ${name} (Iniciando)`);

      try {
        const caption = getCellValue(row, 'caption');
        const existingTranscriptionRaw = getCellValue(row, 'transcription');

        let transcriptionText = '';
        let duration = 0;
        let isTranscriptionProvided = false;

        if (existingTranscriptionRaw) {
          console.log(`[Bulk] Transcrição bruta encontrada na planilha para ${name}:`, existingTranscriptionRaw.substring(0, 100) + '...');
          transcriptionText = extractAudioTranscription(existingTranscriptionRaw);
          if (transcriptionText) {
            isTranscriptionProvided = true;
            console.log(`[Bulk] Transcrição extraída com sucesso para ${name}:`, transcriptionText.substring(0, 100) + '...');
          } else {
            console.warn(`[Bulk] Tag de transcrição não encontrada no texto da planilha para ${name}.`);
          }
        } else {
          console.log(`[Bulk] Nenhuma coluna 'Transcrição' encontrada ou preenchida para ${name}.`);
        }

        if (!isTranscriptionProvided) {
          throw new Error('Transcrição não encontrada na planilha.');
        }

        const wordCount = !transcriptionText ? 0 : getWordCount(transcriptionText);
        const isVideoTooLong = duration > 60;

        // 2. Evaluate
        let evaluation = null;
        if (wordCount >= 20) {
          console.log(`[Bulk] Adicionando para avaliação agrupada: ${name}`);
          setBulkStatus(`Processando: ${name} (Agrupando para IA)`);
          pendingEvaluations.push({
            id: name,
            transcription: transcriptionText,
            duration: duration,
            caption: caption || '',
            row: row
          });

          if (pendingEvaluations.length >= CHUNK_SIZE) {
            await processChunk(pendingEvaluations);
            pendingEvaluations = [];
            // Delay after a chunk
            for (let s = 2; s > 0; s--) {
              setBulkStatus(`Aguardando ${s}s para o próximo lote de IA...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } else {
          console.log(`[Bulk] Reprovando automaticamente (transcrição curta: ${wordCount} palavras): ${name}`);
          setBulkStatus(`Reprovando: ${name} (Mídia curta)`);
          const config = LANGUAGE_CONFIG[selectedLanguage];
          const missingDetailsKey = config.jsonKeys.missingDetails;
          evaluation = {
            avaliacoes: [
              { id_criterio: 1, nome: config.criteria[1], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent },
              { id_criterio: 3, nome: config.criteria[3], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent },
              { id_criterio: 4, nome: config.criteria[4], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent },
              { id_criterio: 7, nome: config.criteria[7], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent }
            ],
            score_final: { pontuacao_obtida: 4, pontuacao_maxima: 12 },
            feedback_consolidado: { texto: config.messages.rejectedShort(wordCount) }
          };
        }

        // Apply duration warning even for auto-rejected (short) items if duration is known
        if (isVideoTooLong && evaluation) {
          const config = LANGUAGE_CONFIG[selectedLanguage];
          const prefix = config.messages.videoTooLong;
          if (evaluation.feedback_consolidado && evaluation.feedback_consolidado.texto && !evaluation.feedback_consolidado.texto.startsWith(prefix)) {
            evaluation.feedback_consolidado.texto = prefix + evaluation.feedback_consolidado.texto;
          }
        }

        // 3. Save (Immediate for individual mode or auto-rejected items)
        if (evaluation) {
          console.log(`[Bulk] Salvando: ${name}`);
          setBulkStatus(`Salvando: ${name}`);
          const transcriptionData = {
            captionText: caption || '',
            transcription: transcriptionText,
            videoDuration: duration,
            evaluationResult: evaluation,
            userEvaluation: evaluation,
          };
          await saveTranscription(name, videoUrl, selectedBriefingId, transcriptionData);

          results.push({
            row: row,
            transcription: transcriptionText,
            evaluation: evaluation,
            ai_status: 'Sucesso'
          });
        }

      } catch (err) {
        console.error(`Erro ao processar linha ${i + 1}:`, err);
        results.push({
          row: row,
          transcription: '',
          ai_status: `Erro: ${err.message}`
        });
      }

      if (i < bulkData.length - 1) {
        // Calculate estimated time remaining
        const elapsedMs = Date.now() - startTime;
        const avgTimePerRowMs = elapsedMs / (i + 1);
        const remainingRows = bulkData.length - (i + 1);
        const estimatedRemainingMs = remainingRows * avgTimePerRowMs;

        const minutes = Math.floor(estimatedRemainingMs / 60000);
        const seconds = Math.floor((estimatedRemainingMs % 60000) / 1000);
        setEstimatedTimeRemaining(minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`);

        for (let s = 1; s > 0; s--) {
          setBulkStatus(`Aguardando ${s} segundo para o próximo registro...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // --- Final Grouped Evaluation Processing (Remaining items) ---
    if (pendingEvaluations.length > 0) {
      await processChunk(pendingEvaluations);
      pendingEvaluations = [];
    }

    setIsBulkProcessing(false);
    setEstimatedTimeRemaining(null);
    setBulkStatus('Processamento concluído!');
    toast.success('Processamento em massa concluído!');
    fetchTranscriptions();

    exportEvaluationsToExcel(results, originalData, selectedLanguage);
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

    const getWordCount = (text) => {
      if (!text) return 0;
      return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    };

    setIsEvaluating(true);
    setError(null);
    setEvaluationResult(null);

    try {
      let result;
      const wordCount = getWordCount(transcription);
      const isVideoTooLong = videoDuration > 60;

      if (wordCount >= 20) {
        geminiAPI.initialize(user.gemini_api_key);

        const evaluateWithRetry = async () => {
          let quotaRetries = 0;
          let commRetries = 0;
          const maxQuotaRetries = 5;
          const maxCommRetries = 3;

          while (true) {
            try {
              return await geminiAPI.evaluateContent(
                transcription,
                captionText,
                campaignBriefing,
                user.gemini_model,
                selectedLanguage
              );
            } catch (err) {
              const waitMatch = err.message.match(/retry in ([\d.]+)s/);
              if (waitMatch && waitMatch[1]) {
                const waitSeconds = parseFloat(waitMatch[1]);
                if (quotaRetries < maxQuotaRetries) {
                  console.log(`[Evaluate] Quota excedida. Tentativa ${quotaRetries + 1}. Aguardando ${waitSeconds}s...`);
                  for (let s = Math.ceil(waitSeconds); s > 0; s--) {
                    setStatus(`Quota excedida. Retentando em ${s}s...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  quotaRetries++;
                  continue;
                }
              } else {
                // General communication or JSON error
                if (commRetries < maxCommRetries) {
                  commRetries++;
                  console.warn(`[Evaluate] Erro de comunicação (${commRetries}/${maxCommRetries}). Retentando em 2s...`, err.message);
                  setStatus(`Erro de comunicação. Retentando (${commRetries}/${maxCommRetries})...`);
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  continue;
                }
              }
              throw err;
            }
          }
        };

        result = await evaluateWithRetry();

        // Sanitize: If score is 3/ÓTIMO, detalles_ausentes must be empty
        if (result && result.avaliacoes) {
          const config = LANGUAGE_CONFIG[selectedLanguage];
          result.avaliacoes = result.avaliacoes.map(av => {
            if (av.nota === 3 || av.status === config.statuses.OTIMO) {
              return { ...av, detalhes_ausentes: '' };
            }
            return av;
          });
        }

        if (isVideoTooLong && result) {
          const config = LANGUAGE_CONFIG[selectedLanguage];
          if (result.avaliacoes) {
            result.avaliacoes = result.avaliacoes.map(av => ({
              ...av,
              nota: 1,
              status: config.statuses.RUIM
            }));
          }
          const prefix = config.messages.videoTooLong;
          if (result.feedback_consolidado && result.feedback_consolidado.texto && !result.feedback_consolidado.texto.startsWith(prefix)) {
             result.feedback_consolidado.texto = prefix + result.feedback_consolidado.texto;
          }
          if (result.score_final && result.avaliacoes) {
            result.score_final.pontuacao_obtida = result.avaliacoes.reduce((acc, curr) => acc + (Number(curr.nota) || 0), 0);
          }
          toast.warning(`Vídeo muito longo (>1:00). Avaliado e marcado como reprovado.`);
        }
      } else {
        const config = LANGUAGE_CONFIG[selectedLanguage];
        const missingDetailsKey = config.jsonKeys.missingDetails;
        result = {
          avaliacoes: [
            { id_criterio: 1, nome: config.criteria[1], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent },
            { id_criterio: 3, nome: config.criteria[3], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent },
            { id_criterio: 4, nome: config.criteria[4], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent },
            { id_criterio: 7, nome: config.criteria[7], nota: 1, status: config.statuses.RUIM, comentario: config.messages.shortTranscription, [missingDetailsKey]: config.messages.insufficientContent }
          ],
          score_final: { pontuacao_obtida: 4, pontuacao_maxima: 12 },
          feedback_consolidado: { texto: config.messages.rejectedShort(wordCount) }
        };
        toast.warning(`Transcrição muito curta (${wordCount} palavras). Reprovando automaticamente.`);
      }
      // Apply duration warning even for auto-rejected (short) items if duration is known
      if (isVideoTooLong && result) {
        const config = LANGUAGE_CONFIG[selectedLanguage];
        const prefix = config.messages.videoTooLong;
        if (result.feedback_consolidado && result.feedback_consolidado.texto && !result.feedback_consolidado.texto.startsWith(prefix)) {
          result.feedback_consolidado.texto = prefix + result.feedback_consolidado.texto;
        }
      }

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
    const config = LANGUAGE_CONFIG[selectedLanguage];
    if (status === config.statuses.OTIMO) return 'success';
    if (status === config.statuses.BOM) return 'warning';
    if (status === config.statuses.RUIM) return 'error';
    return 'default';
  };

  const handleUpdateEvaluation = (index, field, value) => {
    const updatedAvaliacoes = [...userEvaluation.avaliacoes];
    const config = LANGUAGE_CONFIG[selectedLanguage];
    const fieldName = field === 'detalhes_ausentes' ? config.jsonKeys.missingDetails : field;
    updatedAvaliacoes[index] = { ...updatedAvaliacoes[index], [fieldName]: value };

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
      toast.error('O nome da avaliação é obrigatório para salvar.');
      return;
    }

    const transcriptionData = {
      captionText,
      transcription,
      videoDuration,
      evaluationResult,
      userEvaluation,
    };

    try {
      if (selectedTranscriptionId) {
        await updateTranscription(selectedTranscriptionId, transcriptionName, videoUrl, selectedBriefingId, transcriptionData);
        toast.success('Avaliação atualizada com sucesso!');
      } else {
        const result = await saveTranscription(transcriptionName, videoUrl, selectedBriefingId, transcriptionData);
        toast.success('Avaliação salva com sucesso!');
        setSelectedTranscriptionId(result.id);
      }
      await fetchTranscriptions();
    } catch (e) {
      toast.error(`Erro ao salvar: ${e.message}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedTranscriptionId) return;
    if (window.confirm('Tem certeza que deseja excluir esta avaliação?')) {
      try {
        await deleteTranscription(selectedTranscriptionId);
        toast.success('Avaliação excluída com sucesso!');
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
            Gestão de Avaliações
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="language-select-label">Idioma</InputLabel>
              <Select
                labelId="language-select-label"
                value={selectedLanguage}
                label="Idioma"
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedTranscriptionId && (
              <Button variant="outlined" color="error" onClick={handleDelete}>
                Excluir
              </Button>
            )}
            <Button variant="contained" color="success" onClick={handleSave}>
              Salvar
            </Button>
          </Box>
        </Box>

        <TextField
          label="Nome da Avaliação"
          variant="outlined"
          fullWidth
          value={transcriptionName}
          onChange={(e) => setTranscriptionName(e.target.value)}
          sx={{ mb: 2 }}
          disabled={isBulkProcessing}
        />

        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Processamento em Massa (Carga de Planilha)
          </Typography>

          <Box sx={{ mb: 2 }}>
            <input
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
              id="bulk-file-upload"
              type="file"
              onChange={handleFileUpload}
              disabled={isBulkProcessing}
            />
            <label htmlFor="bulk-file-upload">
              <Button variant="outlined" component="span" disabled={isBulkProcessing}>
                Selecionar Planilha
              </Button>
            </label>
            {bulkData.length > 0 && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {bulkData.length} registros carregados (excluindo duplicados).
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            color="secondary"
            onClick={handleBulkProcess}
            disabled={isBulkProcessing || bulkData.length === 0 || !selectedBriefingId}
            fullWidth
          >
            {isBulkProcessing ? 'Processando...' : 'Iniciar Processamento em Massa'}
          </Button>

          {(isBulkProcessing || bulkStatus === 'Processamento concluído!') && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">{bulkStatus}</Typography>
                <Typography variant="body2">
                    {bulkProgress.current} / {bulkProgress.total}
                    {estimatedTimeRemaining && ` (Restante aprox.: ${estimatedTimeRemaining})`}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0} />
            </Box>
          )}
        </Paper>

        <Typography variant="body1" gutterBottom>
          Insira a URL do vídeo e cole a transcrição recebida.
        </Typography>
        <TextField
          label="URL do Vídeo"
          variant="outlined"
          fullWidth
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          sx={{ my: 2 }}
          disabled={isTranscribing || isBulkProcessing}
        />

        <FormControl fullWidth sx={{ mb: 2 }} disabled={isTranscribing || isBulkProcessing}>
          <InputLabel id="select-briefing-label">Selecionar Briefing</InputLabel>
          <Select
            labelId="select-briefing-label"
            value={selectedBriefingId}
            label="Selecionar Briefing"
            onChange={(e) => setSelectedBriefingId(e.target.value)}
          >
            <MenuItem value=""><em>Nenhum</em></MenuItem>
            {[...briefings].sort((a, b) => a.name.localeCompare(b.name)).map((b) => (
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
          disabled={isTranscribing || isBulkProcessing}
        />

        <TextField
          label="Transcrição da Planilha"
          placeholder="Cole aqui o texto contendo [TRANSCRIÇÃO DE ÁUDIO]:"
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          value={existingTranscriptionRaw}
          onChange={(e) => setExistingTranscriptionRaw(e.target.value)}
          sx={{ mb: 2 }}
          disabled={isTranscribing || isBulkProcessing}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={isTranscribing || !videoUrl || isBulkProcessing}
          fullWidth
          size="large"
          sx={{ mb: 2 }}
        >
          {isTranscribing ? <CircularProgress size={24} color="inherit" /> : 'Extrair Transcrição'}
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
                const config = LANGUAGE_CONFIG[selectedLanguage];
                const missingDetailsKey = config.jsonKeys.missingDetails;
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
                            <MenuItem value={LANGUAGE_CONFIG[selectedLanguage].statuses.RUIM}>{LANGUAGE_CONFIG[selectedLanguage].statuses.RUIM}</MenuItem>
                            <MenuItem value={LANGUAGE_CONFIG[selectedLanguage].statuses.BOM}>{LANGUAGE_CONFIG[selectedLanguage].statuses.BOM}</MenuItem>
                            <MenuItem value={LANGUAGE_CONFIG[selectedLanguage].statuses.OTIMO}>{LANGUAGE_CONFIG[selectedLanguage].statuses.OTIMO}</MenuItem>
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
                          value={av[missingDetailsKey] || ''}
                          onChange={(e) => handleUpdateEvaluation(index, 'detalhes_ausentes', e.target.value)}
                          variant="outlined"
                          size="small"
                          color="error"
                          focused={!!av[missingDetailsKey]}
                        />
                        {aiAv && (av[missingDetailsKey] !== aiAv[missingDetailsKey]) && (
                           <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1, borderLeft: '3px solid', borderColor: 'error.light' }}>
                             <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 'bold', display: 'block' }}>IA Original (Ausente):</Typography>
                             <Typography variant="caption" color="textSecondary">{aiAv[missingDetailsKey] || '(nada identificado)'}</Typography>
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

export default EvaluationsPage;
