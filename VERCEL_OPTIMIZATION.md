# Relatório de Uso de Recursos Vercel e Otimizações

Este documento responde quais funcionalidades demandam **Vercel Functions** e **Data Transfer (CDN to Compute)**, propondo alternativas para redução de custos e melhoria de performance.

## 1. Vercel Functions (Serverless & Edge)

### Funcionalidades que demandam Functions:
1.  **Proxy de Download (`api/proxy-download.js` - Edge):**
    *   **Uso:** Utilizado pela funcionalidade de Transcrição para baixar áudios/vídeos de fontes externas (Instagram, YouTube, etc.) que possuem restrições de CORS.
    *   **Impacto:** Alto tráfego de dados e alto número de execuções de Edge Functions.
2.  **Extração de Instagram (`api/instagram/extract.js` - Serverless):**
    *   **Uso:** Scraping de URLs do Instagram para obter o link direto do MP4.
    *   **Impacto:** Consumo de tempo de execução (Serverless Execution) e requisições de rede.
3.  **Interface Gemini (`api/gemini.js` - Serverless):**
    *   **Uso:** Proxy para a API do Google Gemini para revisão de briefings e avaliação de conteúdo.
    *   **Impacto:** Segurança (oculta a API Key), mas gera custo de execução por requisição.
4.  **Exportação de Documentos (`api/export.js` - Serverless):**
    *   **Uso:** Geração de arquivos .docx a partir de HTML.
    *   **Impacto:** Processamento de CPU e memória para manipulação de documentos.
5.  **CRUD de Banco de Dados (`api/briefings.js`, `api/transcriptions.js`, etc.):**
    *   **Uso:** Todas as operações de persistência.

### Alternativas:
*   **Tentativa de Fetch Direto (Client-side):** Antes de recorrer ao `proxy-download`, o navegador pode tentar baixar o arquivo diretamente. Se o servidor de origem permitir CORS, o tráfego não passará pela Vercel.
*   **Migração para Edge Runtime:** Mover `api/instagram/extract.js` para Edge Runtime (se as dependências permitirem) para reduzir o custo de "Cold Starts" e o valor por execução, embora o Edge tenha limites de tempo menores.
*   **Uso de Gemini SDK no Cliente:** Se a segurança da API Key puder ser garantida por outros meios (ex: tokens temporários ou App Check), as chamadas poderiam ser diretas do browser. *Atualmente, manter no servidor é mais seguro.*

---

## 2. Data Transfer between Vercel's CDN and Vercel Compute

Este item de faturamento específico ocorre quando uma **Vercel Function** (Compute) faz uma requisição para um arquivo estático (Asset) hospedado na **Vercel CDN** do próprio projeto através de uma URL absoluta (ex: `fetch('https://meu-app.vercel.app/modelo.bin')`).

### Funcionalidades que demandam este tráfego:
1.  **Carregamento de Binários do FFmpeg:** Se uma Function precisasse carregar o core do FFmpeg hospedado em `public/ffmpeg/` via HTTP para processamento no servidor (embora o projeto atualmente priorize o processamento no cliente).
2.  **Modelos de IA Locais:** Se modelos de tradução ou transcrição forem hospedados na pasta `public/` e acessados por APIs via `fetch`.
3.  **Proxy de Arquivos Internos:** O uso de `api/proxy-download.js` apontando para um asset do próprio projeto.

### Alternativas:
*   **Leitura Direta via Sistema de Arquivos (FS):** Em Serverless Functions, os arquivos estáticos podem ser lidos diretamente do disco (`fs.readFileSync`) em vez de via `fetch`. Isso elimina completamente o tráfego de rede e o custo de CDN to Compute. Para isso, os arquivos devem ser incluídos no bundle da função.
*   **Hospedagem em Storage Externo (Vercel Blob / S3 / R2):** Ao mover assets pesados para o **Vercel Blob** ou outros storages, a Function baixa o arquivo de uma fonte externa. O custo de "CDN to Compute" (específico da CDN do projeto) desaparece, sendo substituído pelo custo de largura de banda de saída do storage, que geralmente é mais barato ou tem franquias maiores.
*   **Client-side Loading (Recomendado):** O projeto já utiliza esta abordagem para o FFmpeg e Transformers.js. Ao carregar os assets diretamente no navegador do usuário, o tráfego é de **CDN para o Usuário**, que é o fluxo padrão e mais eficiente.

---

## 3. Transcrição (Foco Específico)

A transcrição hoje é **Client-side** (usa Web Worker com Transformers.js), o que já economiza muito custo de Vercel Functions (que seriam caríssimas para processar áudio).

### Otimização sugerida:
1.  **Cache de Modelos:** Garantir que os modelos do Transformers.js e o core do FFmpeg utilizem cache do navegador (IndexedDB) para evitar downloads repetidos de ~50MB-150MB.
2.  **CORS Pre-flight Bypass:** No `TranscriptionPage.jsx`, implementar uma lógica que testa o `fetch(url)` direto. Se falhar por CORS, aí sim chama o `/api/proxy-download`.

---

## Resumo de Recomendações

| Recurso | Ação Recomendada | Ganho Estimado |
| :--- | :--- | :--- |
| **Data Transfer** | Mover assets de `public/` usados por APIs para Vercel Blob ou R2. | Redução direta no item 'CDN to Compute'. |
| **Functions** | Implementar fetch direto no cliente (Bypass Proxy) com CORS liberado. | Economia em 'Edge Function Executions' e Bandwidth. |
| **Performance** | Migrar extratores simples para Edge Runtime. | Menor latência e custo por execução. |
| **Escalabilidade** | Implementar processamento em lotes com delay (já iniciado) para evitar timeouts. | Estabilidade do sistema. |
| **Redundância** | Remoção de 'Pre-flight Checks' no frontend. | Redução de 50% nas requisições de download de mídia. |
