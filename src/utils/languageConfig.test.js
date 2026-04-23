import { describe, it, expect } from 'vitest';
import { getColumnName, getCellValue } from './languageConfig';

describe('languageConfig - Comprehensive Column Detection', () => {
  const rowPt = {
    'ID da missão': 'PT123',
    'Nome social': 'João Silva',
    'URL': 'http://pt.com',
    'Legenda': 'Texto PT'
  };

  const rowEn = {
    'Mission ID': 'EN123',
    'Preferred name': 'John Doe',
    'URL': 'http://en.com',
    'Caption': 'Text EN'
  };

  const rowEs = {
    'ID del contenido': 'ES123',
    'Nombre social': 'Juan Perez',
    'URL': 'http://es.com',
    'Descripción': 'Texto ES'
  };

  it('should find PT columns', () => {
    expect(getColumnName(rowPt, 'challengeId', 'pt-br')).toBe('ID da missão');
    expect(getColumnName(rowPt, 'name', 'pt-br')).toBe('Nome social');
    expect(getCellValue(rowPt, 'caption', 'pt-br')).toBe('Texto PT');
  });

  it('should find EN columns', () => {
    expect(getColumnName(rowEn, 'challengeId', 'en-us')).toBe('Mission ID');
    expect(getColumnName(rowEn, 'name', 'en-us')).toBe('Preferred name');
    expect(getCellValue(rowEn, 'caption', 'en-us')).toBe('Text EN');
  });

  it('should find ES columns', () => {
    expect(getColumnName(rowEs, 'challengeId', 'es-la')).toBe('ID del contenido');
    expect(getColumnName(rowEs, 'name', 'es-la')).toBe('Nombre social');
    expect(getCellValue(rowEs, 'caption', 'es-la')).toBe('Texto ES');
  });

  it('should fallback correctly regardless of selected language', () => {
    // UI is in English, but spreadsheet is in Spanish
    expect(getColumnName(rowEs, 'caption', 'en-us')).toBe('Descripción');
    // UI is in Portuguese, but spreadsheet is in English
    expect(getColumnName(rowEn, 'challengeId', 'pt-br')).toBe('Mission ID');
  });
});
