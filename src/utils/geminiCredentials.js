// src/utils/geminiCredentials.js

export const GEMINI_API_KEY_STORAGE_KEY = 'gemini_api_key';

// As funções getGeminiApiKey e setGeminiApiKey foram removidas
// para centralizar o gerenciamento da chave de API através do UserAuthContext.
// Isso evita problemas de dessincronização com o localStorage e garante que a chave
// mais recente (do banco de dados) seja sempre utilizada.