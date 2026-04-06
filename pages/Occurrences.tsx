
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, FileSearch, X, Search, Plus, UserPlus, Trash2, CheckCircle2, FileDigit } from 'lucide-react';
import { User, UserRole, OccurrenceSS, OccurrenceRO } from '../types';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import TacticalAlert from '../components/TacticalAlert';

interface OccurrencesProps {
  user: User | null;
}

const Occurrences: React.FC<OccurrencesProps> = ({ user }) => {
  const [showSSModal, setShowSSModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // SS Form State
  const [nrSS, setNrSS] = useState('');
  const [tipoSS, setTipoSS] = useState<'Rondas' | 'Policiamento em evento' | 'Policiamento Medidas Protetivas' | 'Atendimento de Chamada'>('Rondas');
  const [guServico, setGuServico] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);

  // RO Form State
  const [nrRO, setNrRO] = useState('');
  const [fato, setFato] = useState('AMEAÇA');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('nome', 'asc'));
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setAllUsers(users);
      } catch (err) {
        console.error('Erro ao buscar usuários:', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (userSearch.trim() === '') {
      setFilteredUsers([]);
    } else {
      const filtered = allUsers.filter(u => 
        u.nome.toLowerCase().includes(userSearch.toLowerCase()) && 
        !guServico.includes(u.nome)
      );
      setFilteredUsers(filtered);
    }
  }, [userSearch, allUsers, guServico]);

  const handleAddOperator = (name: string) => {
    setGuServico([...guServico, name]);
    setUserSearch('');
  };

  const handleRemoveOperator = (name: string) => {
    setGuServico(guServico.filter(n => n !== name));
  };

  const handleSubmitSS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (nrSS.length !== 10 || !/^\d+$/.test(nrSS)) {
      setAlertMessage('O número da SS deve conter exatamente 10 algarismos numéricos.');
      return;
    }
    if (guServico.length === 0) {
      setAlertMessage('Adicione pelo menos um operador à GU de Serviço.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docData: Omit<OccurrenceSS, 'id'> = {
        nr_ss: nrSS,
        tipo_ss: tipoSS,
        gu_servico: guServico,
        unidade: user.unidade,
        criado_por: user.nome,
        created_at: new Date().toISOString()
      };
      await addDoc(collection(db, 'occurrences_ss'), docData);
      await logAction(user.id, user.nome, 'CREATE_SS', `Criou SS Nr: ${nrSS}`);
      setAlertMessage('SS registrada com sucesso!');
      setShowSSModal(false);
      setNrSS('');
      setGuServico([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'occurrences_ss');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {alertMessage && (
        <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}

      <div className="mb-10 animate-fade-in">
        <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Ocorrências</h2>
        <p className="text-navy-500 mt-1 uppercase text-xs font-bold tracking-widest">SS e RO Realizados</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <button 
          onClick={() => navigate('/lista-ss')}
          className="group bg-white border border-navy-100 p-8 rounded-3xl shadow-sm hover:shadow-2xl hover:border-navy-300 transition-all flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-navy-600 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform shadow-lg">
            <FileText size={40} className="text-white" />
          </div>
          <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight mb-2">SS</h3>
          <p className="text-navy-500 text-sm leading-relaxed">Registrar e listar Solicitações de Serviço.</p>
        </button>

        <button 
          onClick={() => navigate('/lista-ro')}
          className="group bg-white border border-navy-100 p-8 rounded-3xl shadow-sm hover:shadow-2xl hover:border-navy-300 transition-all flex flex-col items-center text-center"
        >
          <div className="w-20 h-20 bg-red-700 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform shadow-lg">
            <FileDigit size={40} className="text-white" />
          </div>
          <h3 className="text-2xl font-black text-navy-950 uppercase tracking-tight mb-2">R.O</h3>
          <p className="text-navy-500 text-sm leading-relaxed">Registrar e listar Relatórios de Ocorrência.</p>
        </button>
      </div>

      {/* RO Modal */}
      {/* RO Modal removed */}
    </div>
  );
};

export default Occurrences;
