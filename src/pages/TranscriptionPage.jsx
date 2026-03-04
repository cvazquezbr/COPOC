
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
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkData, setBulkData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [processingMode, setProcessingMode] = useState('individual'); // 'individual' or 'grouped'
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

    try {
      const output = await transcribeUrl(videoUrl);
      setTranscription(output);
      setStatus('Transcrição concluída.');
    } catch (e) {
      setError(e.message);
      setStatus('Ocorreu um erro.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const transcribeUrl = async (url, nameForStatus = null) => {
    let finalUrl = url;

    // --- Direct Fetch Attempt (Bypass Proxy if possible) ---
    // We only try direct fetch for SAME-ORIGIN or specific storage domains known to allow CORS.
    // Most external domains (Instagram, CoCreators App) have restrictive CORS policies.
    // We skip the direct attempt for these to avoid redundant console errors.
    const urlObj = new URL(url);
    const isSameOrigin = urlObj.origin === window.location.origin;
    const isVercelBlob = url.includes('blob.vercel-storage.com');

    // Domains known to NOT allow CORS from copoc.vercel.app
    const isRestrictedSource =
        url.includes('cdninstagram.com') ||
        url.includes('fbcdn.net') ||
        url.includes('instagram.com') ||
        url.includes('cocreators.app') ||
        url.includes('cocreatorscollab.com.br');

    const shouldTryDirect = isSameOrigin || (isVercelBlob && !isRestrictedSource);

    if (shouldTryDirect) {
      try {
        const directResponse = await fetch(url, { method: 'HEAD', mode: 'cors' });
        if (directResponse.ok) {
          console.log(`[Transcription] Direct access successful for ${url}. Bypassing proxy.`);
          finalUrl = url;
        } else {
          throw new Error('Direct access failed, using proxy.');
        }
      } catch (e) {
        console.log(`[Transcription] Direct access failed for ${url}. Falling back to proxy.`);
        finalUrl = new URL(`/api/proxy-download?url=${encodeURIComponent(url)}`, window.location.origin).href;
      }
    } else {
      console.log(`[Transcription] Source ${urlObj.hostname} is likely CORS-restricted. Using proxy directly.`);
      finalUrl = new URL(`/api/proxy-download?url=${encodeURIComponent(url)}`, window.location.origin).href;
    }

    return new Promise((resolve, reject) => {
      const onMessage = (e) => {
        switch (e.data.status) {
          case 'complete':
            worker.current.removeEventListener('message', onMessage);
            resolve(e.data.output);
            break;
          case 'error':
            worker.current.removeEventListener('message', onMessage);
            reject(new Error(e.data.error));
            break;
          default:
            if (nameForStatus) {
              setBulkStatus(`Processando: ${nameForStatus} (${e.data.status})`);
            }
            break;
        }
      };
      worker.current.addEventListener('message', onMessage);

      worker.current.postMessage({
        audio: finalUrl,
        language: 'portuguese',
        task: 'transcribe',
      });
    });
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
      const filteredData = dataWithIndex.filter(row => row['Status'] !== 'Duplicado');
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
    const pendingEvaluations = [];
    geminiAPI.initialize(user.gemini_api_key);
    const startTime = Date.now();

    for (let i = 0; i < bulkData.length; i++) {
      const row = bulkData[i];
      setBulkProgress({ current: i + 1, total: bulkData.length });

      const challengeId = row['Challenge ID'] || '';
      const rowNum = String(row.__rowNum__ || (i + 1)).padStart(3, '0');
      const nameCol = row['Name'] || '';
      const nameParts = nameCol.trim().split(/\s+/).filter(p => p.length > 0);
      const firstWord = nameParts[0] || '';
      const lastWord = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
      const name = `${challengeId}${rowNum}${firstWord}${lastWord}`;

      setBulkStatus(`Processando: ${name} (Iniciando)`);

      try {
        const videoUrl = (row['URL'] || '').trim();
        const caption = row['Caption'];

        if (!videoUrl) throw new Error('URL não encontrada nesta linha.');

        console.log(`[Bulk] Processando linha ${i + 1}:`, { name, videoUrl, caption });
        setBulkStatus(`Processando: ${name} (Mídia: ${videoUrl})`);

        // 1. Transcribe
        const transcriptionText = await transcribeUrl(videoUrl, name);
        const wordCount = getWordCount(transcriptionText);

        // 2. Evaluate
        let evaluation = null;
        if (wordCount >= 20) {
          if (processingMode === 'individual') {
            console.log(`[Bulk] Avaliando: ${name}`);
            setBulkStatus(`Avaliando: ${name}`);

            const evaluateWithRetry = async () => {
              let retries = 0;
              const maxRetries = 5;
              while (retries < maxRetries) {
                try {
                  return await geminiAPI.evaluateContent(
                    transcriptionText,
                    caption || '',
                    campaignBriefing,
                    user.gemini_model
                  );
                } catch (err) {
                  const waitMatch = err.message.match(/retry in ([\d.]+)s/);
                  if (waitMatch && waitMatch[1]) {
                    const waitSeconds = parseFloat(waitMatch[1]);
                    console.log(`[Bulk] Quota excedida. Tentativa ${retries + 1}. Aguardando ${waitSeconds}s...`);
                    for (let s = Math.ceil(waitSeconds); s > 0; s--) {
                      setBulkStatus(`Quota excedida. Retentando em ${s}s... (${name})`);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    retries++;
                  } else {
                    throw err;
                  }
                }
              }
              throw new Error('Falha na avaliação após múltiplas tentativas devido a limite de quota.');
            };

            evaluation = await evaluateWithRetry();
          } else {
            console.log(`[Bulk] Adicionando para avaliação agrupada: ${name}`);
            setBulkStatus(`Transcrevendo: ${name} (Agrupando para IA)`);
            pendingEvaluations.push({
              id: name,
              transcription: transcriptionText,
              caption: caption || '',
              row: row
            });
          }
        } else {
          console.log(`[Bulk] Reprovando automaticamente (transcrição curta: ${wordCount} palavras): ${name}`);
          setBulkStatus(`Reprovando: ${name} (Mídia curta)`);
          evaluation = {
            avaliacoes: [
              { id_criterio: 1, nome: "Key Message / Mensagem Principal", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" },
              { id_criterio: 3, nome: "Branding (Do’s & Don’ts)", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" },
              { id_criterio: 4, nome: "Criatividade", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" },
              { id_criterio: 7, nome: "Call to Action (CTA)", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" }
            ],
            score_final: { pontuacao_obtida: 4, pontuacao_maxima: 12 },
            feedback_consolidado: { texto: `Reprovado. O áudio transcrito possui apenas ${wordCount} palavras (mínimo 20).` }
          };
        }

        // 3. Save (Immediate for individual mode or auto-rejected items)
        if (evaluation) {
          console.log(`[Bulk] Salvando: ${name}`);
          setBulkStatus(`Salvando: ${name}`);
          const transcriptionData = {
            captionText: caption || '',
            transcription: transcriptionText,
            evaluationResult: evaluation,
            userEvaluation: evaluation,
          };
          await saveTranscription(name, videoUrl, selectedBriefingId, transcriptionData);

          const flatEvaluation = {};
          if (evaluation && evaluation.avaliacoes) {
            evaluation.avaliacoes.forEach(av => {
              const prefix = av.nome.split('/')[0].trim();
              flatEvaluation[`${prefix} - Nota`] = av.nota;
              flatEvaluation[`${prefix} - Status`] = av.status;
              flatEvaluation[`${prefix} - Comentário`] = av.comentario;
              flatEvaluation[`${prefix} - Detalhes Ausentes`] = av.detalhes_ausentes;
            });
            flatEvaluation['Score Final'] = `${evaluation.score_final?.pontuacao_obtida} / ${evaluation.score_final?.pontuacao_maxima}`;
            flatEvaluation['Feedback Consolidado'] = evaluation.feedback_consolidado?.texto;
          }

          results.push({
            ...row,
            transcription: transcriptionText,
            ...flatEvaluation,
            ai_status: 'Sucesso',
            evaluation_result_json: JSON.stringify(evaluation),
          });
        }

      } catch (err) {
        console.error(`Erro ao processar linha ${i + 1}:`, err);
        results.push({
          ...row,
          transcription: '',
          ai_status: `Erro: ${err.message}`,
          evaluation_result_json: '',
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

    // --- Grouped Evaluation Processing (Chunked) ---
    if (processingMode === 'grouped' && pendingEvaluations.length > 0) {
      const CHUNK_SIZE = 5;
      const totalChunks = Math.ceil(pendingEvaluations.length / CHUNK_SIZE);
      console.log(`[Bulk] Iniciando avaliação agrupada para ${pendingEvaluations.length} itens em ${totalChunks} lotes.`);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, pendingEvaluations.length);
        const chunk = pendingEvaluations.slice(start, end);

        setBulkStatus(`IA: Avaliando lote ${chunkIndex + 1} de ${totalChunks} (${chunk.length} itens)...`);
        console.log(`[Bulk Grouped] Processando lote ${chunkIndex + 1}/${totalChunks} (itens ${start + 1} a ${end})`);

        try {
          const evaluateMultipleWithRetry = async () => {
            let retries = 0;
            const maxRetries = 5;
            while (retries < maxRetries) {
              try {
                return await geminiAPI.evaluateMultipleContent(
                  chunk,
                  campaignBriefing,
                  user.gemini_model
                );
              } catch (err) {
                const waitMatch = err.message.match(/retry in ([\d.]+)s/);
                if (waitMatch && waitMatch[1]) {
                  const waitSeconds = parseFloat(waitMatch[1]);
                  console.log(`[Bulk Grouped] Quota excedida. Tentativa ${retries + 1}. Aguardando ${waitSeconds}s...`);
                  for (let s = Math.ceil(waitSeconds); s > 0; s--) {
                    setBulkStatus(`Quota excedida (Agrupada). Retentando em ${s}s...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                  retries++;
                } else {
                  throw err;
                }
              }
            }
            throw new Error('Falha na avaliação agrupada após múltiplas tentativas.');
          };

          const groupedResult = await evaluateMultipleWithRetry();
          console.log(`[Bulk Grouped] Resultado recebido para lote ${chunkIndex + 1}:`, groupedResult);

          // Map results back to records
          for (const item of chunk) {
            const evalResult = groupedResult.resultados?.find(r => r.id === item.id);

            if (evalResult) {
              console.log(`[Bulk Grouped] Salvando: ${item.id}`);
              setBulkStatus(`Salvando Avaliação: ${item.id}`);

              const transcriptionData = {
                captionText: item.caption,
                transcription: item.transcription,
                evaluationResult: evalResult,
                userEvaluation: evalResult,
              };
              await saveTranscription(item.id, (item.row['URL'] || '').trim(), selectedBriefingId, transcriptionData);

              const flatEvaluation = {};
              if (evalResult.avaliacoes) {
                evalResult.avaliacoes.forEach(av => {
                  const prefix = av.nome.split('/')[0].trim();
                  flatEvaluation[`${prefix} - Nota`] = av.nota;
                  flatEvaluation[`${prefix} - Status`] = av.status;
                  flatEvaluation[`${prefix} - Comentário`] = av.comentario;
                  flatEvaluation[`${prefix} - Detalhes Ausentes`] = av.detalhes_ausentes;
                });
                flatEvaluation['Score Final'] = `${evalResult.score_final?.pontuacao_obtida} / ${evalResult.score_final?.pontuacao_maxima}`;
                flatEvaluation['Feedback Consolidado'] = evalResult.feedback_consolidado?.texto;
              }

              results.push({
                ...item.row,
                transcription: item.transcription,
                ...flatEvaluation,
                ai_status: 'Sucesso',
                evaluation_result_json: JSON.stringify(evalResult),
              });
            } else {
              console.warn(`[Bulk Grouped] Resultado não encontrado para ID: ${item.id}`);
              results.push({
                ...item.row,
                transcription: item.transcription,
                ai_status: 'Erro: IA não retornou avaliação para este item no lote.',
              });
            }
          }
        } catch (err) {
          console.error(`[Bulk Grouped] Erro na avaliação agrupada (Lote ${chunkIndex + 1}):`, err);
          chunk.forEach(item => {
            results.push({
              ...item.row,
              transcription: item.transcription,
              ai_status: `Erro na avaliação agrupada: ${err.message}`,
            });
          });
        }

        // Delay between chunks if not the last one
        if (chunkIndex < totalChunks - 1) {
          for (let s = 2; s > 0; s--) {
            setBulkStatus(`Aguardando ${s}s para o próximo lote de IA...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    setIsBulkProcessing(false);
    setEstimatedTimeRemaining(null);
    setBulkStatus('Processamento concluído!');
    toast.success('Processamento em massa concluído!');
    fetchTranscriptions();

    exportBulkResults(results);
  };

  const exportBulkResults = (results) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Original data
    const ws1 = XLSX.utils.json_to_sheet(originalData);
    XLSX.utils.book_append_sheet(wb, ws1, "Dados Originais");

    // Sheet 2: Results
    const ws2 = XLSX.utils.json_to_sheet(results);
    XLSX.utils.book_append_sheet(wb, ws2, "Resultados IA");

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    function s2ab(s) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    }
    saveAs(new Blob([s2ab(wbout)], { type: "application/octet-stream" }), `resultados_transcricao_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      if (wordCount >= 20) {
        geminiAPI.initialize(user.gemini_api_key);

        const evaluateWithRetry = async () => {
          let retries = 0;
          const maxRetries = 5;
          while (retries < maxRetries) {
            try {
              return await geminiAPI.evaluateContent(
                transcription,
                captionText,
                campaignBriefing,
                user.gemini_model
              );
            } catch (err) {
              const waitMatch = err.message.match(/retry in ([\d.]+)s/);
              if (waitMatch && waitMatch[1]) {
                const waitSeconds = parseFloat(waitMatch[1]);
                console.log(`[Evaluate] Quota excedida. Tentativa ${retries + 1}. Aguardando ${waitSeconds}s...`);
                for (let s = Math.ceil(waitSeconds); s > 0; s--) {
                  setStatus(`Quota excedida. Retentando em ${s}s...`);
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
                retries++;
              } else {
                throw err;
              }
            }
          }
          throw new Error('Falha na avaliação após múltiplas tentativas devido a limite de quota.');
        };

        result = await evaluateWithRetry();
      } else {
        result = {
          avaliacoes: [
            { id_criterio: 1, nome: "Key Message / Mensagem Principal", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" },
            { id_criterio: 3, nome: "Branding (Do’s & Don’ts)", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" },
            { id_criterio: 4, nome: "Criatividade", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" },
            { id_criterio: 7, nome: "Call to Action (CTA)", nota: 1, status: "RUIM", comentario: "Transcrição muito curta para avaliação.", detalhes_ausentes: "Conteúdo insuficiente" }
          ],
          score_final: { pontuacao_obtida: 4, pontuacao_maxima: 12 },
          feedback_consolidado: { texto: `Reprovado. O áudio transcrito possui apenas ${wordCount} palavras (mínimo 20).` }
        };
        toast.warning(`Transcrição muito curta (${wordCount} palavras). Reprovando automaticamente.`);
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
          disabled={isBulkProcessing}
        />

        <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Processamento em Massa (Carga de Planilha)
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Modo de Avaliação pela IA:</Typography>
            <RadioGroup
              row
              value={processingMode}
              onChange={(e) => setProcessingMode(e.target.value)}
              disabled={isBulkProcessing}
            >
              <FormControlLabel
                value="individual"
                control={<Radio size="small" />}
                label={<Typography variant="body2">Individual (Avaliar após cada transcrição)</Typography>}
              />
              <FormControlLabel
                value="grouped"
                control={<Radio size="small" />}
                label={<Typography variant="body2">Agrupado (Transcrever tudo e avaliar em um único prompt)</Typography>}
              />
            </RadioGroup>
          </Box>

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
            disabled={isBulkProcessing || bulkData.length === 0 || !selectedBriefingId || !workerReady}
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
          disabled={isTranscribing || !workerReady || isBulkProcessing}
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
          disabled={isTranscribing || isBulkProcessing}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleTranscribe}
          disabled={isTranscribing || !workerReady || !videoUrl || isBulkProcessing}
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
