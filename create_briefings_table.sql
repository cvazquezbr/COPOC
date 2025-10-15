-- =================================================================
-- SCRIPT DEFINITIVO PARA CORRIGIR A TABELA 'briefings'
-- =================================================================
-- ATENÇÃO: Este script irá apagar a tabela 'briefings' existente e todos os seus dados para recriá-la corretamente.
-- Faça um backup se os dados existentes forem importantes.

DROP TABLE IF EXISTS briefings;

-- Cria a tabela 'briefings' com a estrutura correta e robusta.
-- A coluna 'briefing_data' armazena o objeto JSON completo, evitando erros de colunas faltantes.
CREATE TABLE briefings (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    briefing_data JSONB, -- Usar JSONB é a forma mais eficiente e correta de armazenar dados JSON.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(uuid)
        ON DELETE CASCADE
);

-- Cria um índice na coluna 'user_id' para otimizar a busca de briefings por usuário.
CREATE INDEX IF NOT EXISTS idx_briefings_user_id ON briefings(user_id);

-- Mensagem de sucesso.
-- A tabela 'briefings' foi criada com sucesso e agora está alinhada com o código da aplicação.
-- =================================================================