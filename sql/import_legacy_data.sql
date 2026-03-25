
-- 1. ADAPTAÇÃO DA TABELA DE ABORDAGENS (Garantir colunas necessárias)
-- Adicionando individuo_id como chave estrangeira para a tabela de individuos
ALTER TABLE abordagens ADD COLUMN IF NOT EXISTS individuo_id UUID REFERENCES individuos(id) ON DELETE SET NULL;
ALTER TABLE abordagens ADD COLUMN IF NOT EXISTS resultado TEXT;
ALTER TABLE abordagens ADD COLUMN IF NOT EXISTS individuo_nome TEXT;
ALTER TABLE abordagens ADD COLUMN IF NOT EXISTS foto_path TEXT;

-- 2. IMPORTAÇÃO DOS INDIVÍDUOS (Dados extraídos do CSV)
-- Utilizamos UPSERT para não duplicar registros caso o ID já exista
INSERT INTO individuos (id, nome, alcunha, documento, data_nascimento, mae, faccao, updated_at)
VALUES 
('bb3de955-fcf7-4401-8b8a-a36e2ac409b8', 'Isaque Caires de Oliveira', NULL, NULL, '2026-01-01', NULL, NULL, '2026-02-07 12:12:11.635921+00'),
('8458ed5d-8344-4cc1-b2b7-07b0c895dfbd', 'Thauan Cardoso de Araújo', NULL, NULL, '1998-10-13', NULL, 'PCC', '2026-02-07 14:36:16.847927+00'),
('3563fdaf-dbfd-440d-be6f-a90ac35de9bc', 'Moncerat de los angeles brazoban', NULL, NULL, '2003-10-13', NULL, NULL, '2026-02-12 00:48:42.869247+00'),
('214c4db9-7003-462d-8b35-08d0493a520a', 'LAURO LAURINHO', 'MAGNATA', NULL, '1900-01-01', NULL, 'CV', '2026-02-12 18:25:39.387731+00'),
('bf4f55ae-6e2d-4277-b90e-8948bad3ef56', 'FRANCISCO INICIUS LEONCIO BARROSO', 'BOLADINHO', NULL, '2002-08-30', 'FRANCIELE LEONCIO BARROSO', 'PCC', '2026-02-12 19:45:17.507374+00'),
('d48c5de5-0e42-434a-9adb-8c01af818a37', 'WUESLEY TEIXEIRA', NULL, NULL, '1900-01-01', NULL, 'CV', '2026-02-12 18:47:22.958863+00'),
('5d7e5e4c-7d4f-4623-b441-9c5334f4410b', 'PETERSON', NULL, NULL, '1900-01-01', NULL, 'CV', '2026-02-12 18:51:14.462657+00'),
('70b04459-3334-4085-9181-f421f897d85a', 'DENILSON', NULL, NULL, '1900-01-01', NULL, 'CV', '2026-02-12 18:57:44.005841+00'),
('4bdeb8ba-94ad-4f04-aee1-5f3570f0a7f5', 'JUILQUE APARECIDO DIAS ALMEIDA', 'MANDRAQUE', NULL, '2009-02-12', 'LUZIA CRISTINA DO NASCIMENTO ALMEIDA', 'PCC', '2026-02-12 19:50:45.464496+00'),
('cc9c55e9-98b9-44d6-970f-55a1d6a81104', 'MARCELO MARCELINHO', 'MALANDRAGEM', NULL, '1900-01-01', NULL, 'CV', '2026-02-12 19:02:26.480349+00'),
('98a2a8f7-9df0-4c9c-93a1-83f03ea21fa0', 'VITOR GABRIEL', 'V.G', NULL, '1900-01-01', NULL, 'CV', '2026-02-12 19:07:06.082885+00'),
('4bd8ed56-76e2-47b5-aabd-220393be8692', 'SAMUEL ELIAS', 'SABOTAGEM', NULL, '1900-01-01', NULL, 'CV', '2026-02-12 19:10:12.866374+00'),
('d249dcbd-749d-415e-97ba-698630f221c2', 'KENEDY GABRIEL BARROSO PEREIRA', NULL, NULL, '2005-08-10', 'FRANCIELE LEONCIO BARROSO', 'PCC', '2026-02-12 19:29:10.025367+00')
ON CONFLICT (id) DO UPDATE SET 
    nome = EXCLUDED.nome,
    alcunha = EXCLUDED.alcunha,
    mae = EXCLUDED.mae,
    faccao = EXCLUDED.faccao,
    updated_at = EXCLUDED.updated_at;

-- 3. IMPORTAÇÃO DAS ABORDAGENS (Dados extraídos do CSV)
INSERT INTO abordagens (id, data, horario, local, resultado, relatorio, individuo_nome, individuo_id, foto_path, created_at)
VALUES 
('2ef4d8ef-580b-452c-b288-7c2285db5605', '2026-01-30', '19:24', 'Avenida Fontoura, 76 - Silviolândia - Coxim - MS', 'Liberado', 'Abordagem registrada via migração.', 'Isaque Caires de Oliveira', 'bb3de955-fcf7-4401-8b8a-a36e2ac409b8', '5b98470e-ea00-4a56-b4ad-fb7baab9776c/c408d0ca-d1d9-4446-8f7b-ef466b9e9575.jpeg', '2026-01-30 19:24:23.670944+00'),
('c0212925-b98b-4223-be58-3da02bbfd91d', '2026-02-07', '14:36', 'Rua taquari', 'Liberado', 'Abordagem registrada via migração.', 'Thauan Cardoso de Araújo', '8458ed5d-8344-4cc1-b2b7-07b0c895dfbd', '78b668b5-6287-4fd7-a774-ef64260fb930/c0212925-b98b-4223-be58-3da02bbfd91d/3ee60b43-40a9-455c-bc37-f640a08d791f.jpg', '2026-02-07 14:36:15.099017+00'),
('78e24e97-231e-494e-b3ed-0f96a803012a', '2026-02-11', '21:06', 'Rua Oscar Serrou Camy, 936 - Morada Altos São Pedro - Coxim - MS', 'Liberado', 'Abordagem registrada via migração.', 'Moncerat de los angeles brazoban', '3563fdaf-dbfd-440d-be6f-a90ac35de9bc', '5b98470e-ea00-4a56-b4ad-fb7baab9776c/78e24e97-231e-494e-b3ed-0f96a803012a/4319614d-6b06-4238-a1c9-98e8306a1779.jpg', '2026-02-11 21:06:57.762571+00'),
('d3ce6fc1-249d-4005-812c-0c9b124a1569', '2026-02-12', '18:25', 'SÃO LUIZ', 'Liberado', 'FUNÇÃO: FRENTE/IRMÃO BATIZADO. RESPONSÁVEL PELA LOGISTICA.', 'LAURO LAURINHO', '214c4db9-7003-462d-8b35-08d0493a520a', '78b668b5-6287-4fd7-a774-ef64260fb930/d3ce6fc1-249d-4005-812c-0c9b124a1569/9ef8e0fd-dc76-49b0-ae68-87bd24240295.jpeg', '2026-02-12 18:25:37.377831+00'),
('c3657f11-bd8e-4bc6-9b77-9dc462559bfe', '2026-02-12', '19:45', 'PEDRO GOMES', 'Outro', 'BATIZADO. DISCIPLINA REGIONAL DE PEDRO GOMES', 'FRANCISCO INICIUS LEONCIO BARROSO', 'bf4f55ae-6e2d-4277-b90e-8948bad3ef56', '78b668b5-6287-4fd7-a774-ef64260fb930/c3657f11-bd8e-4bc6-9b77-9dc462559bfe/615017c3-a73c-4be2-942b-41b1ea9e59d5.jpeg', '2026-02-12 19:45:15.432639+00'),
('11e210e6-f9fb-4bfb-bee9-3a6e89dc87f5', '2026-02-12', '19:50', 'RUA JUSCELINO KUITSCHECK - B. SÃO LUIZ', 'Outro', 'BATIZADO NA FACÇÃO', 'JUILQUE APARECIDO DIAS ALMEIDA', '4bdeb8ba-94ad-4f04-aee1-5f3570f0a7f5', '78b668b5-6287-4fd7-a774-ef64260fb930/11e210e6-f9fb-4bfb-bee9-3a6e89dc87f5/28be35a2-f66e-4444-ba3c-436b56d75b5a.jpeg', '2026-02-12 19:50:43.067564+00')
ON CONFLICT (id) DO UPDATE SET 
    resultado = EXCLUDED.resultado,
    relatorio = EXCLUDED.relatorio,
    local = EXCLUDED.local,
    individuo_id = EXCLUDED.individuo_id,
    individuo_nome = EXCLUDED.individuo_nome;
