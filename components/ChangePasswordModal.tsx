
import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';

interface ChangePasswordModalProps {
  user: User | null;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (pass: string) => {
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const minLength = pass.length >= 8;
    return hasUpper && hasLower && hasNumber && minLength;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!user) {
      setError('Sessão inválida. Reinicie o sistema.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('A senha deve ter 8+ caracteres, maiúsculas, minúsculas e números.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Verifica a senha atual antes de permitir a troca
      const userRef = doc(db, 'users', user.id);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || userSnap.data().senha !== currentPassword) {
        setError('Senha atual incorreta.');
        setIsSaving(false);
        return;
      }

      // 2. Executa o update utilizando o ID como filtro único
      await updateDoc(userRef, { senha: newPassword });

      setSuccess(true);
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error('Erro na troca de senha:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
      setError('Erro operacional: ' + (err.message || 'Falha na conexão.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
      <div className="bg-white border border-navy-100 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-navy-50 p-6 border-b border-navy-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-navy-900 p-2 rounded-lg">
              <i className="fas fa-key text-white"></i>
            </div>
            <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">Alterar Senha</h3>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-navy-100 text-navy-900 rounded-full flex items-center justify-center mx-auto border border-navy-200">
                <i className="fas fa-check text-2xl"></i>
              </div>
              <p className="text-navy-950 font-black uppercase tracking-widest text-sm">Senha Atualizada!</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Senha Atual</label>
                <input 
                  type="password" 
                  className="w-full bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="h-px bg-navy-100 my-2"></div>

              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Nova Senha</label>
                <input 
                  type="password" 
                  className="w-full bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Confirmar Senha</label>
                <input 
                  type="password" 
                  className="w-full bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="bg-navy-50 p-3 rounded-lg border border-navy-100">
                <p className="text-[8px] text-navy-400 font-black uppercase tracking-widest leading-relaxed">
                  Requisitos: 8+ caracteres, 1 maiúscula, 1 minúscula e 1 número.
                </p>
              </div>

              {error && (
                <div className="bg-red-600/10 border border-red-600/30 p-3 rounded-lg flex items-center gap-3 text-red-600 text-xs font-bold uppercase">
                  <i className="fas fa-exclamation-triangle"></i>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="flex-1 bg-navy-100 hover:bg-navy-200 text-navy-900 font-black py-4 rounded-xl uppercase text-[10px] transition-all border border-navy-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-[2] bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-lg transition-all flex items-center justify-center"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                  {isSaving ? 'Gravando...' : 'Confirmar Troca'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
