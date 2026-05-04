import React, { useState, useEffect } from 'react';
import { FileDigit, X, Plus, CheckCircle2, Trash2, Siren, Edit2, MapPin } from 'lucide-react';
import { User, OccurrenceRO } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';
import { allowedCities, checkIsAdmin } from '../lib/utils';

interface ROListProps {
  user: User | null;
}

const ROList: React.FC<ROListProps> = ({ user }) => {
  const [showROModal, setShowROModal] = useState(false);
  const [editingRO, setEditingRO] = useState<OccurrenceRO | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [occurrencesRO, setOccurrencesRO] = useState<OccurrenceRO[]>([]);
  const [roToDelete, setRoToDelete] = useState<{ id: string, nr: string } | null>(null);
  
  const isAdmin = checkIsAdmin(user);
  const userCity = user?.unidade?.toUpperCase().replace(/[\s/]+/g, '') || '';
  const matchedCity = allowedCities.find(city => {
    const normalizedCity = city.toUpperCase().replace(/[\s/]+/g, '');
    return userCity.includes(normalizedCity) || (userCity.includes('RIOVERDE') && normalizedCity === 'RIOVERDE');
  });

  // Priority: User's matched city, fallback to COXIM
  const initialFilter = matchedCity || 'COXIM';
  const [activeFilter, setActiveFilter] = useState(initialFilter);

  // RO Form State
  const [nrRO, setNrRO] = useState('');
  const [fato, setFato] = useState('AMEAÇA');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [guServico, setGuServico] = useState<string[]>([]);
  const [roAddress, setRoAddress] = useState('');
  const [roData, setRoData] = useState<string[]>([]);
  const [operatorName, setOperatorName] = useState('');

  const fatos = [
    'AMEAÇA', 'AMEAÇA (V.D)', 'CAPTURA', 'FURTO', 'LESÃO (V.D)', 
    'LESÃO CORPORAL', 'PORTE DE ARMA', 'PORTE DE DROGAS', 'ROUBO', 
    'TRÁFICO DE DROGAS', 'VIAS DE FATO'
  ].sort();

  const fetchROs = async () => {
    try {
      const roRef = collection(db, 'occurrences_ro');
      const q = query(roRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      let ros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceRO));

      if (activeFilter !== 'TODOS') {
        const normalizedActiveFilter = activeFilter.toUpperCase().replace(/[\s/]+/g, '');
        ros = ros.filter(ro => {
          const roCidade = (ro.cidade || '').toUpperCase().replace(/[\s/]+/g, '');
          const roUnidade = (ro.unidade || '').toUpperCase().replace(/[\s/]+/g, '');
          
          return roCidade === normalizedActiveFilter || 
                 roUnidade.includes(normalizedActiveFilter) ||
                 (normalizedActiveFilter.includes('RIOVERDE') && (roCidade.includes('RIOVERDE') || roUnidade.includes('RIOVERDE')));
        });
      }

      setOccurrencesRO(ros);
    } catch (err) {
      console.error('Erro ao buscar ROs:', err);
    }
  };

  useEffect(() => {
    fetchROs();
  }, [activeFilter]);

  const handleSubmitRO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!nrRO.trim()) {
      setAlertMessage('O número do R.O é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRO) {
        await updateDoc(doc(db, 'occurrences_ro', editingRO.id), {
          nr_ro: nrRO,
          fato: fato,
          date: date,
          time: time,
          gu_servico: guServico,
          roAddress: roAddress,
          roData: roData
        });
        await logAction(user.id, user.nome, 'UPDATE_RO', `Editou R.O Nr: ${nrRO}`);
        setAlertMessage('R.O atualizado com sucesso!');
      } else {
        const docData: Omit<OccurrenceRO, 'id'> = {
          nr_ro: nrRO,
          fato: fato,
          date: date,
          time: time,
          gu_servico: guServico,
          roAddress: roAddress,
          roData: roData,
          unidade: user.unidade,
          criado_por: user.nome,
          created_at: new Date().toISOString()
        };
        await addDoc(collection(db, 'occurrences_ro'), {
          ...docData,
          cidade: activeFilter !== 'TODOS' ? activeFilter : (matchedCity || 'N/I')
        });
        await logAction(user.id, user.nome, 'CREATE_RO', `Criou R.O Nr: ${nrRO} - Fato: ${fato}`);
        setAlertMessage('R.O registrado com sucesso!');
      }
      setShowROModal(false);
      setEditingRO(null);
      setNrRO('');
      setDate('');
      setTime('');
      setGuServico([]);
      setRoAddress('');
      setRoData([]);
      fetchROs();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences_ro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRO = async () => {
    if (!roToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'occurrences_ro', roToDelete.id));
      await logAction(user!.id, user!.nome, 'DELETE_RO', `Excluiu R.O Nr: ${roToDelete.nr}`);
      setAlertMessage('R.O excluído com sucesso!');
      setRoToDelete(null);
      fetchROs();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'occurrences_ro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (ro: OccurrenceRO) => {
    setEditingRO(ro);
    setNrRO(ro.nr_ro);
    setFato(Array.isArray(ro.fato) ? ro.fato[0] : ro.fato);
    setTime(ro.time || '');
    setDate(ro.date || '');
    setGuServico(ro.gu_servico || []);
    setRoAddress(ro.roAddress || '');
    setRoData(ro.roData || []);
    setShowROModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Lista de R.O</h2>
          <p className="text-navy-500 mt-1 uppercase text-xs font-bold tracking-widest">Relatórios de Ocorrência Realizados</p>
        </div>

        <button 
          onClick={() => { setEditingRO(null); setNrRO(''); setShowROModal(true); }}
          className="bg-red-700 hover:bg-red-800 text-white font-black uppercase py-3 px-6 rounded-2xl shadow-xl shadow-red-700/20 transition-all flex items-center gap-2"
        >
          <Plus size={20} /> Incluir R.O
        </button>
      </div>

      {/* City Filters */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest px-1">Filtrar por Cidade:</label>
        <div className="relative flex-1 max-w-xs">
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="w-full bg-white border-2 border-navy-100 rounded-xl px-4 py-3 text-sm font-bold text-navy-900 outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 appearance-none transition-all"
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
        {occurrencesRO.map(ro => (
          <div key={ro.id} className="border border-navy-100 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="font-bold text-red-600 text-lg flex items-center gap-2">
                <Siren size={20} /> RO: {ro.nr_ro}
              </p>
              <p className="text-sm text-navy-600 mt-1">
                {Array.isArray(ro.fato) ? ro.fato.join(', ') : ro.fato}
              </p>
              {ro.date && ro.time && (
                <p className="text-xs text-navy-500 mt-1">Data/Hora: {ro.date} - {ro.time}</p>
              )}
              {ro.roAddress && (
                <p className="text-xs text-navy-800 mt-1 font-medium bg-navy-50/50 px-2 py-1 rounded-lg border border-navy-100 flex items-center gap-1.5">
                  <MapPin size={10} className="text-navy-400" />
                  {ro.roAddress}
                </p>
              )}
              {ro.roData && Array.isArray(ro.roData) && (
                <ul className="list-disc list-inside mt-1">
                  {ro.roData.map((event: string, i: number) => (
                    <li key={i} className="text-sm text-navy-800">{event}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <p className="text-xs text-navy-400 flex items-center gap-1 bg-navy-50 px-2 py-0.5 rounded">
                  <MapPin size={10} /> {ro.cidade || 'N/I'}
                </p>
                <p className="text-xs text-navy-400">Criado por: {ro.criado_por}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEditModal(ro)} className="p-2 text-navy-500 hover:text-navy-900"><Edit2 size={18} /></button>
              <button onClick={() => setRoToDelete({ id: ro.id, nr: ro.nr_ro })} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* RO Modal */}
      {showROModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-in">
            <div className="bg-red-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileDigit className="text-white" size={24} />
                <h3 className="text-white font-black uppercase tracking-tighter text-xl">{editingRO ? 'Editar R.O' : 'Novo R.O'}</h3>
              </div>
              <button onClick={() => setShowROModal(false)} className="text-red-300 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitRO} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
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
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Data</label>
                  <input 
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-red-600 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Horário</label>
                  <input 
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-red-600 outline-none transition-all"
                  />
                </div>
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

              <div className="space-y-2">
                <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest ml-1">Endereço (Local da Ocorrência)</label>
                <input 
                  type="text"
                  value={roAddress}
                  onChange={(e) => setRoAddress(e.target.value)}
                  className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-900 font-bold focus:ring-2 focus:ring-red-600 outline-none transition-all"
                  placeholder="Ex: Av. Principal, 123"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Lista de Eventos / Dados</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      const event = window.prompt('Descrição do Evento:');
                      if (event) setRoData([...roData, event.toUpperCase()]);
                    }}
                    className="text-red-700 font-black text-[9px] uppercase tracking-wider hover:underline"
                  >
                    + Adicionar Evento
                  </button>
                </div>
                
                <div className="space-y-2">
                  {roData.map((event, i) => (
                    <div key={i} className="bg-navy-50 p-3 rounded-xl flex items-center justify-between border border-navy-100">
                      <p className="text-[10px] font-bold text-navy-800">{event}</p>
                      <button type="button" onClick={() => setRoData(roData.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {roData.length === 0 && <p className="text-[10px] text-navy-300 font-bold uppercase italic p-2">Nenhum evento registrado</p>}
                </div>
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
                    className="text-red-700 font-black text-[9px] uppercase tracking-wider hover:underline"
                  >
                    + Adicionar
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {guServico.map((m, i) => (
                    <span key={i} className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-red-100">
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
                className="w-full bg-red-700 hover:bg-red-800 text-white font-black uppercase py-5 rounded-2xl shadow-xl shadow-red-700/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 mt-4"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    {editingRO ? 'Atualizar R.O' : 'Registrar R.O'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {roToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md">
          <div className="bg-white border-2 border-red-600 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-red-600 p-6 flex items-center gap-4">
              <i className="fas fa-exclamation-triangle text-white text-3xl"></i>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Confirmar Exclusão</h3>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-navy-950 text-sm font-medium">Tem certeza que deseja excluir o R.O <span className="font-black text-red-600">{roToDelete.nr}</span> permanentemente?</p>
              <div className="flex gap-4">
                <button onClick={() => setRoToDelete(null)} className="flex-1 bg-navy-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px]">Cancelar</button>
                <button onClick={deleteRO} disabled={isSubmitting} className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl uppercase text-[10px]">{isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : 'Excluir'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ROList;
