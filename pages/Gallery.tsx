
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, doc, getDoc } from 'firebase/firestore';
import { Individual } from '../types';
import EditIndividualModal from '../components/EditIndividualModal';

const ITEMS_PER_PAGE = 18;

interface IndividualWithPhoto extends Partial<Individual> {
  fotos_individuos: {
    id: string;
    path: string;
    is_primary: boolean;
  }[];
}

const CITIES = ['COXIM', 'SONORA', 'PEDRO GOMES', 'ALCINÓPOLIS', 'RIO VERDE'];

const GallerySkeleton = () => (
  <div className="aspect-[3/4] bg-gray-50 border border-navy-100 rounded-3xl animate-pulse"></div>
);

const Gallery: React.FC = () => {
  const [data, setData] = useState<IndividualWithPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState('TODOS');
  const [selectedIndividual, setSelectedIndividual] = useState<Individual | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoadingMore || isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchGalleryData(false);
      }
    });
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, isLoading, hasMore]);

  const fetchGalleryData = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) {
      setIsLoading(true);
      setData([]);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let q = query(
        collection(db, 'individuals'),
        orderBy('nome', 'asc'),
        limit(ITEMS_PER_PAGE)
      );

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      
      const individuals = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Individual));
      
      // Fetch primary photos for each individual
      const formattedData: IndividualWithPhoto[] = await Promise.all(individuals.map(async (ind) => {
        try {
          const photoQ = query(
            collection(db, 'individual_photos'),
            where('individual_id', '==', ind.id),
            where('is_primary', '==', true),
            limit(1)
          );
          const photoSnap = await getDocs(photoQ);
          const photos = photoSnap.docs.map(d => ({ 
            id: d.id, 
            path: d.data().path, 
            is_primary: d.data().is_primary 
          }));
          return { ...ind, fotos_individuos: photos };
        } catch (err) {
          console.error(`Erro ao buscar foto do indivíduo ${ind.id}:`, err);
          return { ...ind, fotos_individuos: [] };
        }
      }));

      // Filter client-side for the city filter (since Firestore is limited here)
      let filtered = formattedData.filter(item => item.fotos_individuos.length > 0);
      
      if (activeFilter !== 'TODOS') {
        if (activeFilter === 'OUTROS') {
          filtered = filtered.filter(item => !CITIES.some(city => item.endereco?.toUpperCase().includes(city)));
        } else {
          filtered = filtered.filter(item => item.endereco?.toUpperCase().includes(activeFilter));
        }
      }

      setData(prev => isInitial ? filtered : [...prev, ...filtered]);
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'individuals');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [activeFilter, lastDoc]);

  useEffect(() => { 
    fetchGalleryData(true); 
  }, [activeFilter]);

  const handleOpenProfile = async (id: string) => {
    try {
      const docRef = doc(db, 'individuals', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const indData = { id: docSnap.id, ...docSnap.data() } as Individual;
        
        // Fetch all photos for the modal
        const photoQ = query(collection(db, 'individual_photos'), where('individual_id', '==', id));
        const photoSnap = await getDocs(photoQ);
        const photos = photoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setSelectedIndividual({ ...indData, fotos_individuos: photos } as any);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `individuals/${id}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
        <div className="flex items-center space-x-4">
          <div className="bg-forest-600 p-3 rounded-2xl shadow-xl shadow-forest-600/30">
            <i className="fas fa-images text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter leading-none">Galeria de Capas</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-2">Registros Ordenados por Nome</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {['TODOS', ...CITIES, 'OUTROS'].map(city => (
            <button 
              key={city} 
              onClick={() => setActiveFilter(city)} 
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${activeFilter === city ? 'bg-navy-600 border-navy-500 text-white shadow-xl scale-105' : 'bg-white border-navy-200 text-navy-400 hover:border-navy-500 hover:bg-navy-50'}`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        {isLoading && data.length === 0 ? (
          Array.from({ length: 12 }).map((_, i) => <GallerySkeleton key={i} />)
        ) : (
          <>
            {data.map((item, index) => (
              <div 
                key={item.id} 
                ref={index === data.length - 1 ? lastElementRef : null}
                onClick={() => handleOpenProfile(item.id!)}
                className="group relative aspect-[3/4] rounded-3xl border border-navy-100 overflow-hidden bg-white shadow-lg hover:border-forest-500/50 hover:scale-[1.03] cursor-pointer transition-all active:scale-95"
              >
                <img 
                  src={item.fotos_individuos[0]?.path} 
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700" 
                  loading="lazy" 
                  alt={item.nome}
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/20 to-transparent p-4 flex flex-col justify-end">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="text-white text-[9px] font-black uppercase tracking-tight truncate leading-tight group-hover:text-forest-400 transition-colors">
                      {item.nome}
                    </h4>
                    {item.faccao && (
                      <span className="text-[7px] font-black px-1.5 py-0.5 bg-red-600/90 text-white rounded uppercase flex-shrink-0 border border-red-500/30">
                        {item.faccao}
                      </span>
                    )}
                  </div>
                  {item.alcunha && (
                    <p className="text-[8px] text-yellow-500/80 font-bold uppercase mt-1 truncate">
                      "{item.alcunha}"
                    </p>
                  )}
                </div>
              </div>
            ))}
            {isLoadingMore && Array.from({ length: 6 }).map((_, i) => <GallerySkeleton key={i} />)}
          </>
        )}
      </div>

      {data.length === 0 && !isLoading && (
        <div className="flex flex-col items-center py-40 border border-navy-100 border-dashed rounded-[3rem] bg-gray-50">
          <i className="fas fa-camera-retro text-navy-200 text-5xl mb-4"></i>
          <p className="text-navy-400 font-black uppercase text-xs tracking-[0.3em]">Nenhum registro com foto de capa nesta região</p>
        </div>
      )}

      {selectedIndividual && (
        <EditIndividualModal 
          individual={selectedIndividual} 
          currentUser={null}
          onClose={() => setSelectedIndividual(null)} 
          onSave={() => { setData([]); setLastDoc(null); fetchGalleryData(true); setSelectedIndividual(null); }} 
        />
      )}
    </div>
  );
};

export default Gallery;
