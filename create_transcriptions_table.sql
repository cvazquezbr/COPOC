-- =================================================================
-- SCRIPT PARA CRIAR A TABELA 'transcriptions'
-- =================================================================

CREATE TABLE IF NOT EXISTS transcriptions (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    briefing_id INTEGER, -- Opcional: link com um briefing
    video_url TEXT,
    name VARCHAR(255) NOT NULL,
    transcription_data JSONB, -- Armazena videoUrl, captionText, transcription, evaluationResult, userEvaluation, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(uuid)
        ON DELETE CASCADE,
    CONSTRAINT fk_briefing
        FOREIGN KEY(briefing_id)
        REFERENCES briefings(id)
        ON DELETE SET NULL
);

-- Cria um índice na coluna 'user_id' para otimizar a busca de transcrições por usuário.
CREATE INDEX IF NOT EXISTS idx_transcriptions_user_id ON transcriptions(user_id);

-- =================================================================
