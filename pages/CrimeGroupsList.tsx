
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { CrimeGroup, CrimeType, User, UserRole } from '../types';
import { Network, Plus, Search, MapPin, Filter, AlertCircle } from 'lucide-react';

interface CrimeGroupsListProps {
  user: User | null;
}

const CrimeGroupsList: React.FC<CrimeGroupsListProps> = ({ user }) => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<CrimeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('todos');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  const [newGroup, setNewGroup] = useState({
    nome: '',
    cidade: '',
    tipo: CrimeType.DRUGS
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const q = query(collection(db, 'crime_groups'), orderBy('nome', 'asc'));
      const querySnapshot = await getDocs(q);
      const groupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrimeGroup));
      setGroups(groupsData);
    } catch (err) {
      console.error("Erro ao buscar grupos criminosos:", err);
      handleFirestoreError(err, OperationType.LIST, 'crime_groups');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.nome || !newGroup.cidade) return;

    try {
      const docRef = await addDoc(collection(db, 'crime_groups'), {
        ...newGroup,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      setIsModalOpen(false);
      setNewGroup({ nome: '', cidade: '', tipo: CrimeType.DRUGS });
      fetchGroups();
      navigate(`/organograma/${docRef.id}`);
    } catch (err) {
      console.error("Erro ao adicionar grupo:", err);
      handleFirestoreError(err, OperationType.WRITE, 'crime_groups');
    }
  };

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          group.cidade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'todos' || group.tipo === selectedType;
    return matchesSearch && matchesType;
  });

  if (!isDesktop) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-amber-50 border border-amber-100 p-8 rounded-3xl max-w-md">
          <AlertCircle className="text-amber-500 w-16 h-16 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter mb-4">Acesso Restrito</h2>
          <p className="text-navy-400 text-sm font-bold uppercase leading-relaxed">
            O Organograma do Crime está disponível apenas para visualização em computadores (Desktop) para garantir a melhor experiência e clareza das informações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-navy-950 uppercase tracking-tighter flex items-center gap-3">
            <Network className="text-navy-600" size={32} />
            Organograma do Crime
          </h1>
          <p className="text-navy-400 text-sm font-bold uppercase tracking-widest mt-1">Gestão de Estrutura de Facções</p>
        </div>
        
        {user?.role === UserRole.MASTER && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-navy-900 hover:bg-navy-800 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all shadow-xl shadow-navy-900/20 flex items-center gap-2 active:scale-95"
          >
            <Plus size={16} /> Novo Grupo
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-navy-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou cidade..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-12 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-300" size={20} />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-navy-400" />
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-navy-50 border border-navy-100 rounded-2xl px-6 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
            >
              <option value="todos">Todos os Tipos</option>
              <option value={CrimeType.DRUGS}>Drogas</option>
              <option value={CrimeType.WEAPONS}>Armas</option>
              <option value={CrimeType.ROBBERY}>Roubos</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-navy-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGroups.map(group => (
              <button 
                key={group.id}
                onClick={() => navigate(`/organograma/${group.id}`)}
                className="group p-6 bg-white border border-navy-50 rounded-[2rem] hover:border-navy-200 hover:shadow-xl transition-all text-left relative overflow-hidden"
              >
                <div className={`absolute top-0 right-0 px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-xl ${
                  group.tipo === CrimeType.DRUGS ? 'bg-forest-100 text-forest-700' :
                  group.tipo === CrimeType.WEAPONS ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {group.tipo}
                </div>

                <div className="space-y-4">
                  <div className="bg-navy-50 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:bg-navy-900 group-hover:text-white transition-colors">
                    <Network size={24} />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-black text-navy-950 uppercase tracking-tighter leading-tight">{group.nome}</h3>
                    <div className="flex items-center gap-1 mt-1 text-navy-400">
                      <MapPin size={12} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{group.cidade}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex items-center justify-between">
                    <span className="text-[9px] font-black text-navy-300 uppercase tracking-tighter">Clique para ver organograma</span>
                    <div className="w-8 h-8 rounded-full bg-navy-50 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                      <Plus size={16} className="text-navy-400" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && filteredGroups.length === 0 && (
          <div className="text-center py-20 bg-navy-50 rounded-[2.5rem] border border-dashed border-navy-200">
            <Network className="text-navy-200 w-16 h-16 mx-auto mb-4" />
            <p className="text-navy-400 font-bold uppercase text-xs tracking-widest">Nenhum grupo encontrado</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <form onSubmit={handleAddGroup}>
              <div className="bg-navy-50 p-8 border-b border-navy-100">
                <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter leading-none">Novo Grupo Criminoso</h3>
                <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-3">Cadastro de Facção/Gangue</p>
              </div>

              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Nome do Grupo</label>
                  <input 
                    type="text" 
                    required
                    value={newGroup.nome}
                    onChange={(e) => setNewGroup({...newGroup, nome: e.target.value.toUpperCase()})}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-6 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
                    placeholder="EX: COMANDO VERMELHO / PCC"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Cidade de Atuação</label>
                  <input 
                    type="text" 
                    required
                    value={newGroup.cidade}
                    onChange={(e) => setNewGroup({...newGroup, cidade: e.target.value.toUpperCase()})}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-6 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
                    placeholder="EX: CAMPO GRANDE"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Tipo de Atividade</label>
                  <select 
                    value={newGroup.tipo}
                    onChange={(e) => setNewGroup({...newGroup, tipo: e.target.value as CrimeType})}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-6 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
                  >
                    <option value={CrimeType.DRUGS}>Drogas</option>
                    <option value={CrimeType.WEAPONS}>Armas</option>
                    <option value={CrimeType.ROBBERY}>Roubos</option>
                  </select>
                </div>
              </div>

              <div className="p-8 bg-navy-50 border-t border-navy-100 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white hover:bg-gray-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-xs transition-all active:scale-95 border border-navy-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-[2] bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-2xl uppercase text-xs transition-all shadow-xl shadow-navy-900/20 active:scale-95"
                >
                  Criar Grupo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrimeGroupsList;
