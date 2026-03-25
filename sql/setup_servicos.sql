
-- Tabela para controle de turnos/serviços das viaturas
CREATE TABLE IF NOT EXISTS servicos_vtr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comandante TEXT NOT NULL,
    motorista TEXT NOT NULL,
    patrulheiro_1 TEXT,
    patrulheiro_2 TEXT,
    horario_inicio TIMESTAMPTZ DEFAULT now(),
    horario_fim TIMESTAMPTZ,
    criado_por UUID REFERENCES usuarios_sgaft(id),
    encerrado_por_nome TEXT,
    status TEXT DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'ENCERRADO'))
);

-- Índice para busca rápida de serviço ativo
CREATE INDEX IF NOT EXISTS idx_servicos_vtr_status_inicio ON servicos_vtr (status, horario_inicio DESC);

-- Habilitar RLS
ALTER TABLE servicos_vtr ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura de serviços para todos" 
ON servicos_vtr FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir inserção de serviços para autenticados" 
ON servicos_vtr FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Permitir atualização de serviços para autenticados" 
ON servicos_vtr FOR UPDATE TO anon, authenticated USING (true);
