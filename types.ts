
export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  MASTER = 'MASTER'
}

export interface User {
  id: string;
  matricula: string;
  nome: string;
  senha: string;
  role: UserRole;
  primeiro_acesso: boolean;
  ord?: number;
  unidade?: string;
  unidades_extras?: string[];
}

export interface Shift {
  id: string;
  comandante: string;
  motorista: string;
  patrulheiro_1?: string;
  patrulheiro_2?: string;
  horario_inicio: string;
  horario_fim?: string;
  status: 'ATIVO' | 'ENCERRADO';
  encerrado_por_nome?: string;
}

export interface PhotoRecord {
  id: string;
  path: string;
  is_primary: boolean;
  individuo_id?: string;
  sort_order?: number;
  created_at?: string;
}

export interface Individual {
  id: string;
  nome: string;
  alcunha?: string;
  documento?: string;
  data_nascimento?: string;
  mae?: string;
  endereco?: string;
  faccao?: string;
  observacao?: string;
  unidade?: string;
  cidade?: string;
  created_at?: string;
  updated_at?: string;
  fotos_individuos?: PhotoRecord[];
}

export interface ConfidentialInfo {
  id: string;
  individuo_id: string;
  conteudo: string;
  operador_nome: string;
  operador_id: string;
  created_at: string;
}

export interface Relationship {
  id: string;
  individuo_id: string;
  relacionado_id: string;
  tipo: 'COMPARSA' | 'FAMILIAR';
  created_at: string;
  created_by?: string;
  relacionado_nome?: string;
  relacionado_alcunha?: string;
}

export interface Attachment {
  id: string;
  individuo_id: string;
  nome_arquivo: string;
  tipo_mime: string;
  path: string;
  legenda?: string;
  created_by?: string;
  created_at: string;
}

export interface DBApproach {
  id: string;
  data: string;
  horario: string;
  local: string;
  relatorio: string;
  objetos_apreendidos?: string;
  resultado?: string;
  individuo_nome?: string;
  individuo_id?: string;
  unidade?: string;
  criado_por?: string;
  created_at?: string;
  foto_path?: string;
  is_saw?: boolean;
}

export interface Unit {
  id: string;
  nome: string;
  created_at?: any;
  enabled_features?: string[];
}

export interface SystemVersion {
  id: string;
  version: string;
  type: 'ATUALIZAÇÃO' | 'REPARO';
  description: string;
  date: string;
  created_at?: any;
}

export enum CrimeType {
  DRUGS = 'DROGAS',
  WEAPONS = 'ARMAS',
  ROBBERY = 'ROUBOS'
}

export enum CrimeMemberRole {
  DISTRIBUIDOR = 'DISTRIBUIDOR',
  BOCA_DE_FUMO = 'BOCA_DE_FUMO',
  VAPOR = 'VAPOR',
  USUARIO = 'USUARIO'
}

export interface CrimeGroup {
  id: string;
  nome: string;
  cidade: string;
  tipo: CrimeType;
  created_at: string;
  updated_at: string;
}

export interface CrimeMember {
  id: string;
  group_id: string;
  individual_id: string;
  role: CrimeMemberRole;
  parent_id?: string; // For hierarchy
  drugs?: string[]; // MACONHA, COCAINA, HAXIXE, CRACK, ECSTASY, OUTROS
  funcao_especifica?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: any;
  metadata?: any;
}

export interface OccurrenceSS {
  id: string;
  nr_ss: string;
  tipo_ss: 'Rondas' | 'Policiamento em evento' | 'Policiamento Medidas Protetivas' | 'Atendimento de Chamada';
  gu_servico: string[];
  unidade?: string;
  cidade?: string;
  criado_por: string;
  created_at: string;
  date?: string;
  time?: string;
  facts?: string;
  personnel?: string;
  eventoComunicado?: string;
  roAddress?: string;
}

export interface OccurrenceRO {
  id: string;
  nr_ro: string;
  fato: string | string[];
  unidade?: string;
  cidade?: string;
  criado_por: string;
  created_at: string;
  gu_servico?: string[];
  roData?: string[];
  roAddress?: string;
  date?: string;
  time?: string;
  facts?: string;
  personnel?: string;
  eventoComunicado?: string;
}
