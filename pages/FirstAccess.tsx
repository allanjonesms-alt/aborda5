
import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
import TacticalLogo from '../components/TacticalLogo';

interface FirstAccessProps {
  user: User;
  onPasswordChanged: (updatedUser: User) => void;
}

const FirstAccess: React.FC<FirstAccessProps> = ({ user, onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = (pass: string) => {
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const minLength = pass.length >= 8;
    return { hasUpper, hasLower, hasNumber, minLength };
  };

  const status = validatePassword(newPassword);
  const isValid = status.hasUpper && status.hasLower && status.hasNumber && status.minLength && newPassword !== '' && newPassword === confirmPassword;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSaving) return;

    setIsSaving(true);
    setError('');

    try {
      if (!user.id) throw new Error("ID do usuário não identificado na sessão.");

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { 
        senha: newPassword,
        primeiro_acesso: true 
      });

      setIsSuccess(true);
      
      setTimeout(() => {
        const updatedUser: User = { 
          ...user, 
          primeiro_acesso: true, 
          senha: newPassword 
        };
        onPasswordChanged(updatedUser);
      }, 1500);
      
    } catch (err: any) {
      console.error('Erro de Sincronização:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
      setError('FALHA OPERACIONAL: ' + (err.message || 'Erro de rede ou permissão.'));
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-navy-100 rounded-[40px] shadow-2xl overflow-hidden">
        <div className="bg-navy-600 p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-20 rotate-12 scale-150">
             <TacticalLogo className="w-[300px] h-[300px]" />
          </div>
          <div className="relative z-10">
            <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20 backdrop-blur-md overflow-hidden">
              <TacticalLogo size="lg" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Troca de Senha</h2>
            <p className="text-navy-100 text-[10px] font-black uppercase tracking-widest mt-2">Ativação de Terminal</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="p-8 space-y-8">
          {isSuccess ? (
            <div className="py-12 text-center space-y-6">
               <div className="w-20 h-20 bg-green-600/20 rounded-full flex items-center justify-center mx-auto border border-green-500/30 animate-bounce">
                  <i className="fas fa-check text-green-500 text-3xl"></i>
               </div>
               <h3 className="text-white font-black uppercase tracking-widest text-lg">Sincronizado</h3>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <p className="text-navy-400 text-[11px] font-bold uppercase tracking-tight">Primeiro acesso ou reset detectado.</p>
                <p className="text-navy-500 text-[9px] font-black uppercase tracking-widest">Matrícula: {user.matricula}</p>
              </div>

              <div className="space-y-5">
                <input 
                  type="password"
                  className="w-full bg-gray-50 border border-navy-100 text-navy-950 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-navy-500 outline-none"
                  placeholder="Nova Senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <input 
                  type="password"
                  className="w-full bg-gray-50 border border-navy-100 text-navy-950 px-5 py-4 rounded-2xl focus:ring-2 focus:ring-navy-500 outline-none"
                  placeholder="Confirmar Nova Senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="bg-gray-50 p-5 rounded-3xl border border-navy-100 grid grid-cols-2 gap-y-3 gap-x-4">
                <RequirementItem label="8+ Caracteres" met={status.minLength} />
                <RequirementItem label="Maiúsculas" met={status.hasUpper} />
                <RequirementItem label="Minúsculas" met={status.hasLower} />
                <RequirementItem label="Números" met={status.hasNumber} />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-500 text-[10px] font-black uppercase text-center">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={!isValid || isSaving}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                  isValid ? 'bg-navy-600 hover:bg-navy-500 text-white shadow-lg' : 'bg-gray-100 text-navy-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'Gravando...' : 'Confirmar e Entrar'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

const RequirementItem: React.FC<{ label: string; met: boolean }> = ({ label, met }) => (
  <div className="flex items-center space-x-2">
    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${met ? 'bg-navy-600 text-white' : 'bg-gray-200 text-navy-400'}`}>
      <i className={`fas ${met ? 'fa-check' : 'fa-circle'}`}></i>
    </div>
    <span className={`text-[9px] font-bold uppercase tracking-tight ${met ? 'text-navy-600' : 'text-navy-400'}`}>{label}</span>
  </div>
);

export default FirstAccess;
