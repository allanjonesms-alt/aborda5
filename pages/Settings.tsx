
import React, { useState, useEffect, useCallback } from 'react';
import { Siren } from 'lucide-react';
import { User, UserRole } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import AddUserModal from '../components/AddUserModal';

interface SettingsProps {
  user: User | null;
}

const Settings: React.FC<SettingsProps> = ({ user }) => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Modais
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('ord', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsersList(data);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  if (user?.role !== UserRole.ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-6xl"></i></div>
        <h2 className="text-3xl font-black text-navy-950 mb-4">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">Apenas Administradores podem acessar este terminal.</p>
      </div>
    );
  }

  const handleResetPassword = async (targetUser: User) => {
    const defaultPassword = 'Mudar@123';
    if (!confirm(`Deseja resetar a senha de ${targetUser.nome}?\nA nova senha será: ${defaultPassword}\nO usuário será obrigado a trocá-la no próximo acesso.`)) return;

    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { 
        senha: defaultPassword, 
        primeiro_acesso: false 
      });

      alert('Senha resetada com sucesso!');
      fetchUsers();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
      alert('Erro ao resetar: ' + err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);

    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        nome: editingUser.nome,
        matricula: editingUser.matricula,
        role: editingUser.role,
        ord: editingUser.ord,
        unidade: editingUser.unidade || ''
      });

      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingUser.id}`);
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = usersList.filter(u => 
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.matricula.includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-600 p-3 rounded-2xl shadow-xl">
            <i className="fas fa-user-gear text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Painel Administrativo</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Gerenciamento de Operadores e Terminal</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
           <div className="relative">
              <input 
                type="text" 
                placeholder="Filtrar por nome/ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-navy-100 text-navy-950 pl-10 pr-4 py-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-navy-500 outline-none w-full sm:w-64 shadow-sm"
              />
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-navy-300"></i>
           </div>
            <button 
              onClick={() => setIsAddingUser(true)}
              className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <i className="fas fa-user-plus"></i> Novo Operador
            </button>

        </div>
      </div>

      {/* Lista de Usuários */}
      <section className="px-4 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full py-20 text-center">
              <Siren className="w-8 h-8 text-navy-600 mb-4 animate-pulse mx-auto" />
              <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">CARREGANDO DADOS...</p>
            </div>
          ) : filteredUsers.map(u => (
            <div key={u.id} className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4">
                <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${u.role === UserRole.ADMIN ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-100 text-navy-600 border border-navy-100'}`}>
                  {u.role}
                </span>
              </div>

              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-forest-600/50 transition-colors">
                  <i className={`fas ${u.role === UserRole.ADMIN ? 'fa-user-shield' : 'fa-user'} text-navy-400 text-xl`}></i>
                </div>
                <div className="overflow-hidden">
                  <h4 className="text-navy-950 font-black uppercase text-sm truncate">{u.nome}</h4>
                  <p className="text-navy-400 text-[10px] font-bold">MAT: {u.matricula} • ORD: {u.ord || 0}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className={`w-2 h-2 rounded-full ${u.primeiro_acesso ? 'bg-forest-600' : 'bg-yellow-500'}`}></div>
                <span className="text-[9px] font-black uppercase text-navy-400 tracking-widest">
                  {u.primeiro_acesso ? 'Acesso Liberado' : 'Senha Pendente'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setEditingUser(u)}
                  className="bg-gray-50 hover:bg-gray-100 text-navy-900 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-navy-100"
                >
                  <i className="fas fa-pencil-alt text-forest-600"></i> Editar
                </button>
                <button 
                  onClick={() => handleResetPassword(u)}
                  className="bg-gray-50 hover:bg-red-50 text-navy-400 hover:text-red-500 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-navy-100 hover:border-red-100"
                >
                  <i className="fas fa-key"></i> Resetar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modal de Cadastro de Operador */}
      {isAddingUser && (
        <AddUserModal 
          onClose={() => setIsAddingUser(false)} 
          onSave={() => { fetchUsers(); setIsAddingUser(false); }} 
        />
      )}

      {/* Modal de Edição de Usuário */}
      {editingUser && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-navy-600 p-4 border-b border-navy-500 flex justify-between items-center">
              <h3 className="text-white font-black uppercase tracking-tighter">Editar Operador</h3>
              <button onClick={() => setEditingUser(null)} className="text-navy-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  value={editingUser.nome} 
                  onChange={e => setEditingUser({...editingUser, nome: e.target.value})}
                  className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Matrícula</label>
                  <input 
                    type="text" 
                    value={editingUser.matricula} 
                    onChange={e => setEditingUser({...editingUser, matricula: e.target.value})}
                    className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Ordem</label>
                  <input 
                    type="number" 
                    value={editingUser.ord || 0} 
                    onChange={e => setEditingUser({...editingUser, ord: parseInt(e.target.value) || 0})}
                    className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Unidade</label>
                <select 
                  value={editingUser.unidade || ''} 
                  onChange={e => setEditingUser({...editingUser, unidade: e.target.value})}
                  className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
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
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Cargo / Perfil</label>
                <select 
                  value={editingUser.role} 
                  onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
                >
                  <option value={UserRole.ADMIN}>ADMINISTRADOR</option>
                  <option value={UserRole.OPERATOR}>OPERADOR</option>
                </select>
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 bg-gray-100 text-navy-900 font-black py-4 rounded-xl uppercase text-[10px] border border-navy-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-[2] bg-navy-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-lg"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
