import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/**
 * Converte um array de objetos em uma string CSV e inicia o download.
 * @param {Array<Object>} data - Os dados para exportar.
 * @param {Array<string>} headers - Os cabeçalhos das colunas.
 */
export const exportCsv = (data, headers) => {
  if (!data || data.length === 0) {
    alert("Não há dados para exportar.");
    return;
  }

  const config = {
    quotes: true,
    delimiter: ";",
    header: true,
    fields: headers
  };
  const csvString = Papa.unparse(data, config);

  const blob = new Blob([`\uFEFF${csvString}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dados_exportados.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Achata o objeto de avaliação para um formato compatível com planilha.
 * @param {Object} evaluation - O objeto de avaliação (evaluationResult ou userEvaluation).
 * @returns {Object} O objeto achatado.
 */
export const flattenEvaluation = (evaluation) => {
  const flat = {};
  if (evaluation && evaluation.avaliacoes) {
    evaluation.avaliacoes.forEach(av => {
      const prefix = av.nome.split('/')[0].trim();
      flat[`${prefix} - Nota`] = av.nota;
      flat[`${prefix} - Status`] = av.status;
      flat[`${prefix} - Comentário`] = av.comentario;
      flat[`${prefix} - Detalhes Ausentes`] = av.detalhes_ausentes;
    });
    flat['Score Final'] = `${evaluation.score_final?.pontuacao_obtida} / ${evaluation.score_final?.pontuacao_maxima}`;
    flat['Feedback Consolidado'] = evaluation.feedback_consolidado?.texto;
  }
  return flat;
};

/**
 * Exporta avaliações para um arquivo Excel (.xlsx) com duas abas.
 * @param {Array<Object>} evaluations - Lista de avaliações do banco de dados ou processadas.
 * @param {Array<Object>} [originalData=[]] - Dados originais da planilha (opcional).
 */
export const exportEvaluationsToExcel = (evaluations, originalData = []) => {
  const wb = XLSX.utils.book_new();

  // Mapear os dados para o formato da aba "Resultados IA"
  const results = evaluations.map(item => {
    // Se item.transcription_data existe, é um registro do banco de dados
    const data = item.transcription_data || {};
    const evalToUse = data.userEvaluation || data.evaluationResult || item.evaluation;

    // Se item.row existe, estamos vindo do processamento em massa
    const baseRow = item.row || {
      'URL': item.video_url || '',
      'Name': item.name || '',
      'Legenda': data.captionText || '',
      'Transcrição': data.transcription || item.transcription || '',
    };

    return {
      ...baseRow,
      'ID Conteúdo': baseRow['ID Conteúdo'] || '',
      'transcription': data.transcription || item.transcription || '',
      ...flattenEvaluation(evalToUse),
      'ai_status': item.ai_status || 'Sucesso',
      'oportunidadeTrends - Nota': '',
      'visibilidadeProduto - Nota': '',
      'combinaComunidade - Nota': '',
    };
  });

  // Aba 1: Dados Originais
  // Se não houver originalData, criamos uma aba com cabeçalhos padrão baseados nos resultados
  let ws1;
  if (originalData.length > 0) {
    ws1 = XLSX.utils.json_to_sheet(originalData);
  } else {
    // Cabeçalhos mínimos se não houver dados originais
    const defaultHeaders = ['Challenge ID', 'Name', 'URL', 'Legenda', 'Transcrição', 'ID Conteúdo'];
    ws1 = XLSX.utils.json_to_sheet([], { header: defaultHeaders });
  }
  XLSX.utils.book_append_sheet(wb, ws1, "Dados Originais");

  // Aba 2: Resultados IA
  const ws2 = XLSX.utils.json_to_sheet(results);
  XLSX.utils.book_append_sheet(wb, ws2, "Resultados IA");

  // Gerar e baixar arquivo
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  const s2ab = (s) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
  };

  saveAs(
    new Blob([s2ab(wbout)], { type: "application/octet-stream" }),
    `resultados_avaliacoes_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

/**
 * Gera um arquivo HTML a partir dos dados da campanha e inicia o download.
 * @param {object} campaignData - Objeto contendo os dados da campanha.
 * @param {object} campaignData.campaignContent - Conteúdo principal da campanha.
 * @param {string} campaignData.backgroundImage - URL da imagem de fundo.
 * @param {Array<object>} campaignData.followupPosts - Posts de acompanhamento.
 * @param {string} campaignData.conteudoMedio - Resumo de tamanho médio.
 * @param {string} campaignData.conteudoPequeno - Resumo de tamanho pequeno.
 * @param {string} campaignData.conteudoFormatado - Conteúdo formatado em HTML.
 */
export const exportHtml = (campaignData) => {
  const {
    campaignContent,
    backgroundImage,
    followupPosts,
  } = campaignData;

  if (!campaignContent) return;

  const { titulo, conteudo, cta, hashtags, conteudoMedio, conteudoPequeno, conteudoFormatado } = campaignContent;
  const imageHtml = backgroundImage ? `
    <h2>Imagem de Fundo</h2>
    <img src="${backgroundImage}" alt="Imagem de Fundo da Campanha" style="max-width: 100%; border-radius: 8px; margin-bottom: 2rem;" />
  ` : '';

  const followupPostsHtml = followupPosts.length > 0 ? `
    <h2>Posts de Follow-up</h2>
    ${followupPosts.map(post => `
      <div style="border: 1px solid #eee; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
        <h3>${post.titulo || `Post ${post.post_numero}`}</h3>
        <p style="font-size: 0.9em; color: #555;"><strong>Etapa AIDA:</strong> ${post.etapa_aida} | <strong>Gancho:</strong> ${post.tipo_gancho}</p>
        <div style="white-space: pre-wrap; font-family: inherit; margin-top: 1rem; margin-bottom: 1rem;">${post.conteudo.replace(/\n/g, '<br><br>')}</div>
        <p><strong>CTA:</strong> ${post.cta}</p>
        <div>
          ${(post.hashtags_sugeridas || []).map(tag => `<span style="background-color: #f5f3ff; color: #6d28d9; padding: 0.25rem 0.75rem; border-radius: 16px; font-size: 0.9rem; margin-right: 0.5rem;">#${tag}</span>`).join('')}
        </div>
      </div>
    `).join('')}
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Relatório da Campanha: ${titulo}</title>
      <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
        h1, h2 { color: #8b5cf6; }
        .container { border: 1px solid #ddd; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .hashtags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
        .hashtag { background-color: #f5f3ff; color: #6d28d9; padding: 0.25rem 0.75rem; border-radius: 16px; font-size: 0.9rem; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${titulo}</h1>
        ${imageHtml}
        <h2>Conteúdo</h2>
        <p>${conteudo.replace(/\n/g, '<br>')}</p>
        <h2>Chamada para Ação (CTA)</h2>
        <p>${cta.replace(/\n/g, '<br>')}</p>
        <h2>Hashtags</h2>
        <div class="hashtags">
          ${hashtags.map(tag => `<span class="hashtag">${tag}</span>`).join('')}
        </div>
        ${conteudoMedio ? `<h2>Conteúdo Médio</h2><p>${conteudoMedio.replace(/\n/g, '<br>')}</p>` : ''}
        ${conteudoPequeno ? `<h2>Conteúdo Pequeno</h2><p>${conteudoPequeno.replace(/\n/g, '<br>')}</p>` : ''}
        ${conteudoFormatado ? `<h2>Conteúdo Formatado</h2><div>${conteudoFormatado}</div>` : ''}
        ${followupPostsHtml}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `campanha-${titulo.toLowerCase().replace(/\s+/g, '-')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
