
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, startAfter, doc, getDoc } from 'firebase/firestore';
import { DBApproach, Individual } from '../types';
import { formatAddress } from '../lib/utils';

const ITEMS_PER_PAGE = 10;

const ApproachSkeleton = () => (
  <div className="bg-white border border-navy-100 rounded-xl h-24 animate-pulse flex overflow-hidden w-full">
    <div className="w-20 bg-gray-100"></div>
    <div className="flex-1 p-2 space-y-1">
      <div className="h-2.5 bg-gray-200 rounded w-3/4"></div>
      <div className="h-1.5 bg-gray-100 rounded w-1/2"></div>
    </div>
  </div>
);

const ApproachCard = memo(({ app, onClick }: { app: any; onClick: () => void }) => {
  const photos = app.individuos?.fotos_individuos || [];
  const primaryPhoto = photos.find((p: any) => p.is_primary)?.path || photos[0]?.path || app.foto_path;
  const faccao = app.individuos?.faccao;

  return (
    <div 
      onClick={onClick}
      className="bg-white border border-navy-100 rounded-xl overflow-hidden shadow-sm hover:border-navy-600/50 hover:bg-gray-50 transition-all group flex h-24 cursor-pointer active:scale-[0.99] w-full"
    >
      <div className="w-20 h-full flex-shrink-0 bg-gray-50 border-r border-navy-100 overflow-hidden">
        {primaryPhoto ? (
          <img src={primaryPhoto} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-90 group-hover:opacity-100" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20"><i className="fas fa-user-secret text-xl text-navy-300"></i></div>
        )}
      </div>

      <div className="flex-1 p-2 flex flex-col justify-between">
        <div className="flex justify-between items-start gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="text-xs font-black text-navy-950 uppercase tracking-tight truncate">
                {app.individuo_nome || 'INDIVÍDUO N/I'}
              </h3>
              {faccao && (
                <span className="text-[8px] font-black px-1 py-0 bg-red-600/10 text-red-600 rounded border border-red-500/30">
                  {faccao}
                </span>
              )}
            </div>
            <div className="flex items-center text-navy-500 text-[10px] uppercase mt-0.5">
              {new Date(app.data).toLocaleDateString('pt-BR')} - {app.horario}
            </div>
          </div>
          <i className="fas fa-chevron-right text-navy-200 group-hover:text-forest-500 group-hover:translate-x-1 transition-all text-xs"></i>
        </div>
        <div className="flex flex-col text-navy-400 text-[10px] uppercase tracking-tighter">
          <div className="flex items-center">
            <i className="fas fa-map-marker-alt text-red-500 mr-1 flex-shrink-0"></i> 
            {formatAddress(app.local).street}
          </div>
          {formatAddress(app.local).city && (
            <div className="pl-4">{formatAddress(app.local).city}</div>
          )}
        </div>
      </div>
    </div>
  );
});
interface ApproachDetailModalProps {
  approach: DBApproach;
  user: any;
  onClose: () => void;
}

const ApproachDetailModal: React.FC<ApproachDetailModalProps> = ({ approach, user, onClose }) => {
  const [individual, setIndividual] = useState<Individual | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (approach.individuo_id) fetchIndividual(approach.individuo_id);
  }, [approach.individuo_id]);

  const fetchIndividual = async (id: string) => {
    setLoading(true);
    try {
      const docRef = doc(db, 'individuals', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIndividual({ id: docSnap.id, ...docSnap.data() } as Individual);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `individuals/${id}`);
    } finally { setLoading(false); }
  };

  const handleEdit = () => {
    const isAdmin = user?.role === 'ADMIN';
    const isCreator = approach.criado_por === user?.id;

    if (isAdmin || isCreator) {
      navigate(`/editar-abordagem/${approach.id}`);
    } else {
      alert('ACESSO NEGADO: Somente o operador que registrou esta abordagem pode editá-la.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-navy-100 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-navy-600 p-6 border-b border-navy-50 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-forest-600 p-2 rounded-lg"><i className="fas fa-file-contract text-white"></i></div>
            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Relatório Operacional</h3>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleEdit}
              className="text-white bg-navy-500 hover:bg-navy-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
            >
              <i className="fas fa-edit"></i> Editar
            </button>
            <button onClick={onClose} className="text-navy-100 hover:text-white transition-colors"><i className="fas fa-times text-xl"></i></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-2xl border border-navy-100">
            <div><label className="block text-[8px] font-black text-navy-400 uppercase">Data</label><p className="text-sm font-bold text-navy-950">{new Date(approach.data).toLocaleDateString('pt-BR')}</p></div>
            <div><label className="block text-[8px] font-black text-navy-400 uppercase">Hora</label><p className="text-sm font-bold text-navy-950">{approach.horario}</p></div>
            <div><label className="block text-[8px] font-black text-navy-400 uppercase">Status</label><p className="text-sm font-bold text-forest-600">{approach.resultado || 'N/I'}</p></div>
          </div>

          <div className="space-y-2">
            <label className="block text-[8px] font-black text-navy-400 uppercase">Local da Abordagem</label>
            <p className="text-sm font-bold text-navy-950 bg-gray-50 p-3 rounded-xl border border-navy-100 flex items-center gap-2">
              <i className="fas fa-map-marker-alt text-red-500"></i>
              {approach.local}
            </p>
          </div>

          {approach.objetos_apreendidos && (
            <div className="space-y-2">
              <label className="block text-[8px] font-black text-navy-400 uppercase">Objetos Apreendidos</label>
              <p className="text-sm font-bold text-navy-950 bg-gray-50 p-3 rounded-xl border border-navy-100">
                {approach.objetos_apreendidos}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-navy-400 uppercase tracking-widest border-l-2 border-forest-600 pl-2">Identificação</h4>
            <div className="flex items-center gap-3">
               <p className="text-sm font-bold text-navy-950 uppercase">{approach.individuo_nome || individual?.nome || 'N/I'}</p>
               {individual?.faccao && <span className="text-[8px] font-black px-1.5 py-0.5 bg-red-600 text-white rounded uppercase">{individual.faccao}</span>}
            </div>
            {individual?.alcunha && <p className="text-[10px] font-bold text-forest-600 uppercase">"{individual.alcunha}"</p>}
            {individual?.mae && <p className="text-[10px] font-bold text-navy-500 uppercase mt-1">Mãe: <span className="text-navy-700">{individual.mae}</span></p>}
          </div>

          {individual?.observacao && (
            <div className="space-y-2">
              <label className="block text-[8px] font-black text-navy-400 uppercase">Observações do Indivíduo</label>
              <p className="text-navy-700 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-navy-100">
                {individual.observacao}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[8px] font-black text-navy-400 uppercase">Relatório</label>
            <p className="text-navy-700 text-sm leading-relaxed whitespace-pre-wrap italic bg-gray-50 p-4 rounded-xl border border-navy-100">
              {approach.relatorio}
            </p>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t border-navy-100">
          <button onClick={onClose} className="w-full bg-navy-600 hover:bg-navy-500 text-white font-black py-4 rounded-2xl uppercase text-xs transition-all">Fechar</button>
        </div>
      </div>
    </div>
  );
};

interface ApproachesListProps {
  user: any;
}

const ApproachesList: React.FC<ApproachesListProps> = ({ user }) => {
  const [approaches, setApproaches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedApproach, setSelectedApproach] = useState<DBApproach | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoadingMore || isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) fetchApproaches(false);
    });
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, isLoading, hasMore]);

  const fetchApproaches = useCallback(async (isInitial: boolean = false) => {
    if (isInitial) {
      setIsLoading(true);
      setLastDoc(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const approachesRef = collection(db, 'approaches');
      const unitFilter = (user?.role !== 'ADMIN' && user?.role !== 'MASTER' && user?.unidade) ? where('unidade', '==', user.unidade) : null;
      
      let q = query(approachesRef, orderBy('data', 'desc'), limit(ITEMS_PER_PAGE));

      if (unitFilter) {
        q = query(approachesRef, unitFilter, orderBy('data', 'desc'), limit(ITEMS_PER_PAGE));
      }

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      
      const newApproaches: any[] = [];
      for (const approachDoc of querySnapshot.docs) {
        const approachData = approachDoc.data();
        let individualData = null;

        if (approachData.individuo_id) {
          try {
            const indRef = doc(db, 'individuals', approachData.individuo_id);
            const indSnap = await getDoc(indRef);
            
            if (indSnap.exists()) {
              const indInfo = indSnap.data();
              
              // Fetch photos for this individual
              const photosRef = collection(db, 'individual_photos');
              const photosQ = query(photosRef, where('individuo_id', '==', indSnap.id));
              const photosSnapshot = await getDocs(photosQ);
              const photos = photosSnapshot.docs.map(pDoc => pDoc.data());

              individualData = {
                ...indInfo,
                fotos_individuos: photos
              };
            }
          } catch (err) {
            console.error(`Erro ao buscar indivíduo ${approachData.individuo_id}:`, err);
          }
        }

        newApproaches.push({
          id: approachDoc.id,
          ...approachData,
          individuos: individualData
        });
      }

      setApproaches(prev => isInitial ? newApproaches : [...prev, ...newApproaches]);
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === ITEMS_PER_PAGE);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'approaches');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [lastDoc]);

  useEffect(() => { fetchApproaches(true); }, []);

  const filtered = approaches.filter(app => 
    app.individuo_nome?.toLowerCase().includes(search.toLowerCase()) || 
    app.local?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter">Relatório de Abordagens</h2>
        <input type="text" placeholder="Filtrar registros..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white border border-navy-200 text-navy-950 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-navy-500 transition-all font-bold text-sm w-full md:w-80 shadow-sm" />
      </div>

      {isLoading && approaches.length === 0 ? (
        <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <ApproachSkeleton key={i} />)}</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app, index) => (
            <div key={app.id} ref={index === filtered.length - 1 ? lastElementRef : null}>
              <ApproachCard app={app} onClick={async () => {
                try {
                  const docRef = doc(db, 'approaches', app.id);
                  const docSnap = await getDoc(docRef);
                  if (docSnap.exists()) {
                    setSelectedApproach({ id: docSnap.id, ...docSnap.data() } as DBApproach);
                  }
                } catch (err) {
                  handleFirestoreError(err, OperationType.GET, `approaches/${app.id}`);
                }
              }} />
            </div>
          ))}
          {isLoadingMore && <div className="mt-4"><ApproachSkeleton /></div>}
        </div>
      )}
      {selectedApproach && <ApproachDetailModal approach={selectedApproach} user={user} onClose={() => setSelectedApproach(null)} />}
    </div>
  );
};

export default ApproachesList;
