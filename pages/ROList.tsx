import React, { useState, useEffect } from 'react';
import { FileDigit, X, Plus, CheckCircle2, Trash2, Siren, Edit2 } from 'lucide-react';
import { User, OccurrenceRO } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';

interface ROListProps {
  user: User | null;
}

const ROList: React.FC<ROListProps> = ({ user }) => {
  const [showROModal, setShowROModal] = useState(false);
  const [editingRO, setEditingRO] = useState<OccurrenceRO | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [occurrencesRO, setOccurrencesRO] = useState<OccurrenceRO[]>([]);
  
  // RO Form State
  const [nrRO, setNrRO] = useState('');
  const [fato, setFato] = useState('AMEAÇA');

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
      const ros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OccurrenceRO));
      setOccurrencesRO(ros);
    } catch (err) {
      console.error('Erro ao buscar ROs:', err);
    }
  };

  useEffect(() => {
    fetchROs();
  }, []);

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
        });
        await logAction(user.id, user.nome, 'UPDATE_RO', `Editou R.O Nr: ${nrRO}`);
        setAlertMessage('R.O atualizado com sucesso!');
      } else {
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
      }
      setShowROModal(false);
      setEditingRO(null);
      setNrRO('');
      fetchROs();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences_ro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRO = async (id: string, nr: string) => {
    if (!confirm(`Tem certeza que deseja excluir o R.O ${nr}?`)) return;
    try {
      await deleteDoc(doc(db, 'occurrences_ro', id));
      await logAction(user!.id, user!.nome, 'DELETE_RO', `Excluiu R.O Nr: ${nr}`);
      setAlertMessage('R.O excluído com sucesso!');
      fetchROs();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'occurrences_ro');
    }
  };

  const openEditModal = (ro: OccurrenceRO) => {
    setEditingRO(ro);
    setNrRO(ro.nr_ro);
    setFato(Array.isArray(ro.fato) ? ro.fato[0] : ro.fato);
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
              {ro.roData && Array.isArray(ro.roData) && (
                <ul className="list-disc list-inside mt-1">
                  {ro.roData.map((event: string, i: number) => (
                    <li key={i} className="text-sm text-navy-800">{event}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-navy-400 mt-1">Criado por: {ro.criado_por}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEditModal(ro)} className="p-2 text-navy-500 hover:text-navy-900"><Edit2 size={18} /></button>
              <button onClick={() => deleteRO(ro.id, ro.nr_ro)} className="p-2 text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
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
                    {editingRO ? 'Atualizar R.O' : 'Registrar R.O'}
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

export default ROList;
