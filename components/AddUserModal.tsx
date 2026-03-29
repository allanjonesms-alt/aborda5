
import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, getDocs, writeBatch, doc, orderBy } from 'firebase/firestore';
import { UserRole, User } from '../types';

interface AddUserModalProps {
  onClose: () => void;
  onSave: () => void;
  currentUser: User | null;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ onClose, onSave, currentUser }) => {
  const [formData, setFormData] = useState({
    matricula: '',
    nome: '',
    senha: '',
    role: UserRole.OPERATOR,
    ord: 0,
    unidade: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    try {
      const batch = writeBatch(db);

      // 1. Check if matricula already exists
      const qCheck = query(collection(db, 'users'), where('matricula', '==', formData.matricula.trim()));
      const snapCheck = await getDocs(qCheck);
      if (!snapCheck.empty) {
        throw new Error('Esta matrícula já está cadastrada.');
      }

      // 2. Lógica de Reordenamento (ord + 1)
      const qShift = query(collection(db, 'users'), where('ord', '>=', formData.ord));
      const snapShift = await getDocs(qShift);

      snapShift.docs.forEach((docSnap) => {
        const data = docSnap.data();
        batch.update(docSnap.ref, { ord: (data.ord || 0) + 1 });
      });

      // 3. Inserção do Novo Operador
      const newUserRef = doc(collection(db, 'users'));
      batch.set(newUserRef, {
        matricula: formData.matricula.trim(),
        nome: formData.nome.toUpperCase(),
        senha: formData.senha,
        role: formData.role,
        ord: formData.ord,
        unidade: formData.unidade.toUpperCase(),
        primeiro_acesso: false,
        created_at: new Date().toISOString()
      });

      await batch.commit();

      // Log the action
      await logAction(
        currentUser?.id || '',
        currentUser?.nome || 'Sistema',
        'USER_CREATED',
        `Novo operador cadastrado: ${formData.nome.toUpperCase()} (MAT: ${formData.matricula})`,
        { newUserMatricula: formData.matricula }
      );

      onSave();
      onClose();
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      handleFirestoreError(err, OperationType.WRITE, 'users/batch');
      setError(err.message || 'Erro ao processar cadastro e reordenamento.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
      <div className="bg-white border border-navy-100 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-navy-50 p-4 border-b border-navy-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-navy-900 p-2 rounded-xl shadow-lg">
              <i className="fas fa-user-plus text-white"></i>
            </div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Novo Operador</h3>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
            <input 
              type="text" 
              required
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all uppercase"
              placeholder="NOME DO POLICIAL"
              value={formData.nome}
              onChange={e => setFormData(prev => ({...prev, nome: e.target.value.toUpperCase()}))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Matrícula</label>
              <input 
                type="text" 
                required
                className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
                placeholder="ID"
                value={formData.matricula}
                onChange={e => setFormData(prev => ({...prev, matricula: e.target.value}))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Posição na VTR (ORD)</label>
              <input 
                type="number" 
                className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
                value={formData.ord}
                onChange={e => setFormData(prev => ({...prev, ord: parseInt(e.target.value) || 0}))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Unidade</label>
            <select 
              required
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
              value={formData.unidade}
              onChange={e => setFormData(prev => ({...prev, unidade: e.target.value}))}
            >
              <option value="">Selecione a Unidade</option>
              <option value="5° BPM">5° BPM</option>
              <option value="5°BPM-Sede">5°BPM-Sede</option>
              <option value="2ª CIA - Rio Verde">2ª CIA - Rio Verde</option>
              <option value="3° Pelotão - Alcinópolis">3° Pelotão - Alcinópolis</option>
              <option value="2° Pelotão - Pedro Gomes">2° Pelotão - Pedro Gomes</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Senha Inicial</label>
            <input 
              type="password" 
              required
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none transition-all"
              placeholder="••••••••"
              value={formData.senha}
              onChange={e => setFormData(prev => ({...prev, senha: e.target.value}))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2 ml-1">Perfil de Acesso</label>
            <select 
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
              value={formData.role}
              onChange={e => setFormData(prev => ({...prev, role: e.target.value as UserRole}))}
            >
              <option value={UserRole.OPERATOR}>OPERADOR</option>
              <option value={UserRole.ADMIN}>ADMINISTRADOR</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase text-center flex items-center justify-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <div className="flex gap-4 pt-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 bg-navy-100 hover:bg-navy-200 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] transition-all border border-navy-200"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex-[2] bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] shadow-xl transition-all flex items-center justify-center"
            >
              {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
              {isSaving ? 'Processando...' : 'Cadastrar Operador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
