
const getFriendlyErrorMessage = (error) => {
    const errorMessage = error.toString();

    const errorPatterns = {
      'Failed to fetch': 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
      'NetworkError': 'Erro de rede. Verifique sua conexão.',
      'not valid JSON': 'O servidor retornou uma resposta inválida. Pode haver um problema de configuração.',
      '404': 'Endpoint não encontrado. Verifique a configuração da API.',
      '500': 'Erro interno do servidor. Tente novamente mais tarde.',
      '401': 'Não autorizado. Verifique suas credenciais de API.',
      '403': 'Acesso negado.',
      'CORS': 'Erro de CORS. O servidor não permite requisições desta origem.',
      'pre-flight check failed': 'Falha na verificação da URL. O servidor retornou um erro.',
      'Expected audio but received HTML': 'A URL aponta para uma página web, não para um arquivo de mídia.',
      'crossOriginIsolated': 'O ambiente não está configurado para `crossOriginIsolated`. Siga as instruções de correção.'
    };

    for (const [pattern, message] of Object.entries(errorPatterns)) {
      if (errorMessage.includes(pattern)) {
        return message;
      }
    }

    // Return a snippet of the original error if no friendly message is found
    return `Erro inesperado: ${errorMessage.substring(0, 150)}...`;
  };

  export default getFriendlyErrorMessage;
