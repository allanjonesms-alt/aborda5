import React, { useState, useEffect } from 'react';
import { FileDigit, X, Plus, CheckCircle2, Trash2, ClipboardList, Edit2, MapPin } from 'lucide-react';
import { User, OccurrenceSS } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';
import { allowedCities, checkIsAdmin } from '../lib/utils';

interface SSListProps {
  user: User | null;
}

const SSList: React.FC<SSListProps> = ({ user }) => {
  const [showSSModal, setShowSSModal] = useState(false);
  const [editingSS, setEditingSS] = useState<OccurrenceSS | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [occurrencesSS, setOccurrencesSS] = useState<OccurrenceSS[]>([]);
  const [ssToDelete, setSsToDelete] = useState<{ id: string, nr: string } | null>(null);
  
  const isAdmin = checkIsAdmin(user);
  const userCity = user?.unidade?.toUpperCase().replace(/[\s/]+/g, '') || '';
  const matchedCity = allowedCities.find(city => {
    const normalizedCity = city.toUpperCase().replace(/[\s/]+/g, '');
    return userCity.includes(normalizedCity) || (userCity.includes('RIOVERDE') && normalizedCity === 'RIOVERDE');
  });

  // Priority: User's matched city, fallback to COXIM
  const initialFilter = matchedCity || 'COXIM';
  const [activeFilter, setActiveFilter] = useState(initialFilter);

  // SS Form State
  const [nrSS, setNrSS] = useState('');
  const [tipoSS, setTipoSS] = useState<OccurrenceSS['tipo_ss']>('Atendimento de Chamada');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guServico, setGuServico] = useState<string[]>([]);
  const [roAddress, setRoAddress] = useState('');

  const tipos: OccurrenceSS['tipo_ss'][] = [
    'Rondas', 'Policiamento em evento', 'Policiamento Medidas Protetivas', 'Atendimento de Chamada'
  ];

  const fetchSSs = async () => {
    try {
      const ssRef = collection(db, 'occurrences');
      const q = query(ssRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      let sss = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceSS));
      
      if (activeFilter !== 'TODOS') {
        const normalizedActiveFilter = activeFilter.toUpperCase().replace(/[\s/]+/g, '');
        sss = sss.filter(ss => {
          const ssCidade = (ss.cidade || '').toUpperCase().replace(/[\s/]+/g, '');
          const ssUnidade = (ss.unidade || '').toUpperCase().replace(/[\s/]+/g, '');
          
          return ssCidade === normalizedActiveFilter || 
                 ssUnidade.includes(normalizedActiveFilter) ||
                 (normalizedActiveFilter.includes('RIOVERDE') && (ssCidade.includes('RIOVERDE') || ssUnidade.includes('RIOVERDE')));
        });
      }
      
      setOccurrencesSS(sss);
    } catch (err) {
      console.error('Erro ao buscar SSs:', err);
    }
  };

  useEffect(() => {
    fetchSSs();
  }, [activeFilter]);

  const handleSubmitSS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!nrSS.trim()) {
      setAlertMessage('O número da S.S é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSS) {
        await updateDoc(doc(db, 'occurrences', editingSS.id), {
          nr_ss: nrSS,
          tipo_ss: tipoSS,
          date: date,
          time: time,
          gu_servico: guServico,
          roAddress: roAddress
        });
        await logAction(user.id, user.nome, 'UPDATE_SS', `Editou S.S Nr: ${nrSS}`);
        setAlertMessage('S.S atualizada com sucesso!');
      } else {
        const docData: Omit<OccurrenceSS, 'id'> = {
          nr_ss: nrSS,
          tipo_ss: tipoSS,
          date: date,
          time: time,
          gu_servico: guServico,
          roAddress: roAddress,
          unidade: user.unidade,
          criado_por: user.nome,
          created_at: new Date().toISOString()
        };
        await addDoc(collection(db, 'occurrences'), {
          ...docData,
          cidade: activeFilter !== 'TODOS' ? activeFilter : (matchedCity || 'N/I')
        });
        await logAction(user.id, user.nome, 'CREATE_SS', `Criou S.S Nr: ${nrSS} - Tipo: ${tipoSS}`);
        setAlertMessage('S.S registrado com sucesso!');
      }
      setShowSSModal(false);
      setEditingSS(null);
      setNrSS('');
      setDate('');
      setTime('');
      setGuServico([]);
      setRoAddress('');
      fetchSSs();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSS = async () => {
    if (!ssToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'occurrences', ssToDelete.id));
      await logAction(user!.id, user!.nome, 'DELETE_SS', `Excluiu S.S Nr: ${ssToDelete.nr}`);
      setAlertMessage('S.S excluída com sucesso!');
      setSsToDelete(null);
      fetchSSs();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'occurrences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (ss: OccurrenceSS) => {
    setEditingSS(ss);
    setNrSS(ss.nr_ss);
    setTipoSS(ss.tipo_ss);
    setDate(ss.date || '');
    setTime(ss.time || '');
    setGuServico(ss.gu_servico || []);
    setRoAddress(ss.roAddress || '');
    setShowSSModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Lista de S.S</h2>
          <p className="text-navy-500 mt-1 uppercase text-xs font-bold tracking-widest">Solicitações de Serviço Realizadas</p>
        </div>

        <button 
          onClick={() => { setEditingSS(null); setNrSS(''); setShowSSModal(true); }}
          className="bg-navy-700 hover:bg-navy-800 text-white font-black uppercase py-3 px-6 rounded-2xl shadow-xl shadow-navy-700/20 transition-all flex items-center gap-2"
        >
          <Plus size={20} /> Incluir S.S
        </button>
      </div>

      {/* City Filters */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest px-1">Filtrar por Cidade:</label>
        <div className="relative flex-1 max-w-xs">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full bg-white border-2 border-navy-100 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 appearance-none transition-all"
          >
            {isAdmin && <option value="TODOS">TODAS AS CIDADES</option>}
            {allowedCities.map(city => (
              <option key={city} value={city} disabled={!isAdmin && matchedCity !== city}>
                {city}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-navy-400">
            <i className="fas fa-chevron-down"></i>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {occurrencesSS.map(ss => (
          <div key={ss.id} className="border border-navy-100 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="font-bold text-navy-950 text-lg flex items-center gap-2">
                <ClipboardList size={20} /> SS: {ss.nr_ss}
              </p>
              <p className="text-sm text-navy-600 mt-1">{ss.tipo_ss}</p>
              {ss.date && ss.time && (
                <p className="text-xs text-navy-500 mt-1">Data/Hora: {ss.date} - {ss.time}</p>
              )}
              {ss.roAddress && (
                <p className="text-xs text-navy-800 mt-1 font-medium bg-navy-50/50 px-2 py-1 rounded-lg border border-navy-100 flex items-center gap-1.5">
                  <MapPin size={10} className="text-navy-400" />
                  {ss.roAddress}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <p className="text-xs text-navy-400 flex items-center gap-1 bg-navy-50 px-2 py-0.5 rounded">
                  <MapPin size={10} /> {ss.cidade || 'N/I'}
                </p>
                <p className="text-xs text-navy-400">Criado por: {ss.criado_por}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEditModal(ss)} className="p-2 text-navy-500 hover:text-navy-900"><Edit2 size={18} /></button>
              <button onClick={() => setSsToDelete({ id: ss.id, nr: ss.nr_ss })} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* SS Modal */}
      {showSSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-navy-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileDigit className="text-white" size={24} />
                <h3 className="text-white font-black uppercase tracking-tighter text-xl">{editingSS ? 'Editar S.S' : 'Nova S.S'}</h3>
              </div>
              <button onClick={() => setShowSSModal(false)} className="text-navy-300 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitSS} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Nr. da S.S</label>
                  <input 
                    type="text"
                    value={nrSS}
                    onChange={(e) => setNrSS(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all"
                    placeholder="Ex: 1234567890"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Data</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Horário</label>
                  <input 
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Tipo</label>
                <select 
                  value={tipoSS}
                  onChange={(e) => setTipoSS(e.target.value as OccurrenceSS['tipo_ss'])}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all appearance-none"
                >
                  {tipos.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Endereço (Local da Ocorrência)</label>
                <input 
                  type="text"
                  value={roAddress}
                  onChange={(e) => setRoAddress(e.target.value)}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-navy-600 outline-none transition-all"
                  placeholder="Ex: Av. Principal, 123"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Guarnição de Serviço</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const name = window.prompt('Nome do Operador:');
                      if (name) setGuServico([...guServico, name.toUpperCase()]);
                    }}
                    className="text-navy-700 font-black text-[9px] uppercase tracking-wider hover:underline"
                  >
                    + Adicionar
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {guServico.map((m, i) => (
                    <span key={i} className="bg-navy-50 text-navy-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-navy-100">
                      {m}
                      <button type="button" onClick={() => setGuServico(guServico.filter((_, idx) => idx !== i))}><X size={12} /></button>
                    </span>
                  ))}
                  {guServico.length === 0 && <p className="text-[10px] text-navy-300 font-bold uppercase italic p-2">Nenhum operador adicionado</p>}
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-navy-700 hover:bg-navy-800 text-white font-black uppercase py-5 rounded-2xl shadow-xl shadow-navy-700/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 mt-4"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    {editingSS ? 'Atualizar S.S' : 'Registrar S.S'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {ssToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md">
          <div className="bg-white border-2 border-navy-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-navy-900 p-6 flex items-center gap-4">
              <i className="fas fa-exclamation-triangle text-white text-3xl"></i>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Confirmar Exclusão</h3>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-navy-950 text-sm font-medium">Tem certeza que deseja excluir a S.S <span className="font-black text-navy-900">{ssToDelete.nr}</span> permanentemente?</p>
              <div className="flex gap-4">
                <button onClick={() => setSsToDelete(null)} className="flex-1 bg-navy-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px]">Cancelar</button>
                <button onClick={deleteSS} disabled={isSubmitting} className="flex-1 bg-navy-900 text-white font-black py-4 rounded-2xl uppercase text-[10px]">{isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : 'Excluir'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SSList;
