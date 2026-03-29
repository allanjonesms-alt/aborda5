
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { User, UserRole } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import AddUserModal from '../components/AddUserModal';

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
  const [isImporting, setIsImporting] = useState(false);

  const importIndividuals = async () => {
    console.log('Iniciando importação de indivíduos...');
    setIsImporting(true);
    const individualsToImport = [
      { id: "4aa46513-fcd7-4d0d-af99-29f5785fbbfc", nome: "LUCAS RODRIGUES MACHADO", data_nascimento: "2000-09-03", documento: "061.331.711-46", endereco: "R. Projetada A - Jardim Vaticano, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", faccao: "PCC", mae: "ANA RODRIGUES GOUVEIA" },
      { id: "ecac965c-ff1d-43cd-bf2a-e7290c372226", nome: "ELIVELTON DE MELO", data_nascimento: "2000-02-17", documento: "074.365.181-27", alcunha: "ZOI DE GATO / EXTERMINADOR", endereco: "R. Ceará - Jardim Semiramis, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", faccao: "PCC", mae: "SANDRA APARECIDA DE MELO" },
      { id: "71277d24-dd65-45aa-a0b4-fcc86ab983ab", nome: "VINICIUS ARCE DA SILVA", data_nascimento: "1999-07-08", documento: "074.479.741-10", endereco: "R. Araguainha - Vila Rosa Mourao, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", mae: "LEONORA OLMEDO ARCE" },
      { id: "857e20ea-e98d-46ea-86cf-6def60b60ca1", nome: "RICHARD MATEUS FERNANDES REIS", data_nascimento: "2006-10-23", documento: "076.481.241-65", endereco: "R. Américo de Souza Brito, 124 - Jardim Jose Antonio, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", mae: "JUCELIA MATEUS DA FONSECA SANTOS" },
      { id: "02623eb7-bb8e-471b-8c3b-c0aa8d857fc9", nome: "JOAO PEDRO MOREL VERA", data_nascimento: "2010-06-27", documento: "083.261.451-30", endereco: "R. A, 51 - Rio Verde de Mato Grosso, MS, 79480-000, Brasil", mae: "MARIA HELENA MOREL" },
      { id: "8c57f9bb-d7a1-477b-b25a-a7073c80d44f", nome: "DAVID AUGUSTO GOULART ESCOBAR", data_nascimento: "2005-12-22", documento: "067.356.271-99", endereco: "R. Mal. Rondon, 311 - Nova Rio Verde, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", faccao: "PCC", mae: "ELAINE GOULART ESCOBAR" },
      { id: "5eaf1ca9-670c-40eb-8747-a96c288e970b", nome: "SAVIO DE BRITO ESPINOZA", data_nascimento: "2004-11-16", documento: "110.603.461-92", endereco: "R. Tete Espíndola, 40 - Rio Verde de Mato Grosso, MS, 79480-000, Brasil", mae: "LUCIARA IZABEL DUARTE DE BRITO" },
      { id: "c8556ddb-1d9f-4431-918d-0234a0570a66", nome: "FELIPE VITORINO DA SILVA", data_nascimento: "2009-02-24", documento: "074.876.321-05", endereco: "R. Ovídio Marçal Júnior, 20 - Santa Terezinha, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", faccao: "PCC", mae: "MARIA DA CONCEICAO SILVA" },
      { id: "f53b6aee-5915-46f7-a001-83e1e263e8ee", nome: "ISAQUE FERNANDO DE SOUZA TENORIO", data_nascimento: "2005-10-15", documento: "087.253.961-02", endereco: "R. Central - Novo Horizonte, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", faccao: "PCC", mae: "VALDEVINA LEMES DE SOUZA" },
      { id: "31ebb3f0-b6e3-4d03-97f4-378e4399b186", nome: "WERICK MAIA MACEDO", data_nascimento: "2006-06-04", documento: "072.541.941-56", endereco: "Sócrates Brasileiro - Jardim Alvorada, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", mae: "MARTA CRISTINA PEREIRA MAIA" },
      { id: "6cc7905d-5bd8-4b6c-ae6b-a20f92e8bbfa", nome: "LUCAS PEREIRA MAIA ORTIZ", data_nascimento: "2003-04-01", documento: "073.718.931-23", endereco: "R. Joaquim Murtinho - Nova Rio Verde, Rio Verde de Mato Grosso - MS, 79480-000, Brasil", mae: "MARTA CRISTINA PEREIRA ORTIZ" }
    ];

    try {
      const batch = writeBatch(db);
      individualsToImport.forEach(ind => {
        const indRef = doc(db, 'individuals', ind.id);
        batch.set(indRef, { ...ind, created_at: serverTimestamp(), updated_at: serverTimestamp() });
      });
      await batch.commit();
      
      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'IMPORT_INDIVIDUALS',
        `Importação de ${individualsToImport.length} indivíduos realizada.`,
        { count: individualsToImport.length }
      );

      console.log('Importação concluída com sucesso!');
      fetchUsers();
    } catch (err: any) {
      console.error('Erro na importação:', err);
    } finally {
      setIsImporting(false);
    }
  };

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
              onClick={() => navigate('/logs')}
              className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg relative overflow-hidden group hover:border-navy-600 transition-all text-left"
            >
              <div className="w-12 h-12 bg-navy-50 rounded-xl flex items-center justify-center border border-navy-100 group-hover:border-navy-600/50 transition-colors mb-4">
                <i className="fas fa-list-check text-navy-600 text-xl"></i>
              </div>
              <h4 className="text-navy-950 font-black uppercase text-sm">Auditoria / Logs</h4>
              <p className="text-navy-400 text-[10px] font-bold mt-1">Verificar histórico de ações.</p>
            </button>
        </div>
      </section>
    </div>
  );
};

export default Settings;
