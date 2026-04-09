import React, { useState, useEffect, useCallback } from 'react';
import { Siren } from 'lucide-react';
import { User, UserRole, Unit } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import TacticalAlert from '../components/TacticalAlert';
import { collection, query, orderBy, getDocs, doc, updateDoc, serverTimestamp, writeBatch, deleteDoc, onSnapshot } from 'firebase/firestore';
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
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isMaster = user?.role === UserRole.MASTER;
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'units'), orderBy('nome', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Unit));
      // Ensure FORÇA TÁTICA is always available in the list
      if (!data.some(u => u.nome === 'FORÇA TÁTICA')) {
        data.push({ id: 'ft-default', nome: 'FORÇA TÁTICA' } as Unit);
        data.sort((a, b) => a.nome.localeCompare(b.nome));
      }
      setUnits(data);
    });
    return () => unsubscribe();
  }, []);

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
      setAlertMessage('Ordenação salva com sucesso!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'users/reorder');
      setAlertMessage('Erro ao salvar ordenação: ' + err.message);
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

  const handleDeleteUser = async () => {
    if (!isMaster || !userToDelete) return;
    setIsSaving(true);

    try {
      const targetUser = userToDelete;
      const userRef = doc(db, 'users', targetUser.id);
      await deleteDoc(userRef);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_DELETED',
        `Operador ${targetUser.nome} (MAT: ${targetUser.matricula}) excluído permanentemente pelo MASTER.`,
        { targetUserId: targetUser.id }
      );

      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userToDelete.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (targetUser: User) => {
    if (!isMaster) return;
    const defaultPassword = '@Senha123';
    
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, { 
        senha: defaultPassword, 
        primeiro_acesso: true 
      });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'USER_PASSWORD_RESET',
        `Senha do operador ${targetUser.nome} (MAT: ${targetUser.matricula}) resetada para o padrão pelo administrador.`,
        { targetUserId: targetUser.id }
      );

      if (editingUser?.id === targetUser.id) {
        setEditingUser({ ...editingUser, senha: defaultPassword, primeiro_acesso: true });
      }
      
      setAlertMessage('Senha resetada para @Senha123 com sucesso!');
      fetchUsers();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.id}`);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !isMaster) return;
    setIsSaving(true);

    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        nome: editingUser.nome,
        matricula: editingUser.matricula,
        role: editingUser.role,
        ord: editingUser.ord,
        unidade: editingUser.unidade || '',
        unidades_extras: editingUser.unidades_extras || []
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
      setAlertMessage('Erro ao atualizar: ' + err.message);
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
      {alertMessage && (
        <TacticalAlert 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}
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
            {hasChanges && isMaster && (
              <button 
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="bg-forest-600 hover:bg-forest-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isSavingOrder ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                Salvar Ordenação
              </button>
            )}
            {isMaster && (
              <button 
                onClick={() => setIsAddingUser(true)}
                className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <i className="fas fa-user-plus"></i> Novo Operador
              </button>
            )}
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {users.map((u, idx) => (
                <div key={u.id} className="bg-white border border-navy-100 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 p-3">
                    {isMaster && (
                      <div className="flex flex-col gap-0.5">
                        <button 
                          onClick={() => handleMove(idx, 'up', unit)}
                          disabled={idx === 0}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${idx === 0 ? 'bg-gray-50 text-gray-200' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}
                        >
                          <i className="fas fa-chevron-up text-[8px]"></i>
                        </button>
                        <button 
                          onClick={() => handleMove(idx, 'down', unit)}
                          disabled={idx === users.length - 1}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${idx === users.length - 1 ? 'bg-gray-50 text-gray-200' : 'bg-navy-50 text-navy-600 hover:bg-navy-100'}`}
                        >
                          <i className="fas fa-chevron-down text-[8px]"></i>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
                      u.role === UserRole.MASTER ? 'bg-purple-50 border-purple-100 text-purple-600' :
                      u.role === UserRole.ADMIN ? 'bg-red-50 border-red-100 text-red-600' :
                      'bg-navy-50 border-navy-100 text-navy-600'
                    }`}>
                      <i className={`fas ${u.role === UserRole.ADMIN ? 'fa-user-shield' : u.role === UserRole.MASTER ? 'fa-crown' : 'fa-user'} text-lg`}></i>
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-navy-950 font-black uppercase text-xs truncate">{u.nome}</h4>
                      <p className="text-navy-400 text-[8px] font-bold">MAT: {u.matricula} • ORD: {u.ord || 0}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${!u.primeiro_acesso ? 'bg-forest-600' : 'bg-yellow-500'}`}></div>
                      <span className="text-[8px] font-black uppercase text-navy-400 tracking-widest">
                        {!u.primeiro_acesso ? 'Acesso Liberado' : 'Senha Pendente'}
                      </span>
                    </div>

                    {isMaster && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="w-8 h-8 bg-navy-50 hover:bg-navy-100 text-navy-600 rounded-lg flex items-center justify-center transition-all border border-navy-100"
                          title="Editar"
                        >
                          <i className="fas fa-pencil-alt text-[10px]"></i>
                        </button>
                        <button 
                          onClick={() => setUserToDelete(u)}
                          className="w-8 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg flex items-center justify-center transition-all border border-red-100"
                          title="Excluir"
                        >
                          <i className="fas fa-trash-alt text-[10px]"></i>
                        </button>
                      </div>
                    )}
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
          <div className="bg-white border border-navy-100 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-navy-600 p-4 border-b border-navy-500 flex justify-between items-center">
              <h3 className="text-white font-black uppercase tracking-tighter">Editar Operador</h3>
              <button onClick={() => setEditingUser(null)} className="text-navy-400 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    value={editingUser.nome} 
                    onChange={e => setEditingUser({...editingUser, nome: e.target.value})}
                    className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none"
                  />
                </div>

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

                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Unidade Principal</label>
                  <select 
                    value={editingUser.unidade || ''} 
                    onChange={e => setEditingUser({...editingUser, unidade: e.target.value})}
                    className="w-full bg-gray-50 border border-navy-100 rounded-xl p-4 text-navy-950 font-bold focus:ring-2 focus:ring-navy-500 outline-none appearance-none"
                  >
                    <option value="">Selecione a Unidade</option>
                    {units.map(unit => (
                      <option key={unit.id} value={unit.nome}>{unit.nome}</option>
                    ))}
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
              </div>

              {(editingUser.role === UserRole.ADMIN || editingUser.role === UserRole.MASTER) && (
                <div className="bg-navy-50 p-4 rounded-2xl border border-navy-100">
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-3">Unidades Adicionais de Atuação</label>
                  <div className="grid grid-cols-2 gap-2">
                    {units.filter(u => u.nome !== editingUser.unidade).map(unit => {
                      const isSelected = editingUser.unidades_extras?.includes(unit.nome);
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => {
                            const extras = editingUser.unidades_extras || [];
                            const newExtras = isSelected 
                              ? extras.filter(e => e !== unit.nome)
                              : [...extras, unit.nome];
                            setEditingUser({ ...editingUser, unidades_extras: newExtras });
                          }}
                          className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${isSelected ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-navy-400 border-navy-100 hover:border-navy-300'}`}
                        >
                          {unit.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-navy-100">
                <button 
                  type="button"
                  onClick={() => handleResetPassword(editingUser)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-3 rounded-xl uppercase text-[10px] border border-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-key"></i> Resetar Senha para @Senha123
                </button>
                <p className="text-[8px] text-navy-400 font-bold text-center mt-2 uppercase tracking-widest">O usuário deverá cadastrar nova senha no próximo acesso.</p>
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

      {userToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md">
          <div className="bg-white border-2 border-red-600 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-red-600 p-6 flex items-center gap-4">
              <i className="fas fa-exclamation-triangle text-white text-3xl animate-pulse"></i>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Confirmar Exclusão</h3>
                <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest">Esta ação é irreversível</p>
              </div>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-navy-950 text-sm font-medium leading-relaxed">
                Tem certeza que deseja excluir permanentemente o operador <span className="text-red-600 font-black">{userToDelete.nome}</span>? 
                Todos os dados de acesso e histórico deste usuário serão removidos.
              </p>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  disabled={isSaving}
                  className="flex-1 bg-navy-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest transition-all hover:bg-navy-100 border border-navy-100"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteUser}
                  disabled={isSaving}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20 transition-all"
                >
                  {isSaving ? <i className="fas fa-spinner fa-spin"></i> : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operators;
