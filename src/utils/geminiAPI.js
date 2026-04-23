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

  async evaluateMultipleContent(items, briefing, model, language = 'pt-br') {
    const purpose = 'Avaliação de Conteúdo Agrupada';
    const itemsJson = items.map(item => ({
      id: item.id,
      transcricao: item.transcription,
      legenda: item.caption
    }));

    let prompt = '';

    if (language === 'en-us') {
      prompt = `
Context: You are a content curator specialized in influencer marketing.
Your task is to evaluate MULTIPLE materials from creators (video transcription + caption) based on a specific briefing.
The analysis is strictly textual (ignore visual elements).

INTERPRETATION GUIDELINE:
- **DO NOT search for literal repetition of phrases**. The analysis must be intelligent and contextual.
- Evaluate **Semantic Adherence**: The creator can and should use their own words, slang, and personal style, as long as the core concept, brand vibe, and product/service benefits described in the briefing are preserved and understandable to the audience.
- Prioritize naturalness. If the main message was adapted to the creator's vocabulary without losing the original meaning, the score should be maximum. Do not penalize the creator for not following the script word for word.

Evaluation Criteria (Scores 1 to 3):
1. Key Message / Main Message: Was the core of the campaign conveyed? (Score 3: Concept and essence conveyed naturally, even with different words. Score 2: Concept present but mechanical/forced. Score 1: Missing the central point or total deviation from the objective).
3. Branding (Do’s & Don’ts): Respected identity and guidelines? (Evaluate if the brand is well represented. Watch out for prohibited terms, but allow creative variations on permitted terms).
4. Creativity: Is the content original and engaging?
7. Call to Action (CTA): Was the final goal achieved? (Evaluate if the command invites action effectively for the audience, even if it doesn't use the exact "verb" or phrase suggested in the briefing).

Business Rules:
- Compare each item with the intent and objectives of the provided briefing.
- The 'detalhes_ausentes' (missing details) field should only be filled if an INDISPENSABLE factual information (e.g., price, specific discount coupon, event date, mandatory link in bio) was forgotten. **NEVER use this field to point out vocabulary variations or phrases that were not said literally.**
- CRITICAL: If a criterion's score is 3 (EXCELLENT), the 'detalhes_ausentes' field for that criterion MUST be ABSOLUTELY EMPTY (""). It is a serious logical failure to give a maximum score and point out deficiencies.
- The tone of the consolidated feedback should be "creator to creator": light, cool, and encouraging.
- The entire output (criteria names, statuses, comments, and consolidated feedback) MUST be in English.

EXCLUSION GUIDELINE (CRITICAL):
- COMPLETELY ignore any mention of hashtags (#) present in the briefing.
- The use or absence of hashtags in the transcription or caption should NOT affect the scores of any criteria.
- Do not point out missing hashtags in the 'detalhes_ausentes' field.

---
**BRIEFING:**
${briefing}

---
**MATERIALS TO EVALUATE (JSON):**
\`\`\`json
${JSON.stringify(itemsJson, null, 2)}
\`\`\`
---

Output Instruction: Your response must be exclusively a JSON object structured as follows (array of evaluations):

{
  "resultados": [
    {
      "id": "ID_OF_MATERIAL_HERE",
      "avaliacoes": [
        { "id_criterio": 1, "nome": "Key Message / Main Message", "nota": 0, "status": "BAD | GOOD | EXCELLENT", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 3, "nome": "Branding (Do’s & Don’ts)", "nota": 0, "status": "BAD | GOOD | EXCELLENT", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 4, "nome": "Creativity", "nota": 0, "status": "BAD | GOOD | EXCELLENT", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 7, "nome": "Call to Action (CTA)", "nota": 0, "status": "BAD | GOOD | EXCELLENT", "comentario": "", "detalhes_ausentes": "" }
      ],
      "score_final": { "pontuacao_obtida": 0, "pontuacao_maxima": 12 },
      "feedback_consolidado": { "texto": "" }
    }
  ]
}
`;
    } else if (language === 'es-la') {
      prompt = `
Contexto: Eres un curador de contenido especializado en marketing de influencia.
Tu tarea es evaluar VARIOS materiales de creadores (transcripción de video + subtítulo/leyenda) basados en un briefing específico.
El análisis es estrictamente textual (ignora elementos visuales).

DIRECTRIZ DE INTERPRETACIÓN:
- **NO busques repeticiones literales de frases**. El análisis debe ser inteligente y contextual.
- Evalúa la **Adherencia Semántica**: El creador puede y debe usar sus propias palabras, jerga y estilo personal, siempre que el concepto central, la "vibra" de la marca y los beneficios del producto/servicio descritos en el briefing se preserven y sean comprensibles para la audiencia.
- Prioriza la naturalidad. Si el mensaje principal se adaptó al vocabulario del creador sin perder el sentido original, la puntuación debe ser máxima. No penalices al creador por no seguir el guion palabra por palabra.

Criterios de Evaluación (Notas 1 a 3):
1. Key Message / Mensaje Principal: ¿Se transmitió el núcleo de la campaña? (Nota 3: Concepto y esencia transmitidos con naturalidad, incluso con palabras diferentes. Nota 2: Concepto presente pero mecánico/forzado. Nota 1: Faltó el punto central o desviación total del objetivo).
3. Branding (Do’s & Don’ts): ¿Respetó la identidad y las directrices? (Evalúa si la marca está bien representada. Ten cuidado con los términos prohibidos, pero permite variaciones creativas en los términos permitidos).
4. Creatividad: ¿El contenido es original y atractivo?
7. Call to Action (CTA): ¿Se logró el objetivo final? (Evalúa si el comando invita a la acción de manera efectiva para la audiencia, incluso si no usa el "verbo" o la frase exacta sugerida en el briefing).

Reglas de Negocio:
- Compara cada ítem con la intención y los objetivos del briefing proporcionado.
- El campo 'detalhes_ausentes' (detalles ausentes) solo debe completarse si se olvidó una información fáctica INDISPENSABLE (ej: precio, cupón de descuento específico, fecha de evento, enlace obligatorio en la biografía). **NUNCA uses este campo para señalar variaciones de vocabulario o frases que no se dijeron literalmente.**
- CRÍTICO: Si la nota de un criterio es 3 (EXCELENTE), el campo 'detalhes_ausentes' de ese criterio DEBE estar ABSOLUTAMENTE VACÍO (""). Es un fallo lógico grave dar la nota máxima y señalar deficiencias.
- El tono del feedback consolidado debe ser de "creador a creador": ligero, fresco y alentador.
- Toda la salida (nombres de criterios, estados, comentarios y feedback consolidado) DEBE estar en español.

DIRECTRIZ DE EXCLUSIÓN (CRÍTICO):
- Ignora COMPLETAMENTE cualquier mención de hashtags (#) presente en el briefing.
- El uso o la ausencia de hashtags en la transcripción o el subtítulo NO debe afectar las notas de ningún criterio.
- No señales hashtags ausentes en el campo 'detalhes_ausentes'.

---
**BRIEFING:**
${briefing}

---
**MATERIALES A EVALUAR (JSON):**
\`\`\`json
${JSON.stringify(itemsJson, null, 2)}
\`\`\`
---

Instrucción de Salida: Tu respuesta debe ser exclusivamente un objeto JSON estructurado de la siguiente manera (array de evaluaciones):

{
  "resultados": [
    {
      "id": "ID_DEL_MATERIAL_AQUI",
      "avaliacoes": [
        { "id_criterio": 1, "nome": "Key Message / Mensaje Principal", "nota": 0, "status": "MALO | BUENO | EXCELENTE", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 3, "nome": "Branding (Do’s & Don’ts)", "nota": 0, "status": "MALO | BUENO | EXCELENTE", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 4, "nome": "Creatividad", "nota": 0, "status": "MALO | BUENO | EXCELENTE", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 7, "nome": "Call to Action (CTA)", "nota": 0, "status": "MALO | BUENO | EXCELENTE", "comentario": "", "detalhes_ausentes": "" }
      ],
      "score_final": { "pontuacao_obtida": 0, "pontuacao_maxima": 12 },
      "feedback_consolidado": { "texto": "" }
    }
  ]
}
`;
    } else {
      // Default pt-br
      prompt = `
Contexto: Você é um curador de conteúdo especializado em marketing de influência.
Sua tarefa é avaliar VÁRIOS materiais de creators (transcrição do vídeo + legenda) com base em um briefing específico.
A análise é estritamente textual (ignore elementos visuais).

DIRETRIZ DE INTERPRETAÇÃO:
- **NÃO busque por repetição literal de frases**. A análise deve ser inteligente e contextual.
- Avalie a **Aderência Semântica**: O creator pode e deve usar suas próprias palavras, gírias e estilo pessoal, desde que o conceito central, a "vibe" da marca e os benefícios do produto/serviço descritos no briefing sejam preservados e compreensíveis para a audiência.
- Priorize a naturalidade. Se a mensagem principal foi adaptada para o vocabulário do creator sem perder o sentido original, a nota deve ser máxima. Não penalize o creator por não seguir o roteiro palavra por palavra.

Critérios de Avaliação (Notas 1 a 3):
1. Key Message / Mensagem Principal: O núcleo da campanha foi transmitido? (Nota 3: Conceito e essência transmitidos com naturalidade, mesmo que com palavras diferentes. Nota 2: Conceito presente, mas mecânico/forçado. Nota 1: Faltou o ponto central ou desvio total do objetivo).
2. Branding (Do’s & Don’ts): Respeitou a identidade e diretrizes? (Avalie se a marca é bem representada. Cuidado com termos proibidos, mas permita variações criativas nos termos permitidos).
3. Criatividade: O conteúdo é original e envolvente?
4. Call to Action (CTA): O objetivo final foi alcançado? (Avalie se o comando convida à ação de forma eficaz para o público, mesmo que não use o "verbo" ou a frase exata sugerida no briefing).

Regras de Negócio:
- Compare cada item com a intenção e os objetivos do briefing fornecido.
- O campo 'detalhes_ausentes' só deve ser preenchido se uma informação fatual INDISPENSÁVEL (ex: preço, cupom de desconto específico, data de evento, link obrigatório na biografia) foi esquecida. **NUNCA use este campo para apontar variações de vocabulário ou frases que não foram ditas literalmente.**
- CRÍTICO: Se a nota de um critério for 3 (ÓTIMO), o campo 'detalhes_ausentes' desse critério DEVE estar ABSOLUTAMENTE VAZIO (""). É uma falha lógica grave dar nota máxima e apontar faltas.
- O tom do feedback consolidado deve ser de "creator para creator": leve, descolado e encorajador.
- Toda a saída (nomes de critérios, status, comentários e feedback consolidado) DEVE estar em português.

DIRETRIZ DE EXCLUSÃO (CRÍTICO):
- Ignore COMPLETAMENTE qualquer menção a hashtags (#) presente no briefing.
- O uso ou a ausência de hashtags na transcrição ou legenda NÃO deve afetar as notas de nenhum critério.
- Não aponte hashtags ausentes no campo 'detalhes_ausentes'.

---
**BRIEFING:**
${briefing}

---
**MATERIAIS PARA AVALIAR (JSON):**
\`\`\`json
${JSON.stringify(itemsJson, null, 2)}
\`\`\`
---

Instrução de Saída: Sua resposta deve ser exclusivamente um objeto JSON estruturado da seguinte forma (array de avaliações):

{
  "resultados": [
    {
      "id": "ID_DO_MATERIAL_AQUI",
      "avaliacoes": [
        { "id_criterio": 1, "nome": "Key Message / Mensagem Principal", "nota": 0, "status": "RUIM | BOM | ÓTIMO", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 3, "nome": "Branding (Do’s & Don’ts)", "nota": 0, "status": "RUIM | BOM | ÓTIMO", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 4, "nome": "Criatividade", "nota": 0, "status": "RUIM | BOM | ÓTIMO", "comentario": "", "detalhes_ausentes": "" },
        { "id_criterio": 7, "nome": "Call to Action (CTA)", "nota": 0, "status": "RUIM | BOM | ÓTIMO", "comentario": "", "detalhes_ausentes": "" }
      ],
      "score_final": { "pontuacao_obtida": 0, "pontuacao_maxima": 12 },
      "feedback_consolidado": { "texto": "" }
    }
  ]
}
`;
    }

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
      console.error(`[${purpose}] Erro ao avaliar conteúdo agrupado:`, error);
      throw new Error(`A avaliação agrupada da IA falhou. Motivo: ${error.message}`);
    }
  }

  async evaluateContent(transcription, caption, briefing, model, language = 'pt-br') {
    const purpose = 'Avaliação de Conteúdo';
    let prompt = '';

    if (language === 'en-us') {
      prompt = `
Context: You are a content curator specialized in influencer marketing.
Your task is to evaluate whether a creator managed to convey the essence of a briefing in their content (transcription + caption).

INTERPRETATION GUIDELINE:
- **DO NOT search for literal repetition of phrases**. The analysis must be intelligent and contextual.
- Evaluate **Semantic Adherence**: The creator can and should use their own words, slang, and personal style, as long as the core concept, brand vibe, and product/service benefits described in the briefing are preserved and understandable to the audience.
- Prioritize naturalness. If the main message was adapted to the creator's vocabulary without losing the original meaning, the score should be maximum. Do not penalize the creator for not following the script word for word.

Evaluation Criteria (Scores 1 to 3):
1. Key Message / Main Message: Was the core of the campaign conveyed? (Score 3: Concept and essence conveyed naturally, even with different words. Score 2: Concept present but mechanical/forced. Score 1: Missing the central point or total deviation from the objective).
2. Branding (Do’s & Don’ts): Respected identity and guidelines? (Evaluate if the brand is well represented. Watch out for prohibited terms, but allow creative variations on permitted terms).
3. Creativity: Is the content original and engaging?
4. Call to Action (CTA): Was the final goal achieved? (Evaluate if the command invites action effectively for the audience, even if it doesn't use the exact "verb" or phrase suggested in the briefing).

Business Rules:
- Compare the **intent** of the content with the objectives of the briefing.
- The 'detalhes_ausentes' (missing details) field should only be filled if an INDISPENSABLE factual information (e.g., price, specific discount coupon, event date, mandatory link in bio) was forgotten. **NEVER use this field to point out vocabulary variations or phrases that were not said literally.**
- CRITICAL: If a criterion's score is 3 (EXCELLENT), the 'detalhes_ausentes' field for that criterion MUST be ABSOLUTELY EMPTY (""). It is a serious logical failure to give a maximum score and point out deficiencies.
- The tone of the consolidated feedback should be "creator to creator": light, cool, and encouraging.
- The entire output (criteria names, statuses, comments, and consolidated feedback) MUST be in English.

EXCLUSION GUIDELINE (CRITICAL):
- COMPLETELY ignore any mention of hashtags (#) present in the briefing.
- The use or absence of hashtags in the transcription or caption should NOT affect the scores of any criteria.
- Do not point out missing hashtags in the 'detalhes_ausentes' field.
---
**DATA FOR EVALUATION:**

**BRIEFING:**
${briefing}

**VIDEO TRANSCRIPTION:**
${transcription}

**CAPTION:**
${caption}
---

Output Instruction: Your response must be exclusively a JSON object structured as follows:

{
  "avaliacoes": [
    {
      "id_criterio": 1,
      "nome": "Key Message / Main Message",
      "nota": 0,
      "status": "BAD | GOOD | EXCELLENT",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 3,
      "nome": "Branding (Do’s & Don’ts)",
      "nota": 0,
      "status": "BAD | GOOD | EXCELLENT",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 4,
      "nome": "Creativity",
      "nota": 0,
      "status": "BAD | GOOD | EXCELLENT",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 7, "nome": "Call to Action (CTA)", "nota": 0, "status": "BAD | GOOD | EXCELLENT", "comentario": "", "detalhes_ausentes": "" }
  ],
  "score_final": { "pontuacao_obtida": 0, "pontuacao_maxima": 12 },
  "feedback_consolidado": { "texto": "" }
}
`;
    } else if (language === 'es-la') {
      prompt = `
Contexto: Eres un curador de contenido especializado en marketing de influencia.
Tu tarea es evaluar si un creador logró transmitir la esencia de un briefing en su contenido (transcripción + subtítulo/leyenda).

DIRECTRIZ DE INTERPRETAÇÃO:
- **NO busques repeticiones literales de frases**. El análisis debe ser inteligente y contextual.
- Evalúa la **Adherencia Semántica**: El creador puede y debe usar sus propias palabras, jerga y estilo personal, siempre que el concepto central, la "vibra" de la marca y los beneficios del producto/servicio descritos en el briefing se preserven y sean comprensibles para la audiencia.
- Prioriza la naturalidad. Si el mensaje principal se adaptó al vocabulario del creador sin perder el sentido original, la puntuación debe ser máxima. No penalices al creador por no seguir el guion palabra por palabra.

Criterios de Evaluación (Notas 1 a 3):
1. Key Message / Mensaje Principal: ¿Se transmitió el núcleo de la campaña? (Nota 3: Concepto y esencia transmitidos con naturalidad, incluso con palabras diferentes. Nota 2: Concepto presente pero mecánico/forzado. Nota 1: Faltó el punto central o desviación total del objetivo).
2. Branding (Do’s & Don’ts): ¿Respetó la identidad y las directrices? (Evalúa si la marca está bien representada. Ten cuidado con los términos prohibidos, pero permite variaciones creativas en los términos permitidos).
3. Creatividad: ¿El contenido es original y atractivo?
4. Call to Action (CTA): ¿Se logró el objetivo final? (Evalúa si el comando invita a la acción de manera efectiva para la audiencia, incluso si no usa el "verbo" o la frase exacta sugerida en el briefing).

Reglas de Negocio:
- Compara la **intención** del contenido con los objetivos del briefing.
- El campo 'detalhes_ausentes' (detalles ausentes) solo debe completarse si se olvidó una información fáctica INDISPENSABLE (ej: precio, cupón de descuento específico, fecha de evento, enlace obligatorio en la biografía). **NUNCA uses este campo para señalar variaciones de vocabulario o frases que no se dijeron literalmente.**
- CRÍTICO: Si la nota de un criterio es 3 (EXCELENTE), el campo 'detalhes_ausentes' de ese criterio DEVE estar ABSOLUTAMENTE VACÍO (""). Es un fallo lógico grave dar la nota máxima y señalar deficiencias.
- El tono del feedback consolidado debe ser de "creador a creador": ligero, fresco y alentador.
- Toda la salida (nombres de criterios, estados, comentarios y feedback consolidado) DEBE estar en español.

DIRECTRIZ DE EXCLUSIÓN (CRÍTICO):
- Ignora COMPLETAMENTE cualquier mención de hashtags (#) presente en el briefing.
- El uso o la ausencia de hashtags en la transcripción o el subtítulo NO debe afectar las notas de ningún criterio.
- No señales hashtags ausentes en el campo 'detalhes_ausentes'.
---
**DATOS PARA EVALUACIÓN:**

**BRIEFING:**
${briefing}

**TRANSCRIPCIÓN DE VIDEO:**
${transcription}

**SUBTÍTULO / LEYENDA:**
${caption}
---

Instrucción de Saída: Tu respuesta debe ser exclusivamente un objeto JSON estructurado de la siguiente manera:

{
  "avaliacoes": [
    {
      "id_criterio": 1,
      "nome": "Key Message / Mensaje Principal",
      "nota": 0,
      "status": "MALO | BUENO | EXCELENTE",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 3,
      "nome": "Branding (Do’s & Don’ts)",
      "nota": 0,
      "status": "MALO | BUENO | EXCELENTE",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 4,
      "nome": "Creatividad",
      "nota": 0,
      "status": "MALO | BUENO | EXCELENTE",
      "comentario": "",
      "detalhes_ausentes": ""
    },
    {
      "id_criterio": 7, "nome": "Call to Action (CTA)", "nota": 0, "status": "MALO | BUENO | EXCELENTE", "comentario": "", "detalhes_ausentes": "" }
  ],
  "score_final": { "pontuacao_obtida": 0, "pontuacao_maxima": 12 },
  "feedback_consolidado": { "texto": "" }
}
`;
    } else {
      // Default pt-br
      prompt = `
Contexto: Você é um curador de conteúdo especializado em marketing de influência. 
Sua tarefa é avaliar se um creator conseguiu transmitir a essência de um briefing em seu conteúdo (transcrição + legenda).

DIRETRIZ DE INTERPRETAÇÃO:
- **NÃO busque por repetição literal de frases**. A análise deve ser inteligente e contextual.
- Avalie a **Aderência Semântica**: O creator pode e deve usar suas próprias palavras, gírias e estilo pessoal, desde que o conceito central, a "vibe" da marca e os benefícios do produto/serviço descritos no briefing sejam preservados e compreensíveis para a audiência.
- Priorize a naturalidade. Se a mensagem principal foi adaptada para o vocabulário do creator sem perder o sentido original, a nota deve ser máxima. Não penalize o creator por não seguir o roteiro palavra por palavra.

Critérios de Avaliação (Notas 1 a 3):
1. Key Message / Mensagem Principal: O núcleo da campanha foi transmitido? (Nota 3: Conceito e essência transmitidos com naturalidade, mesmo que com palavras diferentes. Nota 2: Conceito presente, mas mecânico/forçado. Nota 1: Faltou o ponto central ou desvio total do objetivo).
2. Branding (Do’s & Don’ts): Respeitou a identidade e diretrizes? (Avalie se a marca é bem representada. Cuidado com termos proibidos, mas permita variações criativas nos termos permitidos).
3. Criatividade: O conteúdo é original e envolvente?
4. Call to Action (CTA): O objetivo final foi alcançado? (Avalie se o comando convida à ação de forma eficaz para o público, mesmo que não use o "verbo" ou a frase exata sugerida no briefing).

Regras de Negócio:
- Compare a **intenção** do conteúdo com os objetivos do briefing.
- O campo 'detalhes_ausentes' só deve ser preenchido se uma informação fatual INDISPENSÁVEL (ex: preço, cupom de desconto específico, data de evento, link obrigatório na biografia) foi esquecida. **NUNCA use este campo para apontar variações de vocabulário ou frases que não foram ditas literalmente.**
- CRÍTICO: Se a nota de um critério for 3 (ÓTIMO), o campo 'detalhes_ausentes' desse critério DEVE estar ABSOLUTAMENTE VAZIO (""). É uma falha lógica grave dar nota máxima e apontar faltas.
- O tom do feedback consolidado deve ser de "creator para creator": leve, descolado e encorajador.
- Toda a saída (nomes de critérios, status, comentários e feedback consolidado) DEVE estar em português.

DIRETRIZ DE EXCLUSÃO (CRÍTICO):
- Ignore COMPLETAMENTE qualquer menção a hashtags (#) presente no briefing.
- O uso ou a ausência de hashtags na transcrição ou legenda NÃO deve afetar as notas de nenhum critério.
- Não aponte hashtags ausentes no campo 'detalhes_ausentes'.
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
      "id_criterio": 7, "nome": "Call to Action (CTA)", "nota": 0, "status": "RUIM | BOM | ÓTIMO", "comentario": "", "detalhes_ausentes": "" }
  ],
  "score_final": { "pontuacao_obtida": 0, "pontuacao_maxima": 12 },
  "feedback_consolidado": { "texto": "" }
}
`;
    }

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

  async translateText(text, targetLanguage, model) {
    const purpose = `Tradução para ${targetLanguage}`;
    const prompt = `Traduza o seguinte texto para ${targetLanguage}.
    Mantenha o tom original.
    Responda apenas com o texto traduzido, sem explicações.

    TEXTO:
    ${text}`;

    try {
      const translatedText = await this.generateContent(prompt, model, purpose);
      return translatedText;
    } catch (error) {
      console.error(`[${purpose}] Erro ao traduzir texto:`, error);
      throw new Error(`A tradução da IA falhou. Motivo: ${error.message}`);
    }
  }
}

const geminiAPI = new GeminiAPI();
export default geminiAPI;
