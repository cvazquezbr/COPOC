/**
 * Extracts the audio transcription from a structured text field.
 * The field follows the format:
 * [TRANSCRIÇÃO DE ÁUDIO]: ... [TEXTO IDENTIFICADO NAS IMAGENS]: ... [DESCRIÇÃO VISUAL]: ...
 * It also handles optional numbering (e.g., 1. [TRANSCRIÇÃO DE ÁUDIO]:)
 *
 * @param {string} text - The raw text from the "Transcrição" column.
 * @returns {string} - The extracted audio transcription text.
 */
export const extractAudioTranscription = (text) => {
  if (!text || typeof text !== 'string') return '';

  // Match the start tag: [TRANSCRIÇÃO DE ÁUDIO] (colon optional)
  // We don't include the optional number in the match to make it easier to find the index
  const startPattern = /\[TRANSCRIÇÃO DE ÁUDIO\]:?/i;
  const startMatch = text.match(startPattern);

  if (!startMatch) return '';

  // Find where the actual content starts (after the tag)
  const startIndex = startMatch.index + startMatch[0].length;
  const contentFromStart = text.substring(startIndex);

  // Match the end tag: either [TEXTO IDENTIFICADO...] or [DESCRIÇÃO VISUAL...]
  const endPattern = /\[(?:TEXTO IDENTIFICADO NAS IMAGENS|DESCRIÇÃO VISUAL)\]:?/i;
  const endMatch = contentFromStart.match(endPattern);

  let extracted = '';
  if (endMatch) {
    // Extract everything up to the start of the next tag
    extracted = contentFromStart.substring(0, endMatch.index);
  } else {
    // If no end tag found, take everything until the end
    extracted = contentFromStart;
  }

  // Clean up:
  // 1. Remove optional numbering that might be at the end of the extracted text (e.g., " ... 2. ")
  extracted = extracted.replace(/\s+\d+\.\s*$/, '');

  // 2. Trim whitespace
  return extracted.trim();
};
