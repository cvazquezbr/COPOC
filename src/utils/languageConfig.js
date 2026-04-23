export const LANGUAGES = [
  { code: 'pt-br', label: 'Português (Brasil)' },
  { code: 'en-us', label: 'English (US)' },
  { code: 'es-la', label: 'Español (América Latina)' },
];

export const LANGUAGE_CONFIG = {
  'pt-br': {
    columns: {
      url: ['URL'],
      challengeId: ['ID da missão', 'ID da mídia', 'Challenge ID'],
      name: ['Nome', 'Nome social', 'Name'],
      status: ['Status'],
      caption: ['Legenda', 'Caption'],
      transcription: ['Transcrição', 'Transcrição ', 'Transcription'],
    },
    criteria: {
      1: 'Key Message / Mensagem Principal',
      3: 'Branding (Do’s & Don’ts)',
      4: 'Criatividade',
      7: 'Call to Action (CTA)',
    },
    statuses: {
      RUIM: 'RUIM',
      BOM: 'BOM',
      OTIMO: 'ÓTIMO',
    },
    messages: {
      videoTooLong: '[VÍDEO REJEITADO: Duração superior a 1 minuto] ',
      shortTranscription: 'Transcrição muito curta para avaliação.',
      insufficientContent: 'Conteúdo insuficiente',
      rejectedShort: (wordCount) => `Reprovado. O áudio transcrito possui apenas ${wordCount} palavras (mínimo 20).`,
    },
    export: {
      nota: 'Nota',
      status: 'Status',
      comentario: 'Comentário',
      detalhesAusentes: 'Detalhes Ausentes',
      scoreFinal: 'Score Final',
      feedbackConsolidado: 'Feedback Consolidado',
      transcription: 'transcription',
      aiStatus: 'ai_status',
      idConteudo: 'ID Conteúdo'
    },
    jsonKeys: {
      missingDetails: 'detalhes_ausentes'
    }
  },
  'en-us': {
    columns: {
      url: ['URL'],
      challengeId: ['Mission ID', 'Media ID', 'Challenge ID'],
      name: ['Name', 'Preferred name'],
      status: ['Status'],
      caption: ['Caption', 'Legenda'],
      transcription: ['Transcription', 'Transcrição', 'Transcrição '],
    },
    criteria: {
      1: 'Key Message / Main Message',
      3: 'Branding (Do’s & Don’ts)',
      4: 'Creativity',
      7: 'Call to Action (CTA)',
    },
    statuses: {
      RUIM: 'BAD',
      BOM: 'GOOD',
      OTIMO: 'EXCELLENT',
    },
    messages: {
      videoTooLong: '[VIDEO REJECTED: Duration exceeds 1 minute] ',
      shortTranscription: 'Transcription too short for evaluation.',
      insufficientContent: 'Insufficient content',
      rejectedShort: (wordCount) => `Rejected. The transcribed audio has only ${wordCount} words (minimum 20).`,
    },
    export: {
      nota: 'Score',
      status: 'Status',
      comentario: 'Comment',
      detalhesAusentes: 'Missing Details',
      scoreFinal: 'Final Score',
      feedbackConsolidado: 'Consolidated Feedback',
      transcription: 'transcription',
      aiStatus: 'ai_status',
      idConteudo: 'Content ID'
    },
    jsonKeys: {
      missingDetails: 'detalhes_ausentes'
    }
  },
  'es-la': {
    columns: {
      url: ['URL'],
      challengeId: ['ID de la misión', 'ID del contenido', 'ID de desafío', 'Challenge ID'],
      name: ['Nombre', 'Nombre social', 'Name'],
      status: ['Estado', 'Status'],
      caption: ['Descripción', 'Leyenda', 'Subtítulo', 'Legenda', 'Caption'],
      transcription: ['Transcripción', 'Transcrição', 'Transcrição ', 'Transcription'],
    },
    criteria: {
      1: 'Key Message / Mensaje Principal',
      3: 'Branding (Do’s & Don’ts)',
      4: 'Creatividad',
      7: 'Call to Action (CTA)',
    },
    statuses: {
      RUIM: 'MALO',
      BOM: 'BUENO',
      OTIMO: 'EXCELENTE',
    },
    messages: {
      videoTooLong: '[VIDEO RECHAZADO: Duración superior a 1 minuto] ',
      shortTranscription: 'Transcripción demasiado corta para la evaluación.',
      insufficientContent: 'Contenido insuficiente',
      rejectedShort: (wordCount) => `Rechazado. El audio transcrito tiene solo ${wordCount} palabras (mínimo 20).`,
    },
    export: {
      nota: 'Nota',
      status: 'Estado',
      comentario: 'Comentario',
      detalhesAusentes: 'Detalles Ausentes',
      scoreFinal: 'Puntuación Final',
      feedbackConsolidado: 'Retroalimentación Consolidada',
      transcription: 'transcription',
      aiStatus: 'ai_status',
      idConteudo: 'ID de Contenido'
    },
    jsonKeys: {
      missingDetails: 'detalles_ausentes'
    }
  }
};

export const getColumnName = (row, field, language) => {
  const possibleNames = LANGUAGE_CONFIG[language]?.columns[field] || [];
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const foundKey = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
    if (foundKey) return foundKey;
  }
  // Fallback to searching in all languages if not found in selected language
  for (const lang of Object.keys(LANGUAGE_CONFIG)) {
    if (lang === language) continue;
    const fallbackNames = LANGUAGE_CONFIG[lang].columns[field] || [];
    for (const name of fallbackNames) {
      const foundKey = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
      if (foundKey) return foundKey;
    }
  }
  return null;
};

export const getCellValue = (row, field, language) => {
  const colName = getColumnName(row, field, language);
  return colName ? row[colName] : undefined;
};
