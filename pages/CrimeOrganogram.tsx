
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { CrimeGroup, CrimeMember, CrimeMemberRole, Individual, User, UserRole } from '../types';
import { Network, Plus, Trash2, Edit3, ChevronLeft, User as UserIcon, MoreVertical, AlertCircle, Pill, Skull, Ghost, Zap, Activity, Search } from 'lucide-react';

interface CrimeOrganogramProps {
  user: User | null;
}

interface MemberWithData extends CrimeMember {
  individual?: Individual;
}

const CrimeOrganogram: React.FC<CrimeOrganogramProps> = ({ user }) => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<CrimeGroup | null>(null);
  const [members, setMembers] = useState<MemberWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MemberWithData | null>(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Search state for modal
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Individual[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    individual_id: '',
    role: CrimeMemberRole.VAPOR,
    parent_id: '',
    drugs: [] as string[],
    funcao_especifica: ''
  });

  const drugOptions = [
    { id: 'MACONHA', icon: <i className="fas fa-leaf text-forest-500"></i>, label: 'Maconha' },
    { id: 'COCAINA', icon: <Pill className="text-blue-400" size={14} />, label: 'Cocaína' },
    { id: 'HAXIXE', icon: <Skull className="text-amber-700" size={14} />, label: 'Haxixe' },
    { id: 'CRACK', icon: <Ghost className="text-gray-400" size={14} />, label: 'Crack' },
    { id: 'ECSTASY', icon: <Zap className="text-purple-400" size={14} />, label: 'Ecstasy' },
    { id: 'OUTROS', icon: <Activity className="text-red-400" size={14} />, label: 'Outros' }
  ];

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const groupDoc = await getDoc(doc(db, 'crime_groups', groupId!));
      if (!groupDoc.exists()) {
        navigate('/organogramas');
        return;
      }
      setGroup({ id: groupDoc.id, ...groupDoc.data() } as CrimeGroup);

      const q = query(collection(db, 'crime_members'), where('group_id', '==', groupId));
      const querySnapshot = await getDocs(q);
      const membersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CrimeMember));

      // Fetch individual data for each member
      const enrichedMembers = await Promise.all(membersData.map(async (member) => {
        const indDoc = await getDoc(doc(db, 'individuals', member.individual_id));
        return {
          ...member,
          individual: indDoc.exists() ? { id: indDoc.id, ...indDoc.data() } as Individual : undefined
        };
      }));

      setMembers(enrichedMembers);
    } catch (err) {
      console.error("Erro ao buscar dados do organograma:", err);
      handleFirestoreError(err, OperationType.GET, 'crime_groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (val: string) => {
    setSearch(val);
    if (val.length >= 3) {
      setIsSearching(true);
      try {
        const q = query(
          collection(db, 'individuals'),
          where('nome', '>=', val.toUpperCase()),
          where('nome', '<=', val.toUpperCase() + '\uf8ff')
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Individual));
        setSuggestions(data.slice(0, 5));
      } catch (err) {
        console.error("Erro ao buscar indivíduos:", err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.individual_id) return;

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'crime_members', editingMember.id), {
          ...formData,
          updated_at: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'crime_members'), {
          ...formData,
          group_id: groupId,
          created_at: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingMember(null);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Erro ao salvar membro:", err);
      handleFirestoreError(err, OperationType.WRITE, 'crime_members');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este membro do organograma?')) return;
    try {
      await deleteDoc(doc(db, 'crime_members', id));
      fetchData();
    } catch (err) {
      console.error("Erro ao excluir membro:", err);
    }
  };

  const resetForm = () => {
    setFormData({
      individual_id: '',
      role: CrimeMemberRole.VAPOR,
      parent_id: '',
      drugs: [],
      funcao_especifica: ''
    });
    setSearch('');
    setSuggestions([]);
  };

  const openAddModal = (role: CrimeMemberRole, parentId?: string) => {
    resetForm();
    setFormData(prev => ({ ...prev, role, parent_id: parentId || '' }));
    setIsModalOpen(true);
  };

  const openEditModal = (member: MemberWithData) => {
    setEditingMember(member);
    setFormData({
      individual_id: member.individual_id,
      role: member.role,
      parent_id: member.parent_id || '',
      drugs: member.drugs || [],
      funcao_especifica: member.funcao_especifica || ''
    });
    setSearch(member.individual?.nome || '');
    setIsModalOpen(true);
  };

  const toggleDrug = (drugId: string) => {
    setFormData(prev => ({
      ...prev,
      drugs: prev.drugs.includes(drugId) 
        ? prev.drugs.filter(d => d !== drugId)
        : [...prev.drugs, drugId]
    }));
  };

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

  // Hierarchy levels
  const distributors = members.filter(m => m.role === CrimeMemberRole.DISTRIBUIDOR);
  const pointsOfSale = members.filter(m => m.role === CrimeMemberRole.BOCA_DE_FUMO);
  const vapors = members.filter(m => m.role === CrimeMemberRole.VAPOR);
  const users = members.filter(m => m.role === CrimeMemberRole.USUARIO);

  const MemberCard = ({ member }: { member: MemberWithData }) => (
    <div className="relative group bg-white border border-navy-100 p-4 rounded-[1.5rem] shadow-sm hover:shadow-xl transition-all w-48 text-center flex flex-col items-center">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          <button onClick={() => openEditModal(member)} className="p-1 hover:bg-navy-50 rounded-lg text-navy-400"><Edit3 size={14}/></button>
          <button onClick={() => handleDeleteMember(member.id)} className="p-1 hover:bg-navy-50 rounded-lg text-red-400"><Trash2 size={14}/></button>
        </div>
      </div>

      <div className="w-16 h-16 rounded-2xl bg-navy-50 mb-3 overflow-hidden border border-navy-100 shadow-inner">
        {member.individual?.fotos_individuos?.[0] ? (
          <img src={member.individual.fotos_individuos[0].path} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-navy-200">
            <UserIcon size={24} />
          </div>
        )}
      </div>

      <h4 className="text-[10px] font-black text-navy-950 uppercase leading-tight line-clamp-2 mb-1">
        {member.individual?.nome || 'NÃO ENCONTRADO'}
      </h4>
      
      {member.individual?.alcunha && (
        <span className="text-[9px] text-navy-400 font-bold uppercase mb-2">"{member.individual.alcunha}"</span>
      )}

      {member.funcao_especifica && (
        <span className="text-[8px] bg-navy-950 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest mb-2">
          {member.funcao_especifica}
        </span>
      )}

      {member.drugs && member.drugs.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-2 pt-2 border-t border-navy-50 w-full">
          {member.drugs.map(drug => {
            const option = drugOptions.find(o => o.id === drug);
            return (
              <div key={drug} title={option?.label} className="w-5 h-5 flex items-center justify-center">
                {option?.icon}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/organogramas')} className="flex items-center gap-2 text-navy-400 hover:text-navy-900 transition-all font-black text-xs uppercase tracking-widest">
          <ChevronLeft size={16} /> Voltar para Lista
        </button>
        
        <div className="text-center">
          <h1 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Organograma de Crimes</h1>
          <p className="text-navy-400 text-sm font-bold uppercase tracking-widest mt-1">
            {group?.nome} • {group?.cidade}
          </p>
        </div>

        <div className="w-24"></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-navy-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-16">
          {/* LEVEL 0: DISTRIBUTORS */}
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-px bg-navy-100 flex-1"></div>
              <div className="bg-navy-900 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg">
                DISTRIBUIDORES
              </div>
              <div className="h-px bg-navy-100 flex-1"></div>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              {distributors.map(m => <MemberCard key={m.id} member={m} />)}
              <button 
                onClick={() => openAddModal(CrimeMemberRole.DISTRIBUIDOR)}
                className="w-48 h-32 border-2 border-dashed border-navy-100 rounded-[1.5rem] flex flex-col items-center justify-center text-navy-300 hover:bg-navy-50 hover:text-navy-600 transition-all gap-2"
              >
                <Plus size={24} />
                <span className="text-[10px] font-black uppercase">Novo Distribuidor</span>
              </button>
            </div>
          </div>

          {/* LEVEL 1: POINTS OF SALE */}
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-px bg-navy-100 flex-1"></div>
              <div className="bg-forest-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg">
                PONTOS DE VENDA (BOCAS)
              </div>
              <div className="h-px bg-navy-100 flex-1"></div>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              {pointsOfSale.map(m => <MemberCard key={m.id} member={m} />)}
              <button 
                onClick={() => openAddModal(CrimeMemberRole.BOCA_DE_FUMO)}
                className="w-48 h-32 border-2 border-dashed border-navy-100 rounded-[1.5rem] flex flex-col items-center justify-center text-navy-300 hover:bg-navy-50 hover:text-navy-600 transition-all gap-2"
              >
                <Plus size={24} />
                <span className="text-[10px] font-black uppercase">Nova Boca de Fumo</span>
              </button>
            </div>
          </div>

          {/* LEVEL 2: VAPORS */}
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-px bg-navy-100 flex-1"></div>
              <div className="bg-red-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg">
                VAPORES (VENDEDORES)
              </div>
              <div className="h-px bg-navy-100 flex-1"></div>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              {vapors.map(m => <MemberCard key={m.id} member={m} />)}
              <button 
                onClick={() => openAddModal(CrimeMemberRole.VAPOR)}
                className="w-48 h-32 border-2 border-dashed border-navy-100 rounded-[1.5rem] flex flex-col items-center justify-center text-navy-300 hover:bg-navy-50 hover:text-navy-600 transition-all gap-2"
              >
                <Plus size={24} />
                <span className="text-[10px] font-black uppercase">Novo Vapor</span>
              </button>
            </div>
          </div>

          {/* LEVEL 3: USERS */}
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-px bg-navy-100 flex-1"></div>
              <div className="bg-amber-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg">
                USUÁRIOS
              </div>
              <div className="h-px bg-navy-100 flex-1"></div>
            </div>
            <div className="flex flex-wrap justify-center gap-8">
              {users.map(m => <MemberCard key={m.id} member={m} />)}
              <button 
                onClick={() => openAddModal(CrimeMemberRole.USUARIO)}
                className="w-48 h-32 border-2 border-dashed border-navy-100 rounded-[1.5rem] flex flex-col items-center justify-center text-navy-300 hover:bg-navy-50 hover:text-navy-600 transition-all gap-2"
              >
                <Plus size={24} />
                <span className="text-[10px] font-black uppercase">Novo Usuário</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <form onSubmit={handleSubmit}>
              <div className="bg-navy-50 p-8 border-b border-navy-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter leading-none">
                    {editingMember ? 'Editar Membro' : 'Adicionar ao Organograma'}
                  </h3>
                  <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-3">Hierarquia Operacional</p>
                </div>
                <div className="bg-navy-900 text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                  {formData.role}
                </div>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh]">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Vincular Indivíduo</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Pesquisar por nome..." 
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-12 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-navy-300" size={18} />
                    {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-navy-300 border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                  
                  {suggestions.length > 0 && (
                    <div className="bg-white border border-navy-100 rounded-2xl shadow-xl overflow-hidden divide-y divide-navy-50">
                      {suggestions.map(ind => (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, individual_id: ind.id }));
                            setSearch(ind.nome);
                            setSuggestions([]);
                          }}
                          className={`w-full p-4 flex items-center gap-3 hover:bg-navy-50 transition-colors ${formData.individual_id === ind.id ? 'bg-navy-900 text-white' : ''}`}
                        >
                          <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            {ind.fotos_individuos?.[0] ? <img src={ind.fotos_individuos[0].path} className="w-full h-full object-cover rounded-lg" alt=""/> : <UserIcon size={16}/>}
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black uppercase leading-tight">{ind.nome}</p>
                            {ind.alcunha && <p className={`text-[8px] font-bold uppercase ${formData.individual_id === ind.id ? 'text-navy-300' : 'text-navy-400'}`}>"{ind.alcunha}"</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Função Específica (Opcional)</label>
                  <input 
                    type="text" 
                    value={formData.funcao_especifica}
                    onChange={(e) => setFormData({...formData, funcao_especifica: e.target.value.toUpperCase()})}
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-6 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
                    placeholder="EX: GERENTE GERAL / SEGURANÇA"
                  />
                </div>

                {formData.role === CrimeMemberRole.BOCA_DE_FUMO && (
                  <div>
                    <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-4">Drogas Comercializadas</label>
                    <div className="grid grid-cols-2 gap-3">
                      {drugOptions.map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggleDrug(option.id)}
                          className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            formData.drugs.includes(option.id) 
                              ? 'bg-navy-900 border-navy-900 text-white shadow-lg shadow-navy-100' 
                              : 'bg-white border-navy-100 text-navy-600 hover:border-navy-300'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${formData.drugs.includes(option.id) ? 'bg-white/20' : 'bg-navy-50'}`}>
                            {option.icon}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-tighter">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  disabled={!formData.individual_id}
                  className="flex-[2] bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase text-xs transition-all shadow-xl shadow-navy-900/20 active:scale-95"
                >
                  {editingMember ? 'Salvar Alterações' : 'Salvar no Organograma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrimeOrganogram;
