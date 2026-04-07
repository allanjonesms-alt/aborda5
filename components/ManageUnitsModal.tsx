
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { Unit, User } from '../types';
import UnitFeaturesModal from './UnitFeaturesModal';

interface ManageUnitsModalProps {
  onClose: () => void;
  user: User | null;
}

const ManageUnitsModal: React.FC<ManageUnitsModalProps> = ({ onClose, user }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnitForFeatures, setSelectedUnitForFeatures] = useState<Unit | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const q = query(collection(db, 'units'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Units snapshot received, size:', snapshot.size);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      console.log('Units data:', data);
      setUnits(data);
      setIsLoading(false);
    }, (err) => {
      console.error('Units snapshot error:', err);
      setError('Erro ao carregar unidades. Verifique sua conexão ou permissões.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'units'), {
        nome: newUnitName.trim(),
        created_at: serverTimestamp()
      });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'UNIT_CREATED',
        `Nova unidade cadastrada: ${newUnitName}`,
        { unitName: newUnitName }
      );

      setNewUnitName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'units');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUnit = async (unit: Unit) => {
    if (!confirm(`Deseja realmente excluir a unidade "${unit.nome}"?`)) return;

    try {
      await deleteDoc(doc(db, 'units', unit.id));
      
      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'UNIT_DELETED',
        `Unidade excluída: ${unit.nome}`,
        { unitId: unit.id, unitName: unit.nome }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `units/${unit.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
      <div className="bg-white border border-navy-100 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-navy-600 p-4 border-b border-navy-500 flex justify-between items-center">
          <h3 className="text-white font-black uppercase tracking-tighter">Gerenciar Unidades</h3>
          <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleAddUnit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Nova Unidade</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  required
                  className="flex-1 bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
                  placeholder="Ex: 5° BPM"
                  value={newUnitName}
                  onChange={e => setNewUnitName(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={isSaving || !newUnitName.trim()}
                  className="bg-navy-600 hover:bg-navy-500 disabled:bg-navy-300 text-white px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Unidades Cadastradas</label>
            {isLoading ? (
              <div className="py-10 text-center">
                <i className="fas fa-spinner fa-spin text-navy-400"></i>
              </div>
            ) : error ? (
              <div className="py-10 text-center bg-red-50 rounded-2xl border border-dashed border-red-200">
                <p className="text-red-500 font-bold text-xs">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 text-[8px] font-black uppercase text-red-600 underline"
                >
                  Recarregar Página
                </button>
              </div>
            ) : units.length === 0 ? (
              <div className="py-10 text-center bg-navy-50 rounded-2xl border border-dashed border-navy-200 space-y-4">
                <p className="text-navy-400 font-bold text-xs">Nenhuma unidade cadastrada.</p>
                <button 
                  onClick={async () => {
                    setIsSaving(true);
                    const defaultUnits = ['5° BPM', '5°BPM-Sede', '2ª CIA - Rio Verde', '3° Pelotão - Alcinópolis', '2° Pelotão - Pedro Gomes'];
                    try {
                      const batch = writeBatch(db);
                      defaultUnits.forEach(nome => {
                        const unitRef = doc(collection(db, 'units'));
                        batch.set(unitRef, { nome, created_at: serverTimestamp() });
                      });
                      await batch.commit();
                      await logAction(user?.id || '', user?.nome || 'Sistema', 'UNIT_SEED', 'Importação inicial de unidades realizada.');
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, 'units');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="bg-navy-600 hover:bg-navy-500 text-white px-4 py-2 rounded-xl font-black uppercase text-[8px] tracking-widest shadow-lg transition-all"
                >
                  Importar Unidades Padrão
                </button>
              </div>
            ) : (
              units.map(unit => (
                <div key={unit.id} className="flex items-center justify-between bg-white border border-navy-100 p-4 rounded-2xl hover:border-navy-600 transition-all group">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => setSelectedUnitForFeatures(unit)}
                  >
                    <span className="text-navy-950 font-bold uppercase text-xs block">{unit.nome}</span>
                    <span className="text-[8px] text-navy-400 font-black uppercase tracking-widest mt-1">Clique para gerenciar menu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedUnitForFeatures(unit)}
                      className="text-navy-300 hover:text-navy-600 transition-colors p-2"
                      title="Configurar Menu"
                    >
                      <i className="fas fa-gears"></i>
                    </button>
                    <button 
                      onClick={() => handleDeleteUnit(unit)}
                      className="text-navy-300 hover:text-red-500 transition-colors p-2"
                      title="Excluir Unidade"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 bg-navy-50 border-t border-navy-100 flex justify-end">
          <button 
            onClick={onClose}
            className="bg-white text-navy-900 font-black px-8 py-3 rounded-xl uppercase text-[10px] border border-navy-200 hover:bg-navy-100 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>

      {selectedUnitForFeatures && (
        <UnitFeaturesModal 
          unit={selectedUnitForFeatures} 
          onClose={() => setSelectedUnitForFeatures(null)} 
          user={user}
        />
      )}
    </div>
  );
};

export default ManageUnitsModal;
