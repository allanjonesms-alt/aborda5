
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp, limit } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import TacticalLogo from '../components/TacticalLogo';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUsersEmpty, setIsUsersEmpty] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Helper to normalize user data from Firestore
  const normalizeUser = (id: string, data: any): User => {
    const rawVal = data.primeiro_acesso;
    const normalizedPrimeiroAcesso = (
      rawVal === true || 
      rawVal === 'true' || 
      rawVal === 'TRUE' || 
      rawVal === 't' || 
      rawVal === 'T' || 
      rawVal === 1 ||
      rawVal === '1'
    );

    const rawRole = String(data.role || '').toUpperCase();
    const role = rawRole === 'ADMIN' ? UserRole.ADMIN : UserRole.OPERATOR;

    return {
      id: id,
      matricula: data.matricula || 'N/A',
      nome: data.nome || 'Operador',
      senha: data.senha || '',
      role: role,
      primeiro_acesso: normalizedPrimeiroAcesso
    };
  };

  // Verificar se existem usuários no sistema
  React.useEffect(() => {
    const checkUsers = async () => {
      try {
        await signInAnonymously(auth);
        // Consulta limitada a 1 para checar existência
        const q = query(collection(db, 'users'), limit(1));
        const querySnapshot = await getDocs(q);
        setIsUsersEmpty(querySnapshot.empty);
      } catch (err) {
        console.error("Erro ao verificar usuários (provavelmente banco vazio):", err);
        // Em caso de erro em banco novo, mostramos o botão por segurança
        setIsUsersEmpty(true);
      }
    };
    checkUsers();
  }, []);

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      
      const uid = auth.currentUser!.uid;
      await setDoc(doc(db, 'users', uid), {
        matricula: 'admin',
        senha: 'admin123',
        nome: 'Administrador do Sistema',
        role: 'ADMIN',
        primeiro_acesso: false,
        ord: 1,
        created_at: serverTimestamp()
      });
      setIsUsersEmpty(false);
      alert('Primeiro administrador criado com sucesso!\nMatrícula: admin\nSenha: admin123');
    } catch (err: any) {
      console.error("Erro no bootstrap:", err);
      alert('Falha ao criar administrador inicial: ' + err.message);
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // First, sign in anonymously to satisfy security rules
      await signInAnonymously(auth);

      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('matricula', '==', matricula.trim()), 
        where('senha', '==', senha.trim())
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError('Matrícula ou senha incorretos.');
      } else {
        const data = querySnapshot.docs[0].data();
        const id = querySnapshot.docs[0].id;
        onLogin(normalizeUser(id, data));
      }
    } catch (err: any) {
      console.error('Erro de Autenticação:', err);
      handleFirestoreError(err, OperationType.LIST, 'users');
      setError('Falha na comunicação com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white border border-navy-100 p-8 rounded-[2.5rem] shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center mb-10">
            <TacticalLogo size="xl" className="mb-6 rotate-3" />
            <h1 className="text-4xl font-black text-navy-950 tracking-tighter">SGA5</h1>
            <p className="text-navy-400 mt-2 font-black uppercase text-[10px] tracking-[0.2em] text-center">Sistema de Gerenciamento de Abordagem do 5° BPM</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest ml-2">
                Matrícula
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
                  <i className="fas fa-id-card"></i>
                </span>
                <input
                  type="text"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="w-full bg-white border border-navy-200 text-navy-950 pl-12 pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-navy-500 outline-none transition-all font-bold"
                  placeholder="ID Operacional"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest ml-2">
                Senha
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-400">
                  <i className="fas fa-lock"></i>
                </span>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full bg-white border border-navy-200 text-navy-950 pl-12 pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-navy-500 outline-none transition-all font-bold"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-3">
                <i className="fas fa-exclamation-triangle"></i>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-navy-600 hover:bg-navy-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-navy-600/30 transition-all transform active:scale-95 flex items-center justify-center uppercase tracking-[0.2em] text-xs"
            >
              {isLoading ? (
                <i className="fas fa-spinner fa-spin mr-2"></i>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt mr-3"></i>
                  Acessar Sistema
                </>
              )}
            </button>
          </form>

          {isUsersEmpty && (
            <div className="mt-8 p-6 border border-navy-100 border-dashed rounded-3xl bg-gray-50 text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest">Nenhum operador detectado no sistema.</p>
              <button
                onClick={handleBootstrap}
                disabled={isBootstrapping}
                className="w-full bg-white border border-navy-200 hover:border-navy-500 text-navy-900 py-4 rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isBootstrapping ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-rocket text-navy-500"></i>}
                Configurar Primeiro Acesso
              </button>
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-navy-300 text-[9px] font-black uppercase tracking-[0.4em]">
              SGA5 V1.0 • CREATED BY ALLAN JONES
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
