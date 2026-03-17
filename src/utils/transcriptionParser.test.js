import { extractAudioTranscription } from './transcriptionParser';
import { describe, it, expect } from 'vitest';

describe('extractAudioTranscription', () => {
  it('should extract transcription correctly with all sections present', () => {
    const text = `
      [TRANSCRIÇÃO DE ÁUDIO]: O iFood me ajudou a descobrir... inclusive enquanto eu tava aqui gravando pra vocês, eu não resisti, entrei no app, já fiz a minha compra, porque iFood é brasileiro, bom e barato. A minha oferta de hoje já tá garantida. Corre pro app e aproveita a partir de R$ 1. iFood!
      [TEXTO IDENTIFICADO NAS IMAGENS]: Nenhum texto identificado nas mídias fornecidas.
      [DESCRIÇÃO VISUAL]: Nenhuma imagem foi anexada na solicitação.
    `;
    const result = extractAudioTranscription(text);
    expect(result).toBe('O iFood me ajudou a descobrir... inclusive enquanto eu tava aqui gravando pra vocês, eu não resisti, entrei no app, já fiz a minha compra, porque iFood é brasileiro, bom e barato. A minha oferta de hoje já tá garantida. Corre pro app e aproveita a partir de R$ 1. iFood!');
  });

  it('should handle numbered sections', () => {
    const text = `
      1. [TRANSCRIÇÃO DE ÁUDIO]: Nenhum áudio identificado.
      2. [TEXTO IDENTIFICADO NAS IMAGENS]: Nenhum texto identificado.
      3. [DESCRIÇÃO VISUAL]: A imagem exibe uma mulher...
    `;
    const result = extractAudioTranscription(text);
    expect(result).toBe('Nenhum áudio identificado.');
  });

  it('should handle missing end sections', () => {
    const text = `
      [TRANSCRIÇÃO DE ÁUDIO]: Only audio here.
    `;
    const result = extractAudioTranscription(text);
    expect(result).toBe('Only audio here.');
  });

  it('should handle empty or invalid text', () => {
    expect(extractAudioTranscription(null)).toBe('');
    expect(extractAudioTranscription('')).toBe('');
    expect(extractAudioTranscription('No tag here')).toBe('');
  });

  it('should handle case insensitivity', () => {
    const text = `
      [transcrição de áudio]: Some text.
      [DESCRIÇÃO VISUAL]: something else.
    `;
    const result = extractAudioTranscription(text);
    expect(result).toBe('Some text.');
  });
});
