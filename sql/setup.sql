
-- 0. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Reinicialização da tabela para garantir integridade e ordem das colunas
DROP TABLE IF EXISTS usuarios_sgaft CASCADE;

CREATE TABLE usuarios_sgaft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    senha TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN', 'OPERATOR')),
    primeiro_acesso BOOLEAN DEFAULT false, -- FALSE: Pendente (Troca de senha) | TRUE: Liberado (Dashboard)
    ord INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar Segurança de Nível de Linha (RLS)
ALTER TABLE usuarios_sgaft ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
CREATE POLICY "Permitir leitura para login e sistema" 
ON usuarios_sgaft FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Permitir atualização para admins e troca de senha" 
ON usuarios_sgaft FOR UPDATE 
TO anon, authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir inserção de usuários" 
ON usuarios_sgaft FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir exclusão de usuários para admins" 
ON usuarios_sgaft FOR DELETE 
TO anon, authenticated 
USING (true);

-- 4. Inserção dos usuários iniciais
INSERT INTO usuarios_sgaft (matricula, nome, senha, role, primeiro_acesso, ord)
VALUES 
('123456', 'Administrador Master', 'Admin123', 'ADMIN', true, 1),
('133613021', 'Admin Força Tática', 'Senha123', 'ADMIN', true, 2),
('814058021', 'Operador Especial 2', 'Senha123', 'OPERATOR', true, 3);

-- 5. Tabelas operacionais básicas (Mantidas conforme original)
CREATE TABLE IF NOT EXISTS individuos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    alcunha TEXT,
    documento TEXT,
    data_nascimento DATE,
    mae TEXT,
    endereco TEXT,
    faccao TEXT,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_individuos_nome ON individuos USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_individuos_documento ON individuos (documento);

CREATE TABLE IF NOT EXISTS fotos_individuos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individuo_id UUID REFERENCES individuos(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fotos_individuo_id ON fotos_individuos (individuo_id);

CREATE TABLE IF NOT EXISTS abordagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    horario TEXT NOT NULL,
    local TEXT NOT NULL,
    relatorio TEXT,
    objetos_apreendidos TEXT,
    resultado TEXT,
    individuo_nome TEXT,
    individuo_id UUID REFERENCES individuos(id) ON DELETE SET NULL,
    foto_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abordagens_data ON abordagens (data DESC);
CREATE INDEX IF NOT EXISTS idx_abordagens_individuo_id ON abordagens (individuo_id);
