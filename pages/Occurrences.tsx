
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileSearch, X, Search, Plus, UserPlus, Trash2, CheckCircle2, FileDigit } from 'lucide-react';
import { User, UserRole, OccurrenceSS, OccurrenceRO } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';

interface OccurrencesProps {
  user: User | null;
}

const Occurrences: React.FC<OccurrencesProps> = ({ user }) => {
  const [showSSModal, setShowSSModal] = useState(false);
  const [showROModal, setShowROModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // SS Form State
  const [nrSS, setNrSS] = useState('');
  const [tipoSS, setTipoSS] = useState<'Rondas' | 'Policiamento em evento' | 'Policiamento Medidas Protetivas' | 'Atendimento de Chamada'>('Rondas');
  const [guServico, setGuServico] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  // RO Form State
  const [nrRO, setNrRO] = useState('');
  const [fato, setFato] = useState('AMEAÇA');

  const navigate = useNavigate();

  const fatos = [
    'AMEAÇA', 'AMEAÇA (V.D)', 'CAPTURA', 'FURTO', 'LESÃO (V.D)', 
    'LESÃO CORPORAL', 'PORTE DE ARMA', 'PORTE DE DROGAS', 'ROUBO', 
    'TRÁFICO DE DROGAS', 'VIAS DE FATO'
  ].sort();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('nome', 'asc'));
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setAllUsers(users);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (userSearch.trim() === '') {
      setFilteredUsers([]);
    } else {
      const filtered = allUsers.filter(u => 
        u.nome.toLowerCase().includes(userSearch.toLowerCase()) && 
        !guServico.includes(u.nome)
      );
      setFilteredUsers(filtered);
    }
  }, [userSearch, allUsers, guServico]);

  const handleAddOperator = (name: string) => {
    setGuServico([...guServico, name]);
    setUserSearch('');
  };

  const handleRemoveOperator = (name: string) => {
    setGuServico(guServico.filter(n => n !== name));
  };

  const handleSubmitSS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (nrSS.length !== 10 || !/^\d+$/.test(nrSS)) {
      setAlertMessage('O número da SS deve conter exatamente 10 algarismos numéricos.');
      return;
    }
    if (guServico.length === 0) {
      setAlertMessage('Adicione pelo menos um operador à GU de Serviço.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docData: Omit<OccurrenceSS, 'id'> = {
        nr_ss: nrSS,
        tipo_ss: tipoSS,
        gu_servico: guServico,
        unidade: user.unidade,
        criado_por: user.nome,
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'occurrences_ss'), docData);
      await logAction(user.id, user.nome, 'CREATE_SS', `Criou SS Nr: ${nrSS}`);
      setAlertMessage('SS registrada com sucesso!');
      setShowSSModal(false);
      setNrSS('');
      setGuServico([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences_ss');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!nrRO.trim()) {
      setAlertMessage('O número do R.O é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docData: Omit<OccurrenceRO, 'id'> = {
        nr_ro: nrRO,
        fato: fato,
        unidade: user.unidade,
        criado_por: user.nome,
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'occurrences_ro'), docData);
      await logAction(user.id, user.nome, 'CREATE_RO', `Criou R.O Nr: ${nrRO} - Fato: ${fato}`);
      setAlertMessage('R.O registrado com sucesso!');
      setShowROModal(false);
      setNrRO('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences_ro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      <div className="mb-10 animate-fade-in">
        <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Ocorrências</h2>
        <p className="text-navy-500 mt-1 uppercase text-xs font-bold tracking-widest">SS e RO Realizados</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <button 
          onClick={() => setShowSSModal(true)}
          className="group bg-white border border-navy-100 p-8 rounded-3xl shadow-sm hover:shadow-2xl hover:border-navy-300 transition-all flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-navy-600 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform shadow-lg">
            <FileText size={40} className="text-white" />
          </div>
          <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight mb-2">SS</h3>
          <p className="text-navy-500 text-sm leading-relaxed">Registrar Solicitação de Serviço.</p>
        </button>

        <button 
          onClick={() => setShowROModal(true)}
          className="group bg-white border border-navy-100 p-8 rounded-3xl shadow-sm hover:shadow-2xl hover:border-navy-300 transition-all flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-red-700 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform shadow-lg">
            <FileDigit size={40} className="text-white" />
          </div>
          <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight mb-2">R.O</h3>
          <p className="text-navy-500 text-sm leading-relaxed">Registrar Relatório de Ocorrência.</p>
        </button>
      </div>

      {/* SS Modal */}
      {showSSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-navy-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="text-white" size={24} />
                <h3 className="text-white font-black uppercase tracking-tighter text-xl">Nova SS</h3>
              </div>
              <button onClick={() => setShowSSModal(false)} className="text-navy-300 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitSS} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Nr da SS (10 dígitos)</label>
                <input 
                  type="text"
                  maxLength={10}
                  value={nrSS}
                  onChange={(e) => setNrSS(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all"
                  placeholder="0000000000"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Tipo de SS</label>
                <select 
                  value={tipoSS}
                  onChange={(e) => setTipoSS(e.target.value as any)}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all appearance-none"
                >
                  <option value="Rondas">Rondas</option>
                  <option value="Policiamento em evento">Policiamento em evento</option>
                  <option value="Policiamento Medidas Protetivas">Policiamento Medidas Protetivas</option>
                  <option value="Atendimento de Chamada">Atendimento de Chamada</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">GU de Serviço</label>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {guServico.map(name => (
                    <span key={name} className="bg-navy-100 text-navy-900 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                      {name}
                      <button type="button" onClick={() => handleRemoveOperator(name)} className="text-navy-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search size={18} className="text-navy-400" />
                  </div>
                  <input 
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl pl-12 pr-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all"
                    placeholder="Buscar operador..."
                  />
                  
                  {filteredUsers.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-navy-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredUsers.map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleAddOperator(u.nome)}
                          className="w-full px-5 py-3 text-left hover:bg-navy-50 text-navy-900 font-bold text-sm flex items-center justify-between group"
                        >
                          {u.nome}
                          <Plus size={16} className="text-navy-400 group-hover:text-navy-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-navy-600 hover:bg-navy-700 text-white font-black uppercase py-5 rounded-2xl shadow-xl shadow-navy-600/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Registrar SS
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RO Modal */}
      {showROModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-red-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileDigit className="text-white" size={24} />
                <h3 className="text-white font-black uppercase tracking-tighter text-xl">Novo R.O</h3>
              </div>
              <button onClick={() => setShowROModal(false)} className="text-red-300 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitRO} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Nr. do R.O</label>
                <input 
                  type="text"
                  value={nrRO}
                  onChange={(e) => setNrRO(e.target.value)}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-red-600 outline-none transition-all"
                  placeholder="Ex: 1234/2024"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Fato</label>
                <select 
                  value={fato}
                  onChange={(e) => setFato(e.target.value)}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-red-600 outline-none transition-all appearance-none"
                >
                  {fatos.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-red-700 hover:bg-red-800 text-white font-black uppercase py-5 rounded-2xl shadow-xl shadow-red-700/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    Registrar R.O
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Occurrences;
