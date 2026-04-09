
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { User, UserRole } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import AddUserModal from '../components/AddUserModal';
import ManageUnitsModal from '../components/ManageUnitsModal';
import TacticalAlert from '../components/TacticalAlert';

interface SettingsProps {
  user: User | null;
}

const Settings: React.FC<SettingsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para Modais
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagingUnits, setIsManagingUnits] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

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
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.MASTER) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="bg-red-50 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-6xl"></i></div>
        <h2 className="text-3xl font-black text-navy-950 mb-4">Acesso Restrito</h2>
        <p className="text-navy-400 uppercase font-black text-xs tracking-widest">Apenas Administradores podem acessar este terminal.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-10">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-600 p-3 rounded-2xl shadow-xl">
            <i className="fas fa-cog text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Configurações</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Preferências do Sistema</p>
          </div>
        </div>
      </div>

      <section className="px-4 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button 
              onClick={() => navigate('/operadores')}
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group hover:border-navy-600 transition-all text-left"
            >
              <div className="w-12 h-12 bg-navy-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-navy-600/50 transition-colors mb-4">
                <i className="fas fa-users-gear text-navy-600 text-xl"></i>
              </div>
              <h4 className="text-navy-950 font-black uppercase text-sm">Gerenciar Operadores</h4>
              <p className="text-navy-400 text-[10px] font-bold mt-1">Adicionar, editar e resetar senhas.</p>
            </button>

            <button 
              onClick={() => navigate('/importar-relatorios')}
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group hover:border-navy-600 transition-all text-left"
            >
              <div className="w-12 h-12 bg-navy-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-navy-600/50 transition-colors mb-4">
                <i className="fas fa-file-pdf text-navy-600 text-xl"></i>
              </div>
              <h4 className="text-navy-950 font-black uppercase text-sm">Importar Relatórios</h4>
              <p className="text-navy-400 text-[10px] font-bold mt-1">Extrair dados de arquivos PDF.</p>
            </button>

            <button 
              onClick={() => navigate('/logs')}
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group hover:border-navy-600 transition-all text-left"
            >
              <div className="w-12 h-12 bg-navy-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-navy-600/50 transition-colors mb-4">
                <i className="fas fa-list-check text-navy-600 text-xl"></i>
              </div>
              <h4 className="text-navy-950 font-black uppercase text-sm">Auditoria / Logs</h4>
              <p className="text-navy-400 text-[10px] font-bold mt-1">Verificar histórico de ações.</p>
            </button>

            <button 
              onClick={() => setIsManagingUnits(true)}
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group hover:border-navy-600 transition-all text-left"
            >
              <div className="w-12 h-12 bg-navy-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-navy-600/50 transition-colors mb-4">
                <i className="fas fa-building text-navy-600 text-xl"></i>
              </div>
              <h4 className="text-navy-950 font-black uppercase text-sm">Gerenciar Unidades</h4>
              <p className="text-navy-400 text-[10px] font-bold mt-1">Adicionar e remover unidades do sistema.</p>
            </button>

            <button 
              onClick={() => navigate('/versoes')}
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group hover:border-navy-600 transition-all text-left"
            >
              <div className="w-12 h-12 bg-navy-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-navy-600/50 transition-colors mb-4">
                <i className="fas fa-code-branch text-navy-600 text-xl"></i>
              </div>
              <h4 className="text-navy-950 font-black uppercase text-sm">Versão</h4>
              <p className="text-navy-400 text-[10px] font-bold mt-1">Cadastrar nova versão do sistema.</p>
            </button>
        </div>
      </section>

      {alertMessage && (
        <TacticalAlert 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}

      {isManagingUnits && (
        <ManageUnitsModal 
          onClose={() => setIsManagingUnits(false)} 
          user={user}
        />
      )}
    </div>
  );
};

export default Settings;
