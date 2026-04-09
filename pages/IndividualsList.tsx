
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, getCountFromServer } from 'firebase/firestore';
import AddIndividualModal from '../components/AddIndividualModal';
import ManagePhotosModal from '../components/ManagePhotosModal';
import EditIndividualModal from '../components/EditIndividualModal';
import { Individual, User, PhotoRecord, UserRole } from '../types';
import { allowedCities, RIO_VERDE_VARIATIONS, checkIsAdmin } from '../lib/utils';

interface IndividualsListProps {
  user: User | null;
}

const ITEMS_PER_PAGE = 12;

const IndividualSkeleton = () => (
  <div className="bg-white border border-navy-100 rounded-3xl h-[110px] sm:h-[180px] animate-pulse overflow-hidden flex flex-col p-4 sm:p-5 space-y-3">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
    <div className="h-2 bg-gray-100 rounded w-1/2"></div>
    <div className="hidden sm:block h-10 bg-gray-200 rounded-xl mt-4"></div>
  </div>
);

const IndividualCard = memo(({ ind, onEdit, onManagePhotos }: { 
  ind: Individual, 
  onEdit: (i: Individual) => void, 
  onManagePhotos: (i: Individual) => void 
}) => {
  const primaryPhoto = ind.fotos_individuos?.find(p => p.is_primary)?.path || ind.fotos_individuos?.[0]?.path;

  return (
    <div 
      onClick={() => onEdit(ind)} 
      className="bg-white border border-navy-100 rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg hover:border-forest-600/50 cursor-pointer group transition-all h-[110px] sm:h-[180px] hover:shadow-forest-600/10 active:scale-[0.98]"
    >
      <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between bg-white min-w-0 h-full">
        <div className="space-y-2 sm:space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <h3 className="text-[10px] sm:text-xs font-black text-navy-950 uppercase truncate max-w-[85%] sm:max-w-[70%] leading-none group-hover:text-forest-500 transition-colors">
              {ind.nome}
            </h3>
            <div className="flex gap-1">
              {ind.faccao && (
                <span className="text-[6px] sm:text-[7px] font-black px-1 sm:py-0.5 bg-red-600/10 text-red-600 rounded uppercase border border-red-500/30">
                  {ind.faccao}
                </span>
              )}
              {ind.alcunha && (
                <span className="text-[6px] sm:text-[7px] font-black px-1 sm:py-0.5 bg-forest-600/10 text-forest-600 rounded uppercase border border-forest-500/30">
                  "{ind.alcunha}"
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-2 sm:pt-3 border-t border-navy-100">
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <span className="text-[6px] sm:text-[8px] text-navy-400 font-black uppercase tracking-widest">Nascimento</span>
              <span className="text-[8px] sm:text-[10px] text-navy-700 font-bold">
                {ind.data_nascimento ? new Date(ind.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 sm:gap-1 overflow-hidden">
              <span className="text-[6px] sm:text-[8px] text-navy-400 font-black uppercase tracking-widest">Doc</span>
              <span className="text-[8px] sm:text-[10px] text-navy-700 font-bold truncate">
                {ind.documento || 'N/I'}
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={(e) => { e.stopPropagation(); onManagePhotos(ind); }} 
          className="mt-2 sm:mt-4 h-7 sm:h-10 bg-gray-50 hover:bg-navy-600 text-navy-500 hover:text-white rounded-lg sm:rounded-xl flex items-center justify-center border border-navy-100 hover:border-navy-500 transition-all shadow-sm uppercase text-[7px] sm:text-[9px] font-black w-full"
        >
          <i className="fas fa-camera-retro mr-1.5 sm:mr-2"></i> <span className="hidden sm:inline">Fotos</span><span className="sm:hidden">Mídia</span>
        </button>
      </div>
    </div>
  );
});

const IndividualsList: React.FC<IndividualsListProps> = ({ user }) => {
  const [individuals, setIndividuals] = useState<Individual[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [factionFilter, setFactionFilter] = useState('');
  const [editingIndividual, setEditingIndividual] = useState<Individual | null>(null);
  const [managingPhotosIndividual, setManagingPhotosIndividual] = useState<Individual | null>(null);
  const [isAddingIndividual, setIsAddingIndividual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const userCity = user?.unidade?.toUpperCase().replace(/[\s/]+/g, '') || '';
  
  // Find the matching city from allowedCities by normalizing both
  const matchedCity = allowedCities.find(city => {
    const normalizedCity = city.toUpperCase().replace(/[\s/]+/g, '');
    const isMatch = normalizedCity.includes(userCity) || (userCity.includes('RIOVERDE') && normalizedCity === '2ªCIARIOVERDE');
    return isMatch;
  });

  const isAdmin = checkIsAdmin(user);
  const [activeFilter, setActiveFilter] = useState(isAdmin ? 'TODOS' : (matchedCity || 'TODOS'));

  // Force filter for non-admins
  useEffect(() => {
    if (!isAdmin && matchedCity) {
      setActiveFilter(matchedCity);
    }
  }, [isAdmin, matchedCity]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoadingMore || isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchIndividuals(false, debouncedSearch, factionFilter);
    }, { threshold: 0.1 });
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, isLoading, hasMore, debouncedSearch, factionFilter]);

  const fetchIndividuals = useCallback(async (isInitial: boolean = false, searchTerm: string = '', faction: string = '') => {
    // Só busca se o usuário estiver carregado
    if (!user) {
      console.log('Aguardando carregamento do usuário...');
      return;
    }

    console.log('Fetching individuals:', { isInitial, searchTerm, faction, lastDoc, activeFilter });
    if (isInitial) {
      setIsLoading(true);
      setLastDoc(null);
      setError(null); // Reset error on new fetch
    } else {
      setIsLoadingMore(true);
    }

    try {
      const individualsRef = collection(db, 'individuals');
      let q;

      // Filtro de unidade
      const isAdmin = checkIsAdmin(user);
      const unitFilter = (!isAdmin && user?.unidade) ? where('unidade', '==', user.unidade) : null;
      const factionFilterClause = faction ? where('faccao', '==', faction) : null;

      if (isInitial) {
        let countQuery = query(individualsRef);
        if (unitFilter) countQuery = query(countQuery, unitFilter);
        if (factionFilterClause) countQuery = query(countQuery, factionFilterClause);
        
        const countSnapshot = await getCountFromServer(countQuery);
        setTotalCount(countSnapshot.data().count);
      }

      const queryConstraints = [];
      if (unitFilter) queryConstraints.push(unitFilter);
      if (factionFilterClause) queryConstraints.push(factionFilterClause);
      
      // Filtro de cidade (Server-side)
      if (activeFilter !== 'TODOS') {
        if (activeFilter === 'OUTROS') {
          // Para 'OUTROS', ainda precisamos de lógica especial. 
          // Se o volume for baixo, podemos buscar mais e filtrar, 
          // mas o ideal seria ter um campo 'cidade' preenchido.
          // Por enquanto, vamos manter a lógica de 'cidade' ser um campo.
          queryConstraints.push(where('cidade', '==', ''));
        } else {
          queryConstraints.push(where('cidade', '==', activeFilter));
        }
      }
      
      if (searchTerm.trim()) {
        const s = searchTerm.trim().toUpperCase();
        queryConstraints.push(where('nome', '>=', s));
        queryConstraints.push(where('nome', '<=', s + '\uf8ff'));
      }
      
      queryConstraints.push(orderBy('nome'));
      
      q = query(individualsRef, ...queryConstraints, limit(ITEMS_PER_PAGE));

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      
      let newIndividuals: Individual[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        
        // Fetch photos for this individual
        const photosRef = collection(db, 'individual_photos');
        const photosQ = query(photosRef, where('individuo_id', '==', docSnapshot.id), orderBy('__name__'));
        const photosSnapshot = await getDocs(photosQ);
        
        const photos = photosSnapshot.docs.map(pDoc => ({ id: pDoc.id, ...pDoc.data() } as PhotoRecord));
        
        newIndividuals.push({
          id: docSnapshot.id,
          ...data,
          fotos_individuos: photos
        } as Individual);
      }

      setIndividuals(prev => isInitial ? newIndividuals : [...prev, ...newIndividuals]);
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);
    } catch (err: any) {
      console.error('Error fetching individuals:', err);
      let errorMessage = 'Erro ao carregar indivíduos. Tente novamente.';
      
      // Check if it's a Firestore index error
      if (err.message?.toLowerCase().includes('index') || err.code === 'failed-precondition') {
        const indexLink = err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
        if (indexLink) {
          errorMessage = (
            <div className="flex flex-col items-center gap-2">
              <span>O sistema requer um índice de busca que ainda não foi criado.</span>
              <a 
                href={indexLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-navy-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-navy-500 transition-all"
              >
                Clique aqui para criar o índice
              </a>
            </div>
          ) as any;
        } else {
          errorMessage = 'O sistema está preparando os índices de busca ou um índice necessário está ausente. Se você for o administrador, verifique o console do Firebase.';
        }
        console.error('Firestore Index Error. Full message:', err.message);
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [lastDoc, user]);

  useEffect(() => {
    fetchIndividuals(true, debouncedSearch, factionFilter);
  }, [debouncedSearch, factionFilter, activeFilter]);

  const handleSave = () => {
    setIndividuals([]);
    fetchIndividuals(true, debouncedSearch, factionFilter);
  };

  const getAvailableFilters = () => {
    if (!isAdmin && matchedCity) {
      return [matchedCity];
    }
    return ['TODOS', ...allowedCities, 'OUTROS'];
  };

  return (
    <div className="max-w-7xl mx-auto py-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-6 px-4">
        <div className="flex items-center space-x-5">
          <div className="bg-forest-600 p-4 rounded-2xl shadow-xl shadow-forest-600/20">
            <i className="fas fa-user-shield text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter leading-none">Indivíduos</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-2">
              {isLoading ? 'Consultando Inteligência...' : `${totalCount} Registros Ativos`}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-80">
            <input 
              type="text" 
              placeholder="Pesquisar registro..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-white border border-navy-200 text-navy-950 pl-12 pr-4 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-navy-500 transition-all font-bold text-sm shadow-sm" 
            />
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-navy-300"></i>
          </div>
          <select 
            value={factionFilter}
            onChange={(e) => setFactionFilter(e.target.value)}
            className="bg-white border border-navy-200 text-navy-950 px-4 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-navy-500 transition-all font-bold text-sm shadow-sm"
          >
            <option value="">Todas as Facções</option>
            <option value="CV">CV</option>
            <option value="PCC">PCC</option>
            <option value="ADA">ADA</option>
            <option value="TCP">TCP</option>
          </select>
          <button 
            onClick={() => setIsAddingIndividual(true)} 
            className="bg-navy-600 hover:bg-navy-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
          >
            <i className="fas fa-plus"></i> Novo Cadastro
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 mb-8">
        {getAvailableFilters().map(city => (
          <button 
            key={city} 
            onClick={() => setActiveFilter(city)} 
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${activeFilter === city ? 'bg-navy-600 border-navy-500 text-white shadow-xl scale-105' : 'bg-white border-navy-200 text-navy-400 hover:border-navy-500 hover:bg-navy-50'}`}
          >
            {city}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-4">
        {error ? (
          <div className="col-span-full py-20 text-center bg-red-50 rounded-3xl border border-red-100">
            <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
            <p className="text-red-700 font-bold text-sm mb-4">{error}</p>
            <button 
              onClick={() => fetchIndividuals(true, debouncedSearch)}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-xl font-black text-xs uppercase transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : isLoading && individuals.length === 0 ? (
          Array.from({ length: 12 }).map((_, i) => <IndividualSkeleton key={i} />)
        ) : (
          <>
            {individuals.map((ind, index) => (
              <div key={ind.id} ref={index === individuals.length - 1 ? lastElementRef : null}>
                <IndividualCard ind={ind} onEdit={setEditingIndividual} onManagePhotos={setManagingPhotosIndividual} />
              </div>
            ))}
            {isLoadingMore && Array.from({ length: 6 }).map((_, i) => <IndividualSkeleton key={i} />)}
          </>
        )}
      </div>

      {isAddingIndividual && <AddIndividualModal currentUser={user} onClose={() => setIsAddingIndividual(false)} onSave={handleSave} />}
      {editingIndividual && <EditIndividualModal individual={editingIndividual} currentUser={user} onClose={() => setEditingIndividual(null)} onSave={() => { handleSave(); setEditingIndividual(null); }} />}
      {managingPhotosIndividual && <ManagePhotosModal currentUser={user} individual={managingPhotosIndividual} onClose={() => setManagingPhotosIndividual(null)} onSave={handleSave} />}
    </div>
  );
};

export default IndividualsList;
