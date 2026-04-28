export const LANGUAGES = [
  { code: 'pt-br', label: 'Português (Brasil)' },
  { code: 'en-us', label: 'English (US)' },
  { code: 'es-la', label: 'Español (América Latina)' },
];

/**
 * Unified mapping of input spreadsheet column names across all supported languages.
 * Any variant present here will be correctly mapped to the internal field.
 */
export const INPUT_COLUMN_MAPPING = {
  url: ['URL'],
  challengeId: [
    'Campanha', 'ID da missão', 'Challenge ID',
    'Mission ID', 'ID de la misión', 'ID de desafío'
  ],
  mediaId: [
    'Missão', 'ID da mídia', 'Media ID', 'Media ID',
    'ID del contenido'
  ],
  name: [
    'Nome', 'Name', 'Nombre'
  ],
  socialName: [
    'Nome social', 'Preferred name', 'Nombre social'
  ],
  status: ['Status', 'Estado'],
  caption: [
    'Legenda', 'Caption',
    'Descripción', 'Leyenda', 'Subtítulo'
  ],
  transcription: [
    'Transcrição', 'Transcrição ', 'Transcription',
    'Transcripción'
  ],
  brandHashtag: [
    'Hashtag da marca', 'Brand hashtag', 'Hashtag de la marca'
  ],
  campaignHashtag: [
    'Hashtag da campanha', 'Campaign hashtag', 'Hashtag de la campaña'
  ],
  missionHashtag: [
    'Mission hashtag'
  ],
  contentScore: [
    'Pontuação de conteúdo', 'Content Score', 'Puntuación de contenido'
  ],
};

export const LANGUAGE_CONFIG = {
  'pt-br': {
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
      name: 'Nome',
      socialName: 'Nome social',
      brandHashtag: 'Hashtag da marca',
      campaignHashtag: 'Hashtag da campanha',
      missionHashtag: 'Mission hashtag',
      contentScore: 'Pontuação de conteúdo',
      nota: 'Nota',
      status: 'Status',
      comentario: 'Comentário',
      detalhesAusentes: 'Detalhes Ausentes',
      scoreFinal: 'Score Final',
      feedbackConsolidado: 'Feedback Consolidado',
      transcription: 'transcription',
      aiStatus: 'ai_status',
      idConteudo: 'ID Conteúdo',
      challengeId: 'Campanha',
      mediaId: 'Missão',
      url: 'URL',
      caption: 'Legenda'
    },
    jsonKeys: {
      missingDetails: 'detalhes_ausentes'
    }
  },
  'en-us': {
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
      name: 'Name',
      socialName: 'Preferred name',
      brandHashtag: 'Brand hashtag',
      campaignHashtag: 'Campaign hashtag',
      missionHashtag: 'Mission hashtag',
      contentScore: 'Content Score',
      nota: 'Score',
      status: 'Status',
      comentario: 'Comment',
      detalhesAusentes: 'Missing Details',
      scoreFinal: 'Final Score',
      feedbackConsolidado: 'Consolidated Feedback',
      transcription: 'transcription',
      aiStatus: 'ai_status',
      idConteudo: 'Content ID',
      challengeId: 'Campaign',
      mediaId: 'Mission',
      url: 'URL',
      caption: 'Caption'
    },
    jsonKeys: {
      missingDetails: 'detalhes_ausentes'
    }
  },
  'es-la': {
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
      name: 'Nombre',
      socialName: 'Nombre social',
      brandHashtag: 'Hashtag de la marca',
      campaignHashtag: 'Hashtag de la campaña',
      missionHashtag: 'Mission hashtag',
      contentScore: 'Puntuación de contenido',
      nota: 'Nota',
      status: 'Estado',
      comentario: 'Comentario',
      detalhesAusentes: 'Detalles Ausentes',
      scoreFinal: 'Puntuación Final',
      feedbackConsolidado: 'Retroalimentación Consolidada',
      transcription: 'transcription',
      aiStatus: 'ai_status',
      idConteudo: 'ID de Contenido',
      challengeId: 'Campaña',
      mediaId: 'Misión',
      url: 'URL',
      caption: 'Leyenda'
    },
    jsonKeys: {
      missingDetails: 'detalles_ausentes'
    }
  }
};

/**
 * Identifies the column name in a row object based on a logical field name,
 * using the unified INPUT_COLUMN_MAPPING.
 */
export const getColumnName = (row, field) => {
  const possibleNames = INPUT_COLUMN_MAPPING[field] || [];
  const keys = Object.keys(row);
  for (const name of possibleNames) {
    const foundKey = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
    if (foundKey) return foundKey;
  }
  return null;
};

export const getCellValue = (row, field) => {
  const colName = getColumnName(row, field);
  return colName ? row[colName] : undefined;
};
