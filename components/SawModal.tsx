
import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, limit, getDocs, addDoc, doc, getDoc } from 'firebase/firestore';
import { Individual, User, DBApproach, Shift, UserRole } from '../types';
import { loadGoogleMaps } from '../lib/googleMaps';
import { allowedCities, checkCity, getCityFromAddressComponents } from '../lib/utils';
import LocationPickerModal from './LocationPickerModal';

interface SawModalProps {
  user: User | null;
  individual?: Individual;
  onClose: () => void;
  onSaved: () => void;
}

const SawModal: React.FC<SawModalProps> = ({ user, individual, onClose, onSaved }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isManualDateTime, setIsManualDateTime] = useState(false);
  const [isEditingDateTime, setIsEditingDateTime] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [checkingShift, setCheckingShift] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    data: '',
    horario: '',
    local: '',
    individuo_id: individual?.id || '',
    individuo_nome: individual?.nome || ''
  });

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Individual[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const localAddressRef = useRef<HTMLInputElement>(null);
  const localAutocompleteInstance = useRef<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Check active shift
  useEffect(() => {
    const checkActiveShift = async () => {
      try {
        const q = query(
          collection(db, 'vtr_services'),
          where('status', '==', 'ATIVO')
        );
        const querySnapshot = await getDocs(q);
        let data: Shift | null = null;
        if (!querySnapshot.empty) {
          const docs = querySnapshot.docs.sort((a, b) => b.data().horario_inicio.toDate().getTime() - a.data().horario_inicio.toDate().getTime());
          data = { id: docs[0].id, ...docs[0].data() } as Shift;
        }

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
        if (isAdmin || isUserInShift(user?.nome, data)) {
          setActiveShift(data);
        } else if (data) {
          setError('Você não está escalado no serviço ativo atual.');
        } else {
          setError('Não há serviço ativo no momento.');
        }
      } catch (err) {
        console.error("Erro ao verificar serviço:", err);
      } finally {
        setCheckingShift(false);
      }
    };
    checkActiveShift();
  }, [user]);

  // Auto-update date and time
  useEffect(() => {
    if (isManualDateTime) return;

    const updateDateTime = () => {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const msDate = new Date(utc + (3600000 * -4)); // MS Timezone
      
      const yyyy = msDate.getFullYear();
      const mm = String(msDate.getMonth() + 1).padStart(2, '0');
      const dd = String(msDate.getDate()).padStart(2, '0');
      const hh = String(msDate.getHours()).padStart(2, '0');
      const min = String(msDate.getMinutes()).padStart(2, '0');

      setFormData(prev => ({
        ...prev,
        data: `${yyyy}-${mm}-${dd}`,
        horario: `${hh}:${min}`
      }));
    };

    updateDateTime();
    const timer = setInterval(updateDateTime, 30000);
    return () => clearInterval(timer);
  }, [isManualDateTime]);

  // Google Maps Autocomplete
  useEffect(() => {
    if (checkingShift || error) return;

    const setup = async () => {
      try {
        await loadGoogleMaps();
        if (localAddressRef.current) {
          const google = (window as any).google;
          const bounds = { north: -17.4, south: -19.5, east: -53.5, west: -55.0 };
          const options = {
            componentRestrictions: { country: "br" },
            bounds: bounds,
            strictBounds: true,
            fields: ['formatted_address', 'address_components'],
            types: ['geocode']
          };

          localAutocompleteInstance.current = new google.maps.places.Autocomplete(localAddressRef.current, options);
          localAutocompleteInstance.current.addListener('place_changed', () => {
            const place = localAutocompleteInstance.current.getPlace();
            if (!place.formatted_address) return;

            if (!checkCity(place.address_components || [])) {
              alert(`LOCAL FORA DE ÁREA!\n\nAs buscas estão restritas às cidades permitidas:\n${allowedCities.join(', ')}`);
              if (localAddressRef.current) localAddressRef.current.value = '';
              setFormData(prev => ({ ...prev, local: '' }));
              return;
            }

            setFormData(prev => ({ ...prev, local: place.formatted_address }));
          });
        }
      } catch (err) {
        console.error("Erro ao carregar Google Maps:", err);
      }
    };

    setup();
  }, [checkingShift, error]);

  // Handle individual search
  useEffect(() => {
    if (individual) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [individual]);

  const handleSearchChange = async (val: string) => {
    setSearch(val);
    if (val.length >= 3) {
      setIsSearching(true);
      try {
        const q = query(
          collection(db, 'individuals'),
          where('nome', '>=', val.toUpperCase()),
          where('nome', '<=', val.toUpperCase() + '\uf8ff'),
          limit(5)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Individual));
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch (err) {
        console.error("Erro ao buscar indivíduos:", err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectIndividual = (ind: Individual) => {
    setFormData(prev => ({
      ...prev,
      individuo_id: ind.id,
      individuo_nome: ind.nome
    }));
    setSearch(ind.nome);
    setShowSuggestions(false);
  };

  const handleSave = async () => {
    if (!formData.individuo_id || !formData.local || !formData.data || !formData.horario) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSaving(true);
    try {
      const approachData: Omit<DBApproach, 'id'> = {
        data: formData.data,
        horario: formData.horario,
        local: formData.local,
        relatorio: 'VISUALIZADO (REGISTRO RÁPIDO SAW)',
        individuo_id: formData.individuo_id,
        individuo_nome: formData.individuo_nome,
        unidade: user?.unidade || 'N/I',
        criado_por: user?.nome || 'Sistema',
        created_at: new Date().toISOString(),
        is_saw: true
      };

      await addDoc(collection(db, 'approaches'), approachData);

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'SAW_REGISTERED',
        `Registro rápido SAW para o indivíduo ${formData.individuo_nome} no local ${formData.local}.`,
        { individuo_id: formData.individuo_id }
      );

      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar SAW:", err);
      handleFirestoreError(err, OperationType.WRITE, 'approaches');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-navy-100 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
        <div className="bg-navy-50 p-6 border-b border-navy-100 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-navy-900 p-3 rounded-2xl shadow-lg shadow-navy-900/20">
              <i className="fas fa-eye text-white text-xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter leading-none">Registro Rápido SAW</h3>
              <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-2">Visualização de Indivíduo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors p-2"><i className="fas fa-times text-xl"></i></button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          {error ? (
            <div className="bg-red-50 border border-red-100 p-6 rounded-2xl text-center">
              <i className="fas fa-exclamation-triangle text-red-500 text-3xl mb-4"></i>
              <p className="text-red-600 font-black uppercase text-xs tracking-widest">{error}</p>
              <p className="text-navy-400 text-[10px] mt-2 font-bold uppercase">É necessário um serviço ativo para registrar visualizações.</p>
            </div>
          ) : (
            <>
              {/* Individual Selection */}
              {!individual && (
                <div className="relative" ref={searchRef}>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Indivíduo Visualizado</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Pesquisar por nome..." 
                      value={search}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-12 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase text-sm"
                    />
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-navy-300"></i>
                    {isSearching && <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-navy-400"></i>}
                  </div>
                  
                  {showSuggestions && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-navy-100 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
                      {suggestions.map(ind => (
                        <button
                          key={ind.id}
                          onClick={() => selectIndividual(ind)}
                          className="w-full p-4 hover:bg-navy-50 text-left border-b border-navy-50 last:border-0 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 bg-navy-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="fas fa-user text-navy-400 text-xs"></i>
                          </div>
                          <div>
                            <p className="text-xs font-black text-navy-950 uppercase">{ind.nome}</p>
                            {ind.alcunha && <p className="text-[9px] text-navy-400 font-bold uppercase">"{ind.alcunha}"</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {individual && (
                <div className="bg-navy-50 border border-navy-100 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <i className="fas fa-user text-white text-xl"></i>
                  </div>
                  <div>
                    <h4 className="text-navy-950 font-black uppercase text-sm leading-none">{individual.nome}</h4>
                    <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1.5">Indivíduo Selecionado</p>
                  </div>
                </div>
              )}

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Data</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={formData.data}
                      onChange={(e) => { setFormData({...formData, data: e.target.value}); setIsManualDateTime(true); }}
                      className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-4 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Horário</label>
                  <div className="relative">
                    <input 
                      type="time" 
                      value={formData.horario}
                      onChange={(e) => { setFormData({...formData, horario: e.target.value}); setIsManualDateTime(true); }}
                      className="w-full bg-navy-50 border border-navy-100 rounded-2xl px-4 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest">Local da Visualização</label>
                  <button 
                    type="button"
                    onClick={() => setIsMapOpen(true)}
                    className="text-[9px] font-black text-forest-600 uppercase tracking-widest hover:text-forest-700 flex items-center gap-1"
                  >
                    <i className="fas fa-map-marker-alt"></i> Usar GPS
                  </button>
                </div>
                <div className="relative group">
                  <input 
                    type="text" 
                    ref={localAddressRef}
                    value={formData.local}
                    onChange={(e) => setFormData({...formData, local: e.target.value})}
                    placeholder="Rua, Número, Bairro..."
                    className="w-full bg-navy-50 border border-navy-100 rounded-2xl pl-12 pr-4 py-4 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold text-sm"
                  />
                  <i className="fas fa-location-dot absolute left-4 top-1/2 -translate-y-1/2 text-navy-300 group-focus-within:text-navy-900"></i>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-8 bg-navy-50 border-t border-navy-100 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 bg-white hover:bg-gray-50 text-navy-900 font-black py-4 rounded-2xl uppercase text-xs transition-all active:scale-95 border border-navy-200"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !!error || !formData.individuo_id || !formData.local}
            className="flex-[2] bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white font-black py-4 rounded-2xl uppercase text-xs transition-all shadow-xl shadow-navy-900/20 active:scale-95 flex items-center justify-center gap-2"
          >
            {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-eye"></i>}
            {isSaving ? 'Registrando...' : 'Confirmar Visualização'}
          </button>
        </div>
      </div>

      {isMapOpen && (
        <LocationPickerModal 
          onClose={() => setIsMapOpen(false)}
          onConfirm={(addr) => setFormData({...formData, local: addr})}
        />
      )}
    </div>
  );
};

export default SawModal;
