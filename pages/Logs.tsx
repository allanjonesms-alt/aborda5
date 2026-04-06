
import React, { useState, useEffect, useCallback } from 'react';
import { Siren } from 'lucide-react';
import { User, UserRole, LogEntry } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, getDocs, limit, where } from 'firebase/firestore';

interface LogsProps {
  user: User | null;
}

const Logs: React.FC<LogsProps> = ({ user }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
      
      const filters = [];
      if (actionFilter) {
        filters.push(where('action', '==', actionFilter));
      }
      
      // Note: Firestore doesn't support complex date range filtering easily without composite indexes.
      // For now, we will filter in-memory if dateFilter is set, or add a simple range query if possible.
      // Given the current structure, let's stick to in-memory filtering for simplicity and reliability.
      
      q = query(collection(db, 'logs'), ...filters, orderBy('timestamp', 'desc'), limit(100));

      const querySnapshot = await getDocs(q);
      let data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry));
      
      if (dateFilter) {
        data = data.filter(log => {
          const logDate = log.timestamp?.toDate?.()?.toISOString().split('T')[0];
          return logDate === dateFilter;
        });
      }

      setLogs(data);
    } catch (err: any) {
      console.error('Erro ao buscar logs:', err);
      let message = 'Erro ao carregar auditoria.';
      
      if (err.message?.toLowerCase().includes('index') || err.code === 'failed-precondition') {
        const indexLink = err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
        if (indexLink) {
          message = (
            <div className="flex flex-col items-center gap-2">
              <span>Índice de busca necessário ausente.</span>
              <a 
                href={indexLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-navy-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-navy-500 transition-all"
              >
                Criar Índice no Firebase
              </a>
            </div>
          ) as any;
        } else {
          message = 'O sistema está preparando os índices de busca ou um índice necessário está ausente. Por favor, aguarde alguns minutos ou contate o administrador.';
        }
        console.error('Firestore Index Error in Logs. Full message:', err.message);
      }
      
      setError(message);
      // We don't throw here to avoid crashing the component, we show the error in UI
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) {
      fetchLogs();
    }
  }, [user, fetchLogs]);

  if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.MASTER) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-6xl"></i></div>
        <h2 className="text-3xl font-black text-navy-950 mb-4">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">Apenas Administradores podem acessar os logs do sistema.</p>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'SHIFT_STARTED': return 'fa-play text-forest-600';
      case 'SHIFT_ENDED': return 'fa-stop text-red-600';
      case 'APPROACH_REGISTERED': return 'fa-file-signature text-navy-600';
      case 'INDIVIDUAL_CREATED': return 'fa-user-plus text-forest-600';
      case 'INDIVIDUAL_EDITED': return 'fa-user-pen text-yellow-600';
      case 'USER_CREATED': return 'fa-user-shield text-navy-600';
      case 'USER_PASSWORD_RESET': return 'fa-key text-red-600';
      case 'USER_PASSWORD_CHANGED': return 'fa-lock text-navy-600';
      case 'IMPORT_INDIVIDUALS': return 'fa-file-import text-forest-600';
      case 'USER_LOGIN': return 'fa-right-to-bracket text-navy-600';
      case 'USER_LOGOUT': return 'fa-right-from-bracket text-navy-400';
      default: return 'fa-info-circle text-navy-400';
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '---';
    const date = timestamp.toDate();
    return date.toLocaleString('pt-BR');
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-900 p-3 rounded-2xl shadow-xl">
            <i className="fas fa-list-check text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Logs do Sistema</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Auditoria de Ações e Operações</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Pesquisar logs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-navy-100 text-navy-950 pl-10 pr-4 py-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-navy-500 outline-none w-full sm:w-64 shadow-sm"
            />
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-navy-300"></i>
          </div>
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white border border-navy-100 text-navy-950 px-4 py-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-navy-500 outline-none shadow-sm appearance-none min-w-[180px]"
          >
            <option value="">Todas as Ações</option>
            <option value="SHIFT_STARTED">Início de Serviço</option>
            <option value="SHIFT_ENDED">Fim de Serviço</option>
            <option value="APPROACH_REGISTERED">Abordagem</option>
            <option value="INDIVIDUAL_CREATED">Novo Cadastro</option>
            <option value="INDIVIDUAL_EDITED">Edição de Cadastro</option>
            <option value="USER_CREATED">Novo Operador</option>
            <option value="USER_PASSWORD_RESET">Senha Resetada</option>
            <option value="USER_PASSWORD_CHANGED">Senha Alterada</option>
            <option value="IMPORT_INDIVIDUALS">Importação</option>
            <option value="USER_LOGIN">Login</option>
            <option value="USER_LOGOUT">Logout</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white border border-navy-100 text-navy-950 px-4 py-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-navy-500 outline-none shadow-sm"
          />
          <button 
            onClick={fetchLogs}
            className="bg-navy-600 hover:bg-navy-500 text-white p-3 rounded-xl transition-all active:scale-95 shadow-lg"
            title="Atualizar Logs"
          >
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>

      {/* Lista de Logs */}
      <section className="px-4 pb-10">
        <div className="bg-white border border-navy-100 rounded-[2rem] shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-navy-50 border-b border-navy-100">
                  <th className="px-6 py-4 text-[10px] font-black text-navy-400 uppercase tracking-widest">Data / Hora</th>
                  <th className="px-6 py-4 text-[10px] font-black text-navy-400 uppercase tracking-widest">Operador</th>
                  <th className="px-6 py-4 text-[10px] font-black text-navy-400 uppercase tracking-widest">Ação</th>
                  <th className="px-6 py-4 text-[10px] font-black text-navy-400 uppercase tracking-widest">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <Siren className="w-8 h-8 text-navy-600 mb-4 animate-pulse mx-auto" />
                      <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">CARREGANDO AUDITORIA...</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="bg-red-50 p-4 rounded-xl inline-block mb-4">
                        <i className="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
                      </div>
                      <p className="text-red-600 font-bold text-xs uppercase tracking-widest">{error}</p>
                      <button 
                        onClick={fetchLogs}
                        className="mt-4 text-[10px] font-black uppercase text-navy-600 hover:text-navy-900 underline"
                      >
                        Tentar Novamente
                      </button>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <p className="text-navy-300 font-black uppercase text-[10px] tracking-widest">Nenhum log encontrado.</p>
                    </td>
                  </tr>
                ) : filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-navy-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[10px] font-bold text-navy-500">{formatTimestamp(log.timestamp)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-navy-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-[10px] text-navy-400"></i>
                        </div>
                        <span className="text-[11px] font-black text-navy-950 uppercase">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <i className={`fas ${getActionIcon(log.action)} text-[10px]`}></i>
                        <span className="text-[10px] font-black uppercase tracking-tighter text-navy-700">{log.action.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] text-navy-600 font-medium leading-relaxed max-w-md">
                        {log.details}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Logs;
