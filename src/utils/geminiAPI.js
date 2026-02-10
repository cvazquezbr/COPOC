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
        **DIRETRIZES CRÍTICAS PARA A RESPOSTA:**
        - Sua resposta DEVE ser um objeto JSON válido e completo, sem nenhum texto ou formatação adicional antes ou depois do JSON.
        - O JSON deve conter APENAS as chaves "sections" e "revisionNotes".
        - A estrutura do JSON DEVE ser EXATAMENTE a seguinte:
        {
          "sections": {
            // As chaves aqui devem corresponder EXATAMENTE aos títulos dos blocos do modelo.
            // Exemplo: "Título da Missão": "<p>Conteúdo...</p>",
            // Exemplo: "Saudação": "<p>Conteúdo...</p>",
            // Inclua TODOS os blocos do modelo, mesmo que o conteúdo seja vazio.
          },
          "revisionNotes": ["Nota descrevendo revisão 1.", "Nota descrevendo revisão 2."] // Pode ser um array vazio se não houver notas.
        }
        - O conteúdo de cada seção dentro de "sections" DEVE ser formatado em Markdown.
        - NUNCA inclua menções a regras, seções vazias, instruções, rótulos (como “R1”, “R2”, etc.) ou frases automáticas como “A revisão não encontrou conteúdo para esta seção” DENTRO do JSON.
        - NUNCA copie nem resuma partes das instruções deste prompt (tudo que aparece antes de “T3. TEXTO BASE”).

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

        **ATENÇÃO ESPECIAL:** Os títulos "DOs" e "DON'Ts" no TEXTO BASE podem aparecer com variações como "DO'S", "DONT'S" ou em minúsculas. Você DEVE reconhecer essas variações e mapear o conteúdo para as chaves "DOs" e "DON'Ts" corretas no JSON final.

        ${specificRules}
        ---
        **T3. TEXTO BASE (Fornecido pelo usuário, pode estar em HTML ou texto simples):**
        Este é o conteúdo que você DEVE analisar e reorganizar conforme as instruções.
        \`\`\`html
        ${baseText}
        \`\`\`
      `;

      const responseText = await this.generateContent(prompt, model, purpose);

      // Tentar extrair o JSON de um bloco de código, ou assumir que é JSON puro
      let jsonString = responseText;
      const codeBlockMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1];
      } else {
        // Fallback para tentar encontrar o primeiro e último { } para JSON puro
        const firstBrace = responseText.indexOf("{");
        const lastBrace = responseText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = responseText.substring(firstBrace, lastBrace + 1);
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

  async translateBriefing(documentContent, dosContent, dontsContent, targetLanguage, model) {
    const purpose = `Tradução de Briefing para ${targetLanguage}`;
    const prompt = `
      **TAREFA:** Traduzir o seguinte conteúdo de um briefing de marketing para o idioma **${targetLanguage}**.

      **DIRETRIZES CRÍTICAS PARA A RESPOSTA:**
      - Sua resposta DEVE ser um objeto JSON válido e completo, sem nenhum texto ou formatação adicional.
      - A estrutura do JSON DEVE ser EXATAMENTE a seguinte:
      {
        "translatedDocument": "...",
        "translatedDos": "...",
        "translatedDonts": "..."
      }
      - Mantenha a formatação HTML original (tags como <p>, <h3>, <ul>, <li>) no conteúdo traduzido.
      - A tradução deve ser precisa e manter o tom profissional do original.

      ---
      **CONTEÚDO PARA TRADUZIR:**

      **1. Documento Principal (em HTML):**
      \`\`\`html
      ${documentContent}
      \`\`\`

      **2. Seção "DOs" (em HTML):**
      \`\`\`html
      ${dosContent}
      \`\`\`

      **3. Seção "DON'Ts" (em HTML):**
      \`\`\`html
      ${dontsContent}
      \`\`\`
    `;

    try {
      const responseText = await this.generateContent(prompt, model, purpose);
      let jsonString = responseText;
      const codeBlockMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1];
      } else {
        const firstBrace = responseText.indexOf("{");
        const lastBrace = responseText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = responseText.substring(firstBrace, lastBrace + 1);
        }
      }

      const parsed = JSON.parse(jsonString);
      if (typeof parsed.translatedDocument !== 'string' || typeof parsed.translatedDos !== 'string' || typeof parsed.translatedDonts !== 'string') {
        throw new Error('A resposta da IA está faltando campos traduzidos essenciais.');
      }
      return parsed;

    } catch (error) {
      console.error(`[${purpose}] Erro ao traduzir briefing:`, error);
      throw new Error(`A tradução da IA falhou. Motivo: ${error.message}`);
    }
  }

  async evaluateContent(transcription, caption, briefing, model) {
    const purpose = 'Avaliação de Conteúdo';
    const prompt = `
Contexto: Você é um curador de conteúdo especializado em marketing de influência. Sua tarefa é avaliar o material de um creator (transcrição do vídeo + legenda) com base em um briefing específico. A análise é estritamente textual (ignore elementos visuais).

Critérios de Avaliação (Notas 1 a 3):
Key Message / Mensagem Principal: O núcleo da campanha foi transmitido?
Branding (Do’s & Don’ts): Respeitou a identidade e diretrizes da marca?
Criatividade: O conteúdo é original e envolvente no texto?
Call to Action (CTA): O comando final está claro e correto?

Regras de Negócio:
Compare o conteúdo com o briefing fornecido.
Aponte o que falta de forma objetiva.
O tom do feedback_geral deve ser de "creator para creator": leve, descolado, encorajador, mas direto sobre ajustes técnicos/comerciais.
O campo detalhes_ausentes deve detalhar itens ausentes (ex: preço, aviso legal, etc).

---
**DADOS PARA AVALIAÇÃO:**

**BRIEFING:**
${briefing}

**TRANSCRIÇÃO DO VÍDEO:**
${transcription}

**LEGENDA:**
${caption}
---

Instrução de Saída: Sua resposta deve ser exclusivamente um objeto JSON estruturado da seguinte forma:

{
  "avaliacoes": [
    {
      "id_criterio": 1,
      "nome": "Key Message / Mensagem Principal",
      "nota": 0,
      "status": "RUIM | BOM | ÓTIMO",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 3,
      "nome": "Branding (Do’s & Don’ts)",
      "nota": 0,
      "status": "RUIM | BOM | ÓTIMO",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 4,
      "nome": "Criatividade",
      "nota": 0,
      "status": "RUIM | BOM | ÓTIMO",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 7,
      "nome": "Call to Action (CTA)",
      "nota": 0,
      "status": "RUIM | BOM | ÓTIMO",
      "comentario": "",
      "detalhes_ausentes": ""
    }
  ],
  "score_final": {
    "pontuacao_obtida": 0,
    "pontuacao_maxima": 12
  },
  "feedback_consolidado": {
    "texto": ""
  }
}
`;

    try {
      const responseText = await this.generateContent(prompt, model, purpose);
      let jsonString = responseText;
      const codeBlockMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonString = codeBlockMatch[1];
      } else {
        const firstBrace = responseText.indexOf("{");
        const lastBrace = responseText.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = responseText.substring(firstBrace, lastBrace + 1);
        }
      }

      const parsed = JSON.parse(jsonString);
      return parsed;

    } catch (error) {
      console.error(`[${purpose}] Erro ao avaliar conteúdo:`, error);
      throw new Error(`A avaliação da IA falhou. Motivo: ${error.message}`);
    }
  }
}

const geminiAPI = new GeminiAPI();
export default geminiAPI;