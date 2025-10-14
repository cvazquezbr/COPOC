class GeminiAPI {
  constructor() {
    this.isInitialized = false;
    this.apiKey = null;
  }

  initialize(apiKey) {
    if (!apiKey) {
      console.error("GeminiAPI: A chave da API não foi fornecida para inicialização.");
      this.isInitialized = false;
      return;
    }
    this.apiKey = apiKey;
    this.isInitialized = true;
  }

  async listModels() {
    if (!this.isInitialized) {
      throw new Error('GeminiAPI não foi inicializada. Chame initialize() primeiro.');
    }
    console.log('Fetching available Gemini models via proxy...');
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'listModels', apiKey: this.apiKey }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Erro ${response.status}`);
      }

      const supportedModels = data.models.filter(model =>
        model.supportedGenerationMethods.includes('generateContent')
      );
      console.log('Supported models fetched:', supportedModels);
      return supportedModels;
    } catch (error) {
      console.error('Erro ao buscar a lista de modelos Gemini:', error);
      throw new Error(`Falha na comunicação com o proxy da API Gemini: ${error.message}`);
    }
  }

  async generateContent(promptString, model, purpose = 'Chamada Genérica') {
    if (!this.isInitialized) {
      throw new Error('GeminiAPI não foi inicializada. Chame initialize() primeiro.');
    }
    if (!promptString) {
      throw new Error('O prompt não pode ser vazio.');
    }

    model = model || 'gemini-pro';

    console.log(`[${purpose}] Iniciando chamada à API Gemini via proxy com o modelo ${model}.`);
    console.log(`[${purpose}] Prompt:`, promptString);

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateContent',
          apiKey: this.apiKey,
          prompt: promptString,
          model: model,
        }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        console.error('Erro do proxy da API Gemini:', responseData);
        throw new Error(responseData.error || `Erro ${response.status}`);
      }

      console.log(`[${purpose}] Resposta da API Gemini (bruta):`, responseData);

      if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
        const resultText = responseData.candidates[0].content.parts[0].text.trim();
        console.log(`[${purpose}] Resposta extraída:`, resultText);
        return resultText;
      } else {
        console.error('Formato de resposta inesperado da API Gemini:', responseData);
        throw new Error('Formato de resposta inesperado da API Gemini.');
      }
    } catch (error) {
      console.error('Erro ao chamar o proxy da API Gemini:', error);
      if (error instanceof Error && error.message.startsWith('Erro do proxy da API Gemini:')) {
        throw error;
      }
      throw new Error(`Falha na comunicação com o proxy da API Gemini: ${error.message}`);
    }
  }

  async generateImage(promptString, imageModel, purpose = 'Geração de Imagem') {
    if (!this.isInitialized) {
      throw new Error('GeminiAPI não foi inicializada. Chame initialize() primeiro.');
    }
    // Placeholder for image generation logic
    console.log(`[${purpose}] Gerando imagem com o modelo ${imageModel} e prompt: ${promptString}`);
    // In a real implementation, you would call the image generation API here.
    // For now, we'll return a placeholder image URL.
    return Promise.resolve('https://via.placeholder.com/1024x1024.png?text=Imagem+Gerada');
  }

  async reviseBriefing(baseText, template, model) {
    const purpose = 'Revisão de Briefing';
    console.log(`[${purpose}] Iniciando revisão de briefing com modelo estruturado.`);
    try {
      const referenceMarkdown = template.blocks.map(b => b.content).join('\n\n');
      const specificRules = template.blocks
        .map(b => `### Regra para "${b.title}":\n${b.rules}`)
        .join('\n\n');

      const prompt = `

        **DIRETIZES:**

        - **NUNCA** copie nem resuma partes das instruções deste prompt (tudo que aparece antes de “T3. TEXTO BASE”).
        - **NÃO** insira menções a regras, seções vazias, instruções, rótulos (como “R1”, “R2”, etc.) ou frases automáticas como “A revisão não encontrou conteúdo para esta seção”.
        - Sua resposta **DEVE** ser um objeto JSON válido, sem nenhum texto ou formatação adicional fora dele.
        - A estrutura do JSON deve ser **EXATAMENTE** a seguinte:
        {
          "sections": {
            // As chaves aqui devem corresponder aos títulos dos blocos do modelo
            "Título da Missão": "<p>Conteúdo...</p>",
            "Saudação": "<p>Conteúdo...</p>",
            // etc...
          },
          "revisionNotes": ["Nota descrevendo revisão 1.", "Nota descrevendo revisão 2.", "Nota descrevendo revisão 3."]
        }

        **SUA TAREFA:**
        ${template.generalRules}
        ---
        **T1. MODELO DE REFERÊNCIA (Define a estrutura e os blocos obrigatórios):**

        O conteúdo deste modelo define as seções que você DEVE criar. Use os títulos das seções (linhas que começam com '##') como as chaves para o objeto "sections" no seu JSON de saída.
        \`\`\`markdown
        ${referenceMarkdown}
        \`\`\`
        ---
        **T2. REGRAS ESPECÍFICAS (Instruções detalhadas por bloco):**
        Use estas regras para guiar o preenchimento de cada bloco.
        ${specificRules}
        ---
        **T3. TEXTO BASE (Fornecido pelo usuário, pode estar em HTML ou texto simples):**
        Este é o conteúdo que você DEVE analisar e reorganizar conforme as instruções.
        \`\`\`html
        ${baseText}
        \`\`\`
      `;

      const responseText = await this.generateContent(prompt, model, purpose);

      const match = responseText.match(/```json\n([\s\S]*?)\n```|```([\s\S]*?)```/);
      let jsonString = responseText;
      if (match) {
        jsonString = match[1] || match[2];
      } else {
        const plainJsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (plainJsonMatch) {
          jsonString = plainJsonMatch[0];
        }
      }

      try {
        const parsed = JSON.parse(jsonString);
        console.log(`[${purpose}] JSON extraído e parseado com sucesso.`);
        return parsed;
      } catch (e) {
        console.error(`[${purpose}] Falha ao parsear JSON da resposta da IA:`, e);
        console.error(`[${purpose}] String JSON que falhou:`, jsonString);
        throw new Error("A resposta da IA não continha um JSON válido.");
      }
    } catch (error) {
        console.error(`[${purpose}] Erro geral durante a revisão:`, error);
        throw new Error(`A revisão da IA falhou. Motivo: ${error.message}`);
    }
  }

  async generateBlockSuggestion(title, context, model) {
    const purpose = `Sugestão para Bloco: ${title}`;
    const prompt = `Você é um especialista em marketing e comunicação. Sua tarefa é gerar o conteúdo para uma seção específica de um briefing de campanha.

    **Seção a ser Gerada:** "${title}"

    **Contexto Adicional (outras seções do briefing):**
    ${context}

    **Instruções:**
    - Gere um conteúdo conciso e impactante para a seção "${title}".
    - O conteúdo deve ser relevante ao contexto fornecido.
    - O formato da resposta deve ser apenas o texto da seção, sem títulos ou formatações adicionais.`;

    return this.generateContent(prompt, model, purpose);
  }
}

const geminiAPI = new GeminiAPI();
export default geminiAPI;