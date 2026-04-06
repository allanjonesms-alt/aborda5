import React, { useState, useEffect, useCallback } from 'react';
import { Siren } from 'lucide-react';
import { User, UserRole } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import AddUserModal from '../components/AddUserModal';

interface OperatorsProps {
  user: User | null;
}

const Operators: React.FC<OperatorsProps> = ({ user }) => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
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
      setHasChanges(false);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      handleFirestoreError(err, OperationType.LIST, 'users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  const handleMove = (index: number, direction: 'up' | 'down', unit: string) => {
    const unitUsers = usersList.filter(u => (u.unidade || 'SEM UNIDADE') === unit);
    const globalIndex = usersList.findIndex(u => u.id === unitUsers[index].id);
    
    if (direction === 'up' && index > 0) {
      const prevInUnit = unitUsers[index - 1];
      const prevGlobalIndex = usersList.findIndex(u => u.id === prevInUnit.id);
      
      const newList = [...usersList];
      const tempOrd = newList[globalIndex].ord;
      newList[globalIndex].ord = newList[prevGlobalIndex].ord;
      newList[prevGlobalIndex].ord = tempOrd;
      
      // Sort by ord to maintain consistency
      newList.sort((a, b) => (a.ord || 0) - (b.ord || 0));
      setUsersList(newList);
      setHasChanges(true);
    } else if (direction === 'down' && index < unitUsers.length - 1) {
      const nextInUnit = unitUsers[index + 1];
      const nextGlobalIndex = usersList.findIndex(u => u.id === nextInUnit.id);
      
      const newList = [...usersList];
      const tempOrd = newList[globalIndex].ord;
      newList[globalIndex].ord = newList[nextGlobalIndex].ord;
      newList[nextGlobalIndex].ord = tempOrd;
      
      // Sort by ord to maintain consistency
      newList.sort((a, b) => (a.ord || 0) - (b.ord || 0));
      setUsersList(newList);
      setHasChanges(true);
    }
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const batch = writeBatch(db);
      usersList.forEach(u => {
        const userRef = doc(db, 'users', u.id);
        batch.update(userRef, { ord: u.ord });
      });
      await batch.commit();
      
      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USERS_REORDERED',
        'Ordenação de operadores atualizada globalmente.',
        {}
      );
      
      setHasChanges(false);
      alert('Ordenação salva com sucesso!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'users/reorder');
      alert('Erro ao salvar ordenação: ' + err.message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.MASTER) {
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

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_PASSWORD_RESET',
        `Senha do operador ${targetUser.nome} (MAT: ${targetUser.matricula}) resetada pelo administrador.`,
        { targetUserId: targetUser.id }
      );

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

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_EDITED',
        `Dados do operador ${editingUser.nome} (MAT: ${editingUser.matricula}) atualizados.`,
        { targetUserId: editingUser.id }
      );

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

  // Group by unit
  const groupedUsers = filteredUsers.reduce((acc, u) => {
    const unit = u.unidade || 'SEM UNIDADE';
    if (!acc[unit]) acc[unit] = [];
    acc[unit].push(u);
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-600 p-3 rounded-2xl shadow-xl">
            <i className="fas fa-users-gear text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Gerenciamento de Operadores</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Lista de Operadores e Administradores</p>
          </div>
        </div>

        <div className="flex gap-4">
            {hasChanges && (
              <button 
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="bg-forest-600 hover:bg-forest-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isSavingOrder ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                Salvar Ordenação
              </button>
            )}
            <button 
              onClick={() => setIsAddingUser(true)}
              className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <i className="fas fa-user-plus"></i> Novo Operador
            </button>
        </div>
      </div>

      <section className="px-4 pb-10 space-y-12">
        {isLoading ? (
          <div className="py-20 text-center">
            <Siren className="w-8 h-8 text-navy-600 mb-4 animate-pulse mx-auto" />
            <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">CARREGANDO DADOS...</p>
          </div>
        ) : Object.entries(groupedUsers).map(([unit, users]) => (
          <div key={unit} className="space-y-6">
            <div className="flex items-center gap-4 border-l-4 border-navy-600 pl-4">
              <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">{unit}</h3>
              <span className="bg-navy-100 text-navy-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">
                {users.length} Operadores
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((u, idx) => (
                <div key={u.id} className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                    <div className="flex flex-col gap-1 mr-2">
                      <button 
                        onClick={() => handleMove(idx, 'up', unit)}
                        disabled={idx === 0}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${idx === 0 ? 'bg-gray-50 text-gray-300' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}
                      >
                        <i className="fas fa-chevron-up text-[10px]"></i>
                      </button>
                      <button 
                        onClick={() => handleMove(idx, 'down', unit)}
                        disabled={idx === users.length - 1}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${idx === users.length - 1 ? 'bg-gray-50 text-gray-300' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}
                      >
                        <i className="fas fa-chevron-down text-[10px]"></i>
                      </button>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${u.role === UserRole.ADMIN ? 'bg-red-50 text-red-600 border border-red-100' : u.role === UserRole.MASTER ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-gray-100 text-navy-600 border border-navy-100'}`}>
                      {u.role}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 mb-6">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-forest-600/50 transition-colors">
                      <i className={`fas ${u.role === UserRole.ADMIN ? 'fa-user-shield' : u.role === UserRole.MASTER ? 'fa-crown' : 'fa-user'} text-navy-400 text-xl`}></i>
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
          </div>
        ))}
      </section>

      {isAddingUser && (
        <AddUserModal 
          onClose={() => setIsAddingUser(false)} 
          onSave={() => { fetchUsers(); setIsAddingUser(false); }} 
          currentUser={user}
        />
      )}

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
                  <option value={UserRole.MASTER}>MASTER</option>
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

export default Operators;
