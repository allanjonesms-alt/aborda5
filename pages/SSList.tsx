import React, { useState, useEffect } from 'react';
import { FileDigit, X, Plus, CheckCircle2, Trash2, ClipboardList, Edit2 } from 'lucide-react';
import { User, OccurrenceSS } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';

interface SSListProps {
  user: User | null;
}

const SSList: React.FC<SSListProps> = ({ user }) => {
  const [showSSModal, setShowSSModal] = useState(false);
  const [editingSS, setEditingSS] = useState<OccurrenceSS | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [occurrencesSS, setOccurrencesSS] = useState<OccurrenceSS[]>([]);
  
  // SS Form State
  const [nrSS, setNrSS] = useState('');
  const [tipoSS, setTipoSS] = useState<OccurrenceSS['tipo_ss']>('Atendimento de Chamada');

  const tipos: OccurrenceSS['tipo_ss'][] = [
    'Rondas', 'Policiamento em evento', 'Policiamento Medidas Protetivas', 'Atendimento de Chamada'
  ];

  const fetchSSs = async () => {
    try {
      const ssRef = collection(db, 'occurrences');
      const q = query(ssRef, orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);
      const sss = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceSS));
      setOccurrencesSS(sss);
    } catch (err) {
      console.error('Erro ao buscar SSs:', err);
    }
  };

  useEffect(() => {
    fetchSSs();
  }, []);

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
        });
        await logAction(user.id, user.nome, 'UPDATE_SS', `Editou S.S Nr: ${nrSS}`);
        setAlertMessage('S.S atualizada com sucesso!');
      } else {
        const docData: Omit<OccurrenceSS, 'id'> = {
          nr_ss: nrSS,
          tipo_ss: tipoSS,
          gu_servico: [],
          unidade: user.unidade,
          criado_por: user.nome,
          created_at: new Date().toISOString()
        };
        await addDoc(collection(db, 'occurrences'), docData);
        await logAction(user.id, user.nome, 'CREATE_SS', `Criou S.S Nr: ${nrSS} - Tipo: ${tipoSS}`);
        setAlertMessage('S.S registrado com sucesso!');
      }
      setShowSSModal(false);
      setEditingSS(null);
      setNrSS('');
      fetchSSs();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSS = async (id: string, nr: string) => {
    if (!confirm(`Tem certeza que deseja excluir a S.S ${nr}?`)) return;
    try {
      await deleteDoc(doc(db, 'occurrences', id));
      await logAction(user!.id, user!.nome, 'DELETE_SS', `Excluiu S.S Nr: ${nr}`);
      setAlertMessage('S.S excluída com sucesso!');
      fetchSSs();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'occurrences');
    }
  };

  const openEditModal = (ss: OccurrenceSS) => {
    setEditingSS(ss);
    setNrSS(ss.nr_ss);
    setTipoSS(ss.tipo_ss);
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
              <p className="text-xs text-navy-400 mt-1">Criado por: {ss.criado_por}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEditModal(ss)} className="p-2 text-navy-500 hover:text-navy-900"><Edit2 size={18} /></button>
              <button onClick={() => deleteSS(ss.id, ss.nr_ss)} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
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
            
            <form onSubmit={handleSubmitSS} className="p-8 space-y-6">
              <div className="space-y-2">
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

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-navy-700 hover:bg-navy-800 text-white font-black uppercase py-5 rounded-2xl shadow-xl shadow-navy-700/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
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
    </div>
  );
};

export default SSList;
