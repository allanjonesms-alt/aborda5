
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import LocationPickerModal from '../components/LocationPickerModal';
import TacticalAlert from '../components/TacticalAlert';
import { maskCPF, validateCPF, allowedCities, checkCity, getCityFromAddressComponents } from '../lib/utils';
import { Shift, User, UserRole, Individual, DBApproach, Relationship } from '../types';
import { loadGoogleMaps } from '../lib/googleMaps';
import RelationshipSection from '../components/RelationshipSection';

interface PhotoRecordUI {
  id: string;
  data: string;
  isPrincipal: boolean;
}

interface NewApproachProps {
  user: User | null;
}

const FACCOES_OPTIONS = [
  { value: '', label: 'Nenhuma / Não Informada' },
  { value: 'PCC', label: 'PCC (Primeiro Comando da Capital)' },
  { value: 'CV', label: 'CV (Comando Vermelho)' },
  { value: 'TCP', label: 'TCP (Terceiro Comando Puro)' },
  { value: 'GDE', label: 'GDE (Guardioes do Estado)' },
  { value: 'BDM', label: 'BDM (Bonde do Maluco)' },
  { value: 'SDC', label: 'SDC (Sindicato do Crime)' },
  { value: 'FDN', label: 'FDN (Família do Norte)' }
];

const NewApproach: React.FC<NewApproachProps> = ({ user }) => {
  console.log("NewApproach user:", user);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const residentialAddressRef = useRef<HTMLInputElement>(null);
  const localAddressRef = useRef<HTMLInputElement>(null);
  const autocompleteInstance = useRef<any>(null);
  const localAutocompleteInstance = useRef<any>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [checkingShift, setCheckingShift] = useState(true);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [loadingApproach, setLoadingApproach] = useState(!!id);

  const [approachData, setApproachData] = useState({
    data: '',
    horario: '',
    local: '',
    relatorio: '',
    objetos_apreendidos: '',
    resultado: ''
  });

  const [individualData, setIndividualData] = useState({
    nome: '',
    alcunha: '',
    documento: '',
    data_nascimento: '',
    mae: '',
    endereco_residencial: '',
    cidade: '',
    faccao: '',
    observacao: ''
  });

  const [selectedIndId, setSelectedIndId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Individual[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const [photos, setPhotos] = useState<PhotoRecordUI[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cpfError, setCpfError] = useState(false);
  const [isManualDateTime, setIsManualDateTime] = useState(false);
  const [isEditingDateTime, setIsEditingDateTime] = useState(false);

  // Fetch approach data if editing
  useEffect(() => {
    if (id) {
      const fetchApproach = async () => {
        try {
          const docRef = doc(db, 'approaches', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } as DBApproach : null;
            if (data) {
              // Check permissions
              const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER;
              const isCreator = data.criado_por === user?.id;

              if (!isAdmin && !isCreator) {
                setAlertMessage('ACESSO NEGADO: Você só pode editar registros criados por você.');
                setTimeout(() => navigate('/abordagens'), 3000);
                return;
              }

              setApproachData({
                data: data.data,
                horario: data.horario,
                local: data.local,
                relatorio: data.relatorio || '',
                objetos_apreendidos: data.objetos_apreendidos || '',
                resultado: data.resultado || ''
              });
              setIsManualDateTime(true);

              if (data.individuo_id) {
                setSelectedIndId(data.individuo_id);
                const indRef = doc(db, 'individuals', data.individuo_id);
                const indSnap = await getDoc(indRef);
                if (indSnap.exists()) {
                  const ind = indSnap.data();
                  setIndividualData({
                    nome: ind.nome,
                    alcunha: ind.alcunha || '',
                    documento: ind.documento || '',
                    data_nascimento: ind.data_nascimento || '',
                    mae: ind.mae || '',
                    endereco_residencial: ind.endereco || '',
                    cidade: ind.cidade || '',
                    faccao: ind.faccao || '',
                    observacao: ind.observacao || ''
                  });
                  if (residentialAddressRef.current) {
                    residentialAddressRef.current.value = ind.endereco || '';
                  }
                }
              }
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `approaches/${id}`);
        } finally {
          setLoadingApproach(false);
        }
      };
      fetchApproach();
    }
  }, [id, user, navigate]);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const checkActiveShift = async () => {
      console.log("Checking active shift...");
      try {
        const q = query(
          collection(db, 'vtr_services'),
          where('status', '==', 'ATIVO')
        );
        
        console.log("Executing query...");
        const querySnapshot = await getDocs(q);
        console.log("Query executed, empty:", querySnapshot.empty);
        let data: Shift | null = null;
        if (!querySnapshot.empty) {
          // Get the most recent one manually if needed
          const docs = querySnapshot.docs.sort((a, b) => b.data().horario_inicio.toDate().getTime() - a.data().horario_inicio.toDate().getTime());
          data = { id: docs[0].id, ...docs[0].data() } as Shift;
        }
        
        console.log("Shift data:", data);
        
        const isUserInShift = (userName: string | undefined, shift: Shift | null) => {
          if (!userName || !shift) return false;
          const name = userName.toUpperCase();
          return (
            shift.comandante?.toUpperCase() === name ||
            shift.motorista?.toUpperCase() === name ||
            shift.patrulheiro_1?.toUpperCase() === name ||
            shift.patrulheiro_2?.toUpperCase() === name
          );
        };

        const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER;

        if (isAdmin) {
          if (data) {
            setActiveShift(data);
          }
          setCheckingShift(false);
        } else {
          if (!data) {
            setAlertMessage('BLOQUEIO DE ACESSO: Você não possui um serviço ativo. Redirecionando...');
            setTimeout(() => navigate('/'), 3000);
          } else if (!isUserInShift(user?.nome, data)) {
            setAlertMessage('VIOLAÇÃO DE ACESSO: Você não está escalado neste serviço. Acesso negado.');
            setTimeout(() => navigate('/'), 3000);
          } else {
            setActiveShift(data);
            setCheckingShift(false);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'vtr_services');
      }
    };
    checkActiveShift();
  }, [navigate, user]);

  useEffect(() => {
    if (isManualDateTime) return;

    const updateDateTime = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const msDate = new Date(utc + (3600000 * -4));
      
      const yyyy = msDate.getFullYear();
      const mm = String(msDate.getMonth() + 1).padStart(2, '0');
      const dd = String(msDate.getDate()).padStart(2, '0');
      const hh = String(msDate.getHours()).padStart(2, '0');
      const min = String(msDate.getMinutes()).padStart(2, '0');

      setApproachData(prev => ({
        ...prev,
        data: `${yyyy}-${mm}-${dd}`,
        horario: `${hh}:${min}`
      }));
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 30000); 
    return () => clearInterval(timer);
  }, [isManualDateTime]);

  const initAutocomplete = () => {
    if (!(window as any).google || !(window as any).google.maps || !(window as any).google.maps.places) return;
    const google = (window as any).google;
    const bounds = {
      north: -17.4,
      south: -19.5,
      east: -53.5,
      west: -55.0,
    };

    const options = {
      componentRestrictions: { country: "br" },
      bounds: bounds,
      strictBounds: true,
      fields: ['formatted_address', 'address_components', 'geometry'],
      types: ['address']
    };

    if (residentialAddressRef.current) {
      autocompleteInstance.current = new google.maps.places.Autocomplete(
        residentialAddressRef.current, 
        options
      );

      autocompleteInstance.current.addListener('place_changed', () => {
        const place = autocompleteInstance.current.getPlace();
        if (!place.formatted_address) return;

        if (!checkCity(place.address_components || [])) {
          alert(`LOCAL FORA DE ÁREA!\n\nAs buscas estão restritas às cidades permitidas:\n${allowedCities.join(', ')}`);
          if (residentialAddressRef.current) residentialAddressRef.current.value = '';
          setIndividualData(prev => ({ ...prev, endereco_residencial: '' }));
          return;
        }

        setIndividualData(prev => ({ 
          ...prev, 
          endereco_residencial: place.formatted_address,
          cidade: getCityFromAddressComponents(place.address_components || [])
        }));
      });
    }

    if (localAddressRef.current) {
      localAutocompleteInstance.current = new google.maps.places.Autocomplete(
        localAddressRef.current, 
        options
      );

      localAutocompleteInstance.current.addListener('place_changed', () => {
        const place = localAutocompleteInstance.current.getPlace();
        if (!place.formatted_address) return;

        if (!checkCity(place.address_components || [])) {
          alert(`LOCAL FORA DE ÁREA!\n\nAs buscas estão restritas às cidades permitidas:\n${allowedCities.join(', ')}`);
          if (localAddressRef.current) localAddressRef.current.value = '';
          setApproachData(prev => ({ ...prev, local: '' }));
          return;
        }

        setApproachData(prev => ({ 
          ...prev, 
          local: place.formatted_address,
          cidade: getCityFromAddressComponents(place.address_components || [])
        }));
      });
    }
  };

  useEffect(() => {
    if (checkingShift) return;

    const setup = async () => {
      try {
        await loadGoogleMaps();
        initAutocomplete();
      } catch (err) {
        console.error("Erro ao carregar Google Maps no NewApproach:", err);
      }
    };

    setup();
    const timer = setTimeout(initAutocomplete, 500);
    return () => clearTimeout(timer);
  }, [checkingShift]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCPF(e.target.value);
    setIndividualData(prev => ({ ...prev, documento: masked }));
    if (masked.length === 14) setCpfError(!validateCPF(masked));
    else setCpfError(false);
  };

  const handleNameChange = async (val: string) => {
    const upperVal = val.toUpperCase();
    
    // Atualização funcional evita usar estado atrasado (stale)
    setIndividualData(prev => ({ ...prev, nome: upperVal }));
    setSelectedIndId(null); 

    if (upperVal.length >= 3) {
      setIsSearching(true);
      try {
        const q = query(
          collection(db, 'individuals'),
          where('nome', '>=', upperVal),
          where('nome', '<=', upperVal + '\uf8ff'),
          limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Individual));
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'individuals');
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectIndividual = (ind: Individual) => {
    setIndividualData({
      nome: ind.nome.toUpperCase(),
      alcunha: ind.alcunha || '',
      documento: ind.documento || '',
      data_nascimento: ind.data_nascimento || '',
      mae: ind.mae || '',
      endereco_residencial: ind.endereco || '',
      cidade: ind.cidade || '',
      faccao: ind.faccao || '',
      observacao: ind.observacao || ''
    });
    setSelectedIndId(ind.id);
    setShowSuggestions(false);
    
    if (residentialAddressRef.current) {
        residentialAddressRef.current.value = ind.endereco || '';
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setPhotos(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            data: base64String,
            isPrincipal: prev.length === 0
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const setPrincipalPhoto = (id: string) => {
    setPhotos(prev => prev.map(p => ({
      ...p,
      isPrincipal: p.id === id
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!individualData.nome) return alert('Nome do abordado é obrigatório.');
    if (!approachData.local) return alert('Localização da abordagem é obrigatória.');

    setIsSaving(true);
    try {
      let indId = selectedIndId;
      const batch = writeBatch(db);

      if (indId) {
        const indRef = doc(db, 'individuals', indId);
        batch.update(indRef, {
          nome: individualData.nome.toUpperCase(),
          alcunha: individualData.alcunha,
          documento: individualData.documento,
          data_nascimento: individualData.data_nascimento,
          mae: individualData.mae.toUpperCase(),
          endereco: individualData.endereco_residencial,
          cidade: individualData.cidade,
          faccao: individualData.faccao,
          unidade: user?.unidade || '',
          updated_at: new Date().toISOString()
        });
      } else {
        if (individualData.documento) {
          const q = query(collection(db, 'individuals'), where('documento', '==', individualData.documento), limit(1));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const existingCpf = snap.docs[0].data();
            alert(`ALERTA CRÍTICO: Este CPF já está cadastrado para o indivíduo: ${existingCpf.nome}. Selecione o nome na lista ou remova o CPF duplicado.`);
            setIsSaving(false);
            return;
          }
        }

        const indRef = doc(collection(db, 'individuals'));
        indId = indRef.id;
        batch.set(indRef, {
          nome: individualData.nome.toUpperCase(),
          alcunha: individualData.alcunha,
          documento: individualData.documento,
          data_nascimento: individualData.data_nascimento,
          mae: individualData.mae.toUpperCase(),
          endereco: individualData.endereco_residencial,
          cidade: individualData.cidade,
          faccao: individualData.faccao,
          unidade: user?.unidade || '',
          created_at: new Date().toISOString()
        });
      }

      if (id) {
        const appRef = doc(db, 'approaches', id);
        batch.update(appRef, {
          data: approachData.data,
          horario: approachData.horario,
          local: approachData.local,
          individuo_id: indId,
          individuo_nome: individualData.nome.toUpperCase(),
          relatorio: approachData.relatorio || `Abordagem editada via Terminal ARGOS.`,
          resultado: approachData.resultado,
          objetos_apreendidos: approachData.objetos_apreendidos,
          updated_at: new Date().toISOString()
        });
      } else {
        const appRef = doc(collection(db, 'approaches'));
        batch.set(appRef, {
          data: approachData.data,
          horario: approachData.horario,
          local: approachData.local,
          individuo_id: indId,
          individuo_nome: individualData.nome.toUpperCase(),
          relatorio: approachData.relatorio || `Abordagem registrada via Terminal ARGOS. Dados ${selectedIndId ? 'atualizados' : 'cadastrados'} no momento da ação.`,
          resultado: approachData.resultado,
          objetos_apreendidos: approachData.objetos_apreendidos,
          unidade: user?.unidade || '',
          criado_por: user?.id || '',
          created_at: new Date().toISOString()
        });
      }

      // Salvar relacionamentos
      relationships.forEach((rel) => {
        const relRef = doc(collection(db, 'individual_relationships'));
        batch.set(relRef, {
          individuo_id: indId,
          relacionado_id: rel.relacionado_id,
          tipo: rel.tipo,
          created_by: user?.nome || 'Sistema',
          created_at: new Date().toISOString()
        });
      });

      // Salvar Fotos
      photos.forEach((p, i) => {
        const photoRef = doc(collection(db, 'individual_photos'));
        batch.set(photoRef, {
          individuo_id: indId,
          path: p.data,
          is_primary: p.isPrincipal,
          sort_order: i,
          created_by: user?.nome || 'Sistema',
          created_at: new Date().toISOString()
        });
      });

      await batch.commit();

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        id ? 'APPROACH_EDITED' : 'APPROACH_REGISTERED',
        `${id ? 'Abordagem editada' : 'Abordagem registrada'} para: ${individualData.nome.toUpperCase()}`,
        { approachId: id || 'new', individualId: indId }
      );

      alert(id ? 'Registro atualizado com sucesso!' : 'Registro finalizado com sucesso!');
      navigate('/abordagens');
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'batch_new_approach');
      alert('Erro ao sincronizar registro: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (checkingShift) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        {alertMessage && <TacticalAlert message={alertMessage} onClose={() => setAlertMessage(null)} />}
        <Siren className="w-12 h-12 text-navy-600 mb-6 animate-pulse" />
        <p className="text-navy-950 font-black uppercase tracking-widest text-xs">CARREGANDO DADOS...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-600 p-3 rounded-2xl shadow-xl shadow-navy-600/20">
            <i className="fas fa-file-signature text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter leading-none">{id ? 'Editar Abordagem' : 'Nova Abordagem'}</h2>
            <p className="text-[10px] text-navy-500 font-black uppercase tracking-widest mt-2">
              {activeShift ? `CMD: ${activeShift.comandante}` : 'REGISTRO ADMIN'}
            </p>
          </div>
        </div>
        <div className="bg-white border border-navy-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
          {isEditingDateTime ? (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="bg-navy-50 border border-navy-200 text-navy-950 px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-navy-500"
                value={approachData.data}
                onChange={e => {
                  setIsManualDateTime(true);
                  setApproachData(prev => ({ ...prev, data: e.target.value }));
                }}
              />
              <input 
                type="time" 
                className="bg-navy-50 border border-navy-200 text-navy-950 px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-navy-500"
                value={approachData.horario}
                onChange={e => {
                  setIsManualDateTime(true);
                  setApproachData(prev => ({ ...prev, horario: e.target.value }));
                }}
              />
              <button 
                type="button"
                onClick={() => setIsEditingDateTime(false)}
                className="text-forest-600 hover:text-forest-500 ml-1"
              >
                <i className="fas fa-check"></i>
              </button>
            </div>
          ) : (
            <>
              <div className="text-right">
                <div className="text-xs font-black text-navy-950 tracking-wider">
                  {approachData.data ? approachData.data.split('-').reverse().join('/') : ''}
                </div>
                <div className="text-[10px] font-black text-navy-500 uppercase tracking-widest">
                  {approachData.horario}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsEditingDateTime(true)}
                className="text-navy-400 hover:text-navy-600 transition-colors bg-navy-50 p-2 rounded-lg"
                title="Alterar Data/Hora"
              >
                <i className="fas fa-clock"></i>
              </button>
            </>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 pb-12">
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-navy-100 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-navy-50 pb-4">
            <h3 className="text-xs font-black text-navy-950 uppercase tracking-widest flex items-center">
              <i className="fas fa-map-marked-alt text-forest-600 mr-2"></i> Localização e Ocorrência
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Local da Abordagem</label>
              <div className="relative group">
                <input 
                  type="text" 
                  ref={localAddressRef}
                  placeholder="Digite ou selecione no mapa..."
                  className="w-full bg-white border border-navy-100 text-navy-950 pl-4 pr-12 py-4 rounded-2xl outline-none font-bold text-sm" 
                  value={approachData.local}
                  onChange={e => setApproachData(prev => ({...prev, local: e.target.value}))}
                />
                <button 
                  type="button"
                  onClick={() => setIsMapOpen(true)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-navy-600 hover:bg-navy-500 text-white w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all"
                >
                  <i className="fas fa-map-pin text-lg"></i>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Resultado / Status</label>
              <input 
                type="text" 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm uppercase focus:ring-2 focus:ring-navy-500 transition-all" 
                placeholder="Ex: LIBERADO, APREENDIDO, PRESO"
                value={approachData.resultado} 
                onChange={e => setApproachData(prev => ({...prev, resultado: e.target.value.toUpperCase()}))} 
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Objetos Apreendidos</label>
              <input 
                type="text" 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm uppercase focus:ring-2 focus:ring-navy-500 transition-all" 
                placeholder="Ex: 1 CELULAR, 20G MACONHA"
                value={approachData.objetos_apreendidos} 
                onChange={e => setApproachData(prev => ({...prev, objetos_apreendidos: e.target.value.toUpperCase()}))} 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Relatório da Abordagem</label>
              <textarea 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm min-h-[100px] resize-none focus:ring-2 focus:ring-navy-500 transition-all" 
                placeholder="Descreva a dinâmica da abordagem..."
                value={approachData.relatorio} 
                onChange={e => setApproachData(prev => ({...prev, relatorio: e.target.value}))}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-navy-100 shadow-xl space-y-6">
          <div className="border-b border-navy-50 pb-4 flex justify-between items-center">
            <h3 className="text-xs font-black text-navy-950 uppercase tracking-widest flex items-center">
              <i className="fas fa-user-shield text-forest-600 mr-2"></i> Identificação do Abordado
            </h3>
            {selectedIndId && (
              <span className="text-[8px] font-black bg-forest-600/10 text-forest-600 px-2 py-1 rounded-lg border border-forest-600/20 uppercase tracking-widest">
                Perfil Sincronizado
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 relative" ref={autocompleteRef}>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Nome Completo</label>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm uppercase focus:ring-2 focus:ring-navy-500 transition-all" 
                  placeholder="NOME OU BUSCA DE REGISTRO..." 
                  value={individualData.nome} 
                  onChange={e => handleNameChange(e.target.value)}
                  onFocus={() => individualData.nome.length >= 3 && setShowSuggestions(true)}
                  required
                />
                {isSearching && <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-navy-500"></i>}
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-navy-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {suggestions.map((ind) => (
                    <div 
                      key={ind.id} 
                      onClick={() => selectIndividual(ind)}
                      className="p-4 hover:bg-navy-50 cursor-pointer border-b border-navy-50 last:border-0 flex items-center justify-between group transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-navy-950 font-black text-xs uppercase truncate group-hover:text-navy-600 transition-colors">{ind.nome}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[8px] text-navy-500 font-bold uppercase">Vulgo: {ind.alcunha || 'N/I'}</span>
                          {ind.faccao && <span className="text-[8px] text-red-600 font-bold uppercase tracking-widest">• {ind.faccao}</span>}
                        </div>
                      </div>
                      <i className="fas fa-chevron-right text-navy-200 group-hover:text-navy-400 transition-all ml-4"></i>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Alcunha</label>
              <input 
                type="text" 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-navy-500 transition-all" 
                placeholder="VULGO"
                value={individualData.alcunha} 
                onChange={e => setIndividualData(prev => ({...prev, alcunha: e.target.value}))} 
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">CPF</label>
              <input 
                type="text" 
                className={`w-full bg-white border ${cpfError ? 'border-red-500' : 'border-navy-200'} text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-navy-500 transition-all`} 
                value={individualData.documento} 
                onChange={handleCpfChange} 
                maxLength={14} 
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Data Nasc.</label>
              <input 
                type="date" 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm focus:ring-2 focus:ring-navy-500 transition-all" 
                value={individualData.data_nascimento} 
                onChange={e => setIndividualData(prev => ({...prev, data_nascimento: e.target.value}))} 
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Mãe</label>
              <input 
                type="text" 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm uppercase focus:ring-2 focus:ring-navy-500 transition-all" 
                placeholder="NOME DA MÃE"
                value={individualData.mae} 
                onChange={e => setIndividualData(prev => ({...prev, mae: e.target.value.toUpperCase()}))} 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Residência</label>
              <div className="relative group">
                <input 
                  type="text" 
                  ref={residentialAddressRef} 
                  className="w-full bg-white border border-navy-200 text-navy-950 pl-10 pr-4 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-navy-500 transition-all font-bold text-sm" 
                  placeholder="Buscar endereço..." 
                  defaultValue={individualData.endereco_residencial} 
                />
                <i className="fas fa-search-location absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 group-focus-within:text-navy-500 transition-all"></i>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Facção</label>
              <select className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none appearance-none font-bold text-sm focus:ring-2 focus:ring-navy-500 transition-all" value={individualData.faccao} onChange={e => setIndividualData(prev => ({...prev, faccao: e.target.value}))}>
                {FACCOES_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-white">{opt.label}</option>)}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[10px] font-black text-navy-500 uppercase tracking-widest mb-2">Observações / Histórico Relevante</label>
              <textarea 
                className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-2xl outline-none font-bold text-sm min-h-[100px] resize-none focus:ring-2 focus:ring-navy-500 transition-all" 
                placeholder="Informações adicionais sobre o abordado..."
                value={individualData.observacao} 
                onChange={e => setIndividualData(prev => ({...prev, observacao: e.target.value}))}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-navy-100 shadow-xl space-y-6">
          <RelationshipSection 
            relationships={relationships}
            onAdd={(rel) => setRelationships(prev => [...prev, { ...rel, id: Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() } as Relationship])}
            onRemove={(id) => setRelationships(prev => prev.filter(r => r.id !== id))}
          />
        </div>

        {/* SEÇÃO INSERIR FOTOS */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-navy-100 shadow-xl space-y-6">
          <div className="border-b border-navy-50 pb-4">
            <h3 className="text-xs font-black text-navy-950 uppercase tracking-widest flex items-center">
              <i className="fas fa-camera text-forest-600 mr-2"></i> Inserir Fotos
            </h3>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-navy-200 rounded-2xl hover:border-forest-600 hover:bg-forest-50 transition-all text-navy-400 hover:text-forest-600"
            >
              <i className="fas fa-plus text-2xl mb-2"></i>
              <span className="text-[10px] font-black uppercase">Adicionar</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
            />
            
            {photos.map((photo) => (
              <div key={photo.id} className={`relative w-32 h-32 rounded-2xl border-2 overflow-hidden group/photo transition-all ${photo.isPrincipal ? 'border-forest-600 ring-2 ring-forest-600/10' : 'border-navy-100'}`}>
                <img src={photo.data} className="w-full h-full object-cover" alt="Abordado" />
                
                <div className="absolute inset-0 bg-navy-900/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setPrincipalPhoto(photo.id)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${photo.isPrincipal ? 'bg-forest-600 text-white' : 'bg-white text-navy-900 hover:bg-forest-600 hover:text-white'}`}
                    title="Definir como Principal"
                  >
                    <i className="fas fa-star text-xs"></i>
                  </button>
                  <button 
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="w-8 h-8 bg-white text-red-600 hover:bg-red-600 hover:text-white rounded-full flex items-center justify-center transition-all"
                    title="Remover"
                  >
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                </div>

                {photo.isPrincipal && (
                  <div className="absolute top-2 left-2 bg-forest-600 text-[8px] font-black text-white px-1.5 py-0.5 rounded uppercase shadow-lg">
                    Capa
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl border border-navy-100 shadow-xl flex flex-col sm:flex-row gap-4">
          <button type="button" onClick={() => navigate(-1)} className="flex-1 bg-gray-100 text-navy-900 font-black py-4 rounded-2xl uppercase text-xs hover:bg-gray-200 transition-all">Sair</button>
          <button type="submit" disabled={isSaving} className="flex-[2] bg-forest-600 hover:bg-forest-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center uppercase text-sm active:scale-95">
            {isSaving ? <i className="fas fa-spinner fa-spin mr-3"></i> : <i className="fas fa-save mr-3"></i>} 
            {isSaving ? 'Sincronizando...' : (id ? 'Salvar Alterações' : (selectedIndId ? 'Atualizar e Registrar' : 'Cadastrar e Registrar'))}
          </button>
        </div>
      </form>

      {isMapOpen && (
        <LocationPickerModal 
          onClose={() => setIsMapOpen(false)} 
          onConfirm={(addr) => setApproachData({...approachData, local: addr})} 
        />
      )}
    </div>
  );
};

export default NewApproach;
