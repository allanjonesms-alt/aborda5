import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { SystemVersion, User } from '../types';

interface VersionModalProps {
  onClose: () => void;
  user: User | null;
  lastVersion?: string;
}

const VersionModal: React.FC<VersionModalProps> = ({ onClose, user, lastVersion }) => {
  const [version, setVersion] = useState(lastVersion || '');
  const [type, setType] = useState<'ATUALIZAÇÃO' | 'REPARO'>('ATUALIZAÇÃO');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lastVersion) setVersion(lastVersion);
  }, [lastVersion]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'system_versions'), {
        version,
        type,
        description,
        date,
        created_at: serverTimestamp()
      });
      await logAction(user?.id || '', user?.nome || 'Sistema', 'VERSION_CREATED', `Nova versão cadastrada: ${version} (${type})`);
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'system_versions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
      <div className="bg-white border border-navy-100 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-navy-600 p-4 border-b border-navy-500 flex justify-between items-center">
          <h3 className="text-white font-black uppercase tracking-tighter">Cadastrar Versão</h3>
          <button onClick={onClose} className="text-navy-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Versão (ex: 1.0.0)</label>
            <input type="text" value={version} onChange={e => setVersion(e.target.value)} required className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Tipo</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none">
              <option value="ATUALIZAÇÃO">ATUALIZAÇÃO</option>
              <option value="REPARO">REPARO</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none min-h-[100px]" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none" />
          </div>
          <button type="submit" disabled={isSaving} className="w-full bg-navy-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-lg">
            {isSaving ? 'Salvando...' : 'Salvar Versão'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VersionModal;
