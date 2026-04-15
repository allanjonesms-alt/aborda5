
import React, { useState, useRef, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, addDoc, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { maskCPF, validateCPF, allowedCities, checkCity, getCityFromAddressComponents } from '../lib/utils';
import { User as AppUser, Individual, Relationship } from '../types';
import EditIndividualModal from './EditIndividualModal';
import { loadGoogleMaps } from '../lib/googleMaps';
import RelationshipSection from './RelationshipSection';

interface PhotoRecordUI {
  id: string;
  data: string;
  isPrincipal: boolean;
}

interface AttachmentUI {
  id: string;
  nome_arquivo: string;
  tipo_mime: string;
  data: string;
}

interface AddIndividualModalProps {
  currentUser: AppUser | null;
  onClose: () => void;
  onSave: () => void;
}

const FACCOES_OPTIONS = [
  { value: '', label: 'Selecione:' },
  { value: 'PCC', label: 'PCC (Primeiro Comando da Capital)' },
  { value: 'CV', label: 'CV (Comando Vermelho)' },
  { value: 'TCP', label: 'TCP (Terceiro Comando Puro)' },
  { value: 'GDE', label: 'GDE (Guardioes do Estado)' },
  { value: 'BDM', label: 'BDM (Bonde do Maluco)' },
  { value: 'SDC', label: 'SDC (Sindicato do Crime)' },
  { value: 'FDN', label: 'FDN (Família do Norte)' }
];

const AddIndividualModal: React.FC<AddIndividualModalProps> = ({ currentUser, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    nome: '',
    alcunha: '',
    data_nascimento: '',
    documento: '',
    mae: '',
    endereco: '',
    cidade: '',
    faccao: '',
    observacao: ''
  });
  const [photos, setPhotos] = useState<PhotoRecordUI[]>([]);
  const [attachments, setAttachments] = useState<AttachmentUI[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [cpfError, setCpfError] = useState(false);
  
  const [isAddingConfidential, setIsAddingConfidential] = useState(false);
  const [newConfidentialText, setNewConfidentialText] = useState('');
  const [tempConfidentialRecords, setTempConfidentialRecords] = useState<{conteudo: string, created_at: string}[]>([]);
  
  // Estados para Homônimos e CPF Duplicado
  const [homonyms, setHomonyms] = useState<any[]>([]);
  const [showHomonymAlert, setShowHomonymAlert] = useState(false);
  const [cpfDuplicate, setCpfDuplicate] = useState<any>(null);
  const [showCpfAlert, setShowCpfAlert] = useState(false);
  const [confirmedHomonym, setConfirmedHomonym] = useState(false);
  const [isCheckingHomonym, setIsCheckingHomonym] = useState(false);
  
  // Estado para Edição de Homônimo selecionado
  const [editingHomonym, setEditingHomonym] = useState<Individual | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteInstance = useRef<any>(null);

  const initAutocomplete = () => {
    if (!addressInputRef.current || !(window as any).google || !(window as any).google.maps || !(window as any).google.maps.places) return;

    try {
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

      autocompleteInstance.current = new google.maps.places.Autocomplete(
        addressInputRef.current, 
        options
      );

      autocompleteInstance.current.addListener('place_changed', () => {
        const place = autocompleteInstance.current.getPlace();
        if (!place.formatted_address) return;

        if (!checkCity(place.address_components || [])) {
          alert(`LOCAL FORA DE ÁREA!\n\nAs buscas estão restritas às cidades permitidas:\n${allowedCities.join(', ')}`);
          if (addressInputRef.current) addressInputRef.current.value = '';
          setFormData(prev => ({ ...prev, endereco: '' }));
          return;
        }

        setFormData(prev => ({ ...prev, endereco: place.formatted_address, cidade: getCityFromAddressComponents(place.address_components || []) }));
      });
    } catch (err) {
      console.error("Erro ao inicializar Autocomplete:", err);
    }
  };

  useEffect(() => {
    const setup = async () => {
      try {
        await loadGoogleMaps();
        initAutocomplete();
      } catch (err) {
        console.error("Erro ao carregar Google Maps no AddIndividualModal:", err);
      }
    };

    setup();
    const timer = setTimeout(initAutocomplete, 1000);
    return () => clearTimeout(timer);
  }, []);

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

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          setAttachments(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            nome_arquivo: file.name,
            tipo_mime: file.type,
            data: base64String
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCPF(e.target.value);
    setFormData({ ...formData, documento: masked });
    if (masked.length === 14) setCpfError(!validateCPF(masked));
    else setCpfError(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const performSave = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const indRef = doc(collection(db, 'individuals'));
      
      const now = new Date().toISOString();
      const individualData = {
        ...formData,
        nome: formData.nome.trim().toUpperCase(),
        mae: formData.mae?.trim().toUpperCase() || '',
        unidade: currentUser?.unidade || '',
        created_at: now,
        updated_at: now
      };

      batch.set(indRef, individualData);

      photos.forEach((p, i) => {
        const photoRef = doc(collection(db, 'individual_photos'));
        batch.set(photoRef, {
          individuo_id: indRef.id,
          path: p.data,
          is_primary: p.isPrincipal,
          sort_order: i,
          created_by: currentUser?.nome || 'Sistema',
          created_at: now
        });
      });

      attachments.forEach((a) => {
        const attRef = doc(collection(db, 'individual_attachments'));
        batch.set(attRef, {
          individuo_id: indRef.id,
          nome_arquivo: a.nome_arquivo,
          tipo_mime: a.tipo_mime,
          path: a.data,
          created_by: currentUser?.nome || 'Sistema',
          created_at: now
        });
      });

      relationships.forEach((rel) => {
        const relRef = doc(collection(db, 'individual_relationships'));
        batch.set(relRef, {
          individuo_id: indRef.id,
          relacionado_id: rel.relacionado_id,
          tipo: rel.tipo,
          created_by: currentUser?.nome || 'Sistema',
          created_at: now
        });
      });

      await batch.commit();

      // 4. Salvar Informações Sigilosas
      for (const record of tempConfidentialRecords) {
        await addDoc(collection(db, 'confidential_info'), {
          individuo_id: indRef.id,
          conteudo: record.conteudo,
          operador_nome: currentUser?.nome || 'Operador Desconhecido',
          operador_id: currentUser?.id || '',
          created_at: record.created_at
        });
      }

      await logAction(
        currentUser?.id || '',
        currentUser?.nome || 'Sistema',
        'INDIVIDUAL_CREATED',
        `Novo cadastro de indivíduo: ${formData.nome.toUpperCase()}`,
        { individualId: indRef.id }
      );

      onSave();
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'individuals/batch');
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const checkHomonyms = async (nome: string) => {
    if (!nome || nome.length < 3 || confirmedHomonym) return;
    
    setIsCheckingHomonym(true);
    const nomeUpper = nome.toUpperCase();
    
    try {
      const q = query(collection(db, 'individuals'), where('nome', '==', nomeUpper));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const matches = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
          try {
            const data = docSnap.data();
            // Fetch photos for each match
            const photosQ = query(collection(db, 'individual_photos'), where('individuo_id', '==', docSnap.id));
            const photosSnap = await getDocs(photosQ);
            const photosData = photosSnap.docs.map(p => p.data());
            return { id: docSnap.id, ...data, fotos_individuos: photosData };
          } catch (err) {
            console.error(`Erro ao buscar fotos do homônimo ${docSnap.id}:`, err);
            return { id: docSnap.id, ...docSnap.data(), fotos_individuos: [] };
          }
        }));
        setHomonyms(matches);
        setShowHomonymAlert(true);
      }
    } catch (err) {
      console.error("Erro ao checar homônimos:", err);
      handleFirestoreError(err, OperationType.LIST, 'individuals');
    } finally {
      setIsCheckingHomonym(false);
    }
  };

  const handleOpenHomonymForEdit = async (h: any) => {
    try {
      const photosQ = query(collection(db, 'individual_photos'), where('individuo_id', '==', h.id));
      const photosSnap = await getDocs(photosQ);
      const photosData = photosSnap.docs.map(p => ({ id: p.id, ...p.data() }));

      setEditingHomonym({ id: h.id, ...h, fotos_individuos: photosData } as Individual);
    } catch (err) {
      console.error("Erro ao abrir homônimo para edição:", err);
      handleFirestoreError(err, OperationType.LIST, 'individual_photos');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome) return alert('Nome é obrigatório.');
    
    if (formData.documento) {
      if (!validateCPF(formData.documento)) {
        alert('CPF inválido.');
        return;
      }

      // 1. Bloqueio de CPF Duplicado
      try {
        const q = query(collection(db, 'individuals'), where('documento', '==', formData.documento));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const existingCpf = docSnap.data();
          
          // Buscar fotos para exibir no modal
          const photosQ = query(collection(db, 'individual_photos'), where('individuo_id', '==', docSnap.id));
          const photosSnap = await getDocs(photosQ);
          const photosData = photosSnap.docs.map(p => p.data());
          
          setCpfDuplicate({ id: docSnap.id, ...existingCpf, fotos_individuos: photosData });
          setShowCpfAlert(true);
          return;
        }
      } catch (err) {
        console.error("Erro ao verificar CPF duplicado:", err);
        handleFirestoreError(err, OperationType.LIST, 'individuals');
      }
    }

    // A verificação de homônimo já deve ter ocorrido no onBlur ou será confirmada aqui
    if (!confirmedHomonym) {
      const nomeUpper = formData.nome.toUpperCase();
      try {
        const q = query(collection(db, 'individuals'), where('nome', '==', nomeUpper));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const matches = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
            try {
              const data = docSnap.data();
              const photosQ = query(collection(db, 'individual_photos'), where('individuo_id', '==', docSnap.id));
              const photosSnap = await getDocs(photosQ);
              const photosData = photosSnap.docs.map(p => p.data());
              return { id: docSnap.id, ...data, fotos_individuos: photosData };
            } catch (err) {
              console.error(`Erro ao buscar fotos do homônimo ${docSnap.id}:`, err);
              return { id: docSnap.id, ...docSnap.data(), fotos_individuos: [] };
            }
          }));
          setHomonyms(matches);
          setShowHomonymAlert(true);
          return;
        }
      } catch (err) {
        console.error("Erro ao verificar homônimos no submit:", err);
        handleFirestoreError(err, OperationType.LIST, 'individuals');
      }
    }

    await performSave();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-white border border-navy-100 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-300">
          <div className="bg-navy-50 p-6 border-b border-navy-100 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="bg-navy-900 p-2 rounded-lg"><i className="fas fa-user-plus text-white"></i></div>
              <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">NOVO CADASTRO</h3>
            </div>
            <button onClick={onClose} className="text-navy-400 hover:text-navy-900 p-2 transition-colors"><i className="fas fa-times text-2xl"></i></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Nome Completo</label>
                <div className="relative">
                  <input 
                    type="text" 
                    className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold uppercase" 
                    value={formData.nome} 
                    onChange={e => { 
                      setFormData({...formData, nome: e.target.value.toUpperCase()}); 
                      setConfirmedHomonym(false); 
                    }} 
                    onBlur={() => checkHomonyms(formData.nome)}
                    required 
                    placeholder="NOME DO ABORDADO" 
                  />
                  {isCheckingHomonym && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <i className="fas fa-spinner fa-spin text-navy-600 text-xs"></i>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Alcunha / Vulgo</label>
                <input type="text" className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold" value={formData.alcunha} onChange={e => setFormData({...formData, alcunha: e.target.value})} placeholder="VULGO" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Data de Nascimento</label>
                <input type="date" className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold" value={formData.data_nascimento} onChange={e => setFormData({...formData, data_nascimento: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">CPF</label>
                <input type="text" className={`w-full bg-white border ${cpfError ? 'border-red-500' : 'border-navy-200'} rounded-xl px-4 py-3 text-navy-950 outline-none font-bold`} value={formData.documento} onChange={handleCpfChange} maxLength={14} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Facção</label>
                <select className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none appearance-none font-bold" value={formData.faccao} onChange={e => setFormData({...formData, faccao: e.target.value})}>
                  {FACCOES_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Endereço Residencial (Google Autocomplete)</label>
                <div className="relative group">
                  <input 
                    type="text" 
                    ref={addressInputRef}
                    className="w-full bg-white border border-navy-200 rounded-xl pl-10 pr-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-500 transition-all font-bold" 
                    placeholder="Rua, Número, Bairro, Cidade"
                    defaultValue={formData.endereco}
                  />
                  <i className="fas fa-search-location absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 group-focus-within:text-navy-500 transition-all"></i>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Filiação Materna</label>
                <input type="text" className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold uppercase" value={formData.mae} onChange={e => setFormData({...formData, mae: e.target.value.toUpperCase()})} placeholder="NOME DA MÃE" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Observações / Histórico Relevante</label>
                <textarea 
                  className="w-full bg-white border border-navy-200 text-navy-950 p-4 rounded-xl outline-none font-bold text-sm min-h-[100px] resize-none" 
                  placeholder="Informações adicionais sobre o abordado..."
                  value={formData.observacao} 
                  onChange={e => setFormData({...formData, observacao: e.target.value})}
                />
              </div>

              {(currentUser?.unidade === 'FORÇA TÁTICA' || currentUser?.unidades_extras?.includes('FORÇA TÁTICA') || currentUser?.role === 'MASTER') && (
                <div className="md:col-span-3 space-y-4 pt-4 border-t border-red-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-black text-red-600 uppercase tracking-widest">Inteligência / Informações Sigilosas</label>
                      {tempConfidentialRecords.length > 0 && (
                        <span className="text-[10px] font-black text-navy-600 uppercase tracking-widest">
                          {tempConfidentialRecords.length} registro(s) pendente(s)
                        </span>
                      )}
                    </div>
                    
                    {!isAddingConfidential ? (
                      <button
                        type="button"
                        onClick={() => setIsAddingConfidential(true)}
                        className="w-full bg-red-50 border-2 border-dashed border-red-300 text-red-600 font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-plus-circle"></i> Cadastrar Informação Sigilosa
                      </button>
                    ) : (
                      <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <textarea 
                          className="w-full bg-white border-2 border-red-500 rounded-2xl px-4 py-3 text-navy-950 outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold min-h-[120px] resize-none text-sm" 
                          value={newConfidentialText} 
                          onChange={e => setNewConfidentialText(e.target.value)}
                          placeholder="Digite a nova informação sigilosa aqui... (Será registrado com seu nome e data atual)"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!newConfidentialText.trim()) return;
                              setTempConfidentialRecords([...tempConfidentialRecords, {
                                conteudo: newConfidentialText.trim(),
                                created_at: new Date().toISOString()
                              }]);
                              setNewConfidentialText('');
                              setIsAddingConfidential(false);
                            }}
                            className="flex-1 bg-red-600 text-white font-black py-3 rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all"
                          >
                            <i className="fas fa-check mr-2"></i>
                            Adicionar ao Cadastro
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingConfidential(false);
                              setNewConfidentialText('');
                            }}
                            className="px-6 bg-gray-200 text-navy-600 font-black py-3 rounded-xl uppercase text-[10px] tracking-widest hover:bg-gray-300 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {tempConfidentialRecords.length > 0 && (
                      <div className="space-y-2">
                        {tempConfidentialRecords.map((rec, idx) => (
                          <div key={idx} className="bg-red-50 border border-red-100 rounded-xl p-3 flex justify-between items-start">
                            <p className="text-xs text-navy-900 font-bold line-clamp-2">{rec.conteudo}</p>
                            <button 
                              type="button"
                              onClick={() => setTempConfidentialRecords(tempConfidentialRecords.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-600"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            <RelationshipSection 
              relationships={relationships}
              onAdd={(rel) => setRelationships(prev => [...prev, { ...rel, id: Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() } as Relationship])}
              onRemove={(id) => setRelationships(prev => prev.filter(r => r.id !== id))}
            />

            <div className="space-y-4 pt-4 border-t border-navy-100">
              <div className="flex items-center justify-between mb-2">
                 <h4 className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Documentos em Anexo</h4>
                 <button type="button" onClick={() => attachmentInputRef.current?.click()} className="text-navy-900 hover:text-navy-700 text-[10px] font-black uppercase flex items-center bg-navy-100 px-3 py-2 rounded-lg border border-navy-200 transition-all">
                  <i className="fas fa-paperclip mr-2"></i> Adicionar Anexo
                </button>
                <input type="file" ref={attachmentInputRef} onChange={handleAttachmentChange} className="hidden" multiple />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map(att => (
                  <div key={att.id} className="bg-navy-50 border border-navy-100 rounded-xl p-3 flex items-center justify-between group">
                    <div className="flex items-center overflow-hidden">
                      <i className="fas fa-file-alt text-navy-400 mr-3"></i>
                      <span className="text-xs text-navy-900 font-bold truncate uppercase">{att.nome_arquivo}</span>
                    </div>
                    <button type="button" onClick={() => removeAttachment(att.id)} className="text-navy-400 hover:text-red-500 ml-2 transition-colors"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-navy-100">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest">Fotos de Identificação</label>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-navy-900 hover:text-navy-700 text-[10px] font-black uppercase flex items-center transition-all">
                  <i className="fas fa-camera mr-2"></i> Registrar Foto
                </button>
                <input type="file" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" multiple accept="image/*" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className={`relative aspect-square rounded-xl border-2 overflow-hidden transition-all ${photo.isPrincipal ? 'border-navy-900 ring-2 ring-navy-900/10' : 'border-navy-100'}`}>
                    <img src={photo.data} className="w-full h-full object-cover" alt="Abordado" />
                    {photo.isPrincipal && <div className="absolute top-1 left-1 bg-navy-900 text-[8px] font-black text-white px-1.5 rounded uppercase">Capa</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-navy-100">
              <button type="button" onClick={onClose} className="flex-1 bg-navy-50 text-navy-900 font-black py-4 rounded-xl uppercase text-xs transition-all hover:bg-navy-100 active:scale-95 border border-navy-100">Cancelar</button>
              <button type="submit" disabled={isSaving} className="flex-1 bg-navy-900 text-white font-black py-4 rounded-xl uppercase text-xs shadow-lg shadow-navy-900/20 transition-all hover:bg-navy-800 active:scale-95">
                {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : 'Sincronizar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* MODAL DE ALERTA DE HOMÔNIMO */}
      {showHomonymAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white border-2 border-navy-900 w-full max-w-2xl rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,128,0.2)] overflow-hidden">
            <div className="bg-navy-900 p-6 flex items-center gap-4">
              <i className="fas fa-exclamation-triangle text-white text-3xl animate-pulse"></i>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Alerta de Homônimo</h3>
                <p className="text-navy-200 text-[10px] font-bold uppercase tracking-widest">Já existem registros com este nome no sistema</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <p className="text-navy-600 text-sm font-medium leading-relaxed">
                Detectamos indivíduos cadastrados com o nome <span className="text-navy-950 font-black">"{formData.nome}"</span>. 
                Por favor, verifique se o abordado já possui ficha ativa antes de criar um novo cadastro duplicado.
              </p>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {homonyms.map((h) => {
                  const capa = h.fotos_individuos?.find((f: any) => f.is_primary)?.path || h.fotos_individuos?.[0]?.path;
                  return (
                    <div 
                      key={h.id} 
                      onClick={() => handleOpenHomonymForEdit(h)}
                      className="bg-navy-50 border border-navy-100 rounded-2xl p-4 flex items-center gap-4 hover:border-navy-900 group cursor-pointer transition-all"
                    >
                      <div className="w-16 h-16 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-navy-100">
                        {capa ? <img src={capa} className="w-full h-full object-cover" /> : <i className="fas fa-user-secret text-navy-200 text-2xl flex items-center justify-center h-full"></i>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-navy-950 font-black uppercase text-sm truncate">{h.nome}</p>
                          <span className="text-navy-900 text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Visualizar Ficha <i className="fas fa-external-link-alt ml-1"></i></span>
                        </div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] text-navy-900 font-bold uppercase">Vulgo: {h.alcunha || 'N/I'}</span>
                          <span className="text-[10px] text-navy-400 font-bold uppercase">Nascimento: {h.data_nascimento ? new Date(h.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-navy-100">
                <button 
                  onClick={() => setShowHomonymAlert(false)}
                  className="flex-1 bg-navy-50 hover:bg-navy-100 text-navy-900 font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest transition-all border border-navy-100"
                >
                  Fechar Alerta
                </button>
                <button 
                  onClick={async () => {
                    setConfirmedHomonym(true);
                    setShowHomonymAlert(false);
                  }}
                  className="flex-1 bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-navy-900/20 transition-all"
                >
                  Continuar com Novo Cadastro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTA DE CPF DUPLICADO */}
      {showCpfAlert && cpfDuplicate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-red-950/95 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-white border-2 border-red-600 w-full max-w-2xl rounded-[2.5rem] shadow-[0_0_50px_rgba(220,38,38,0.2)] overflow-hidden">
            <div className="bg-red-600 p-6 flex items-center gap-4">
              <i className="fas fa-ban text-white text-3xl animate-pulse"></i>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">CPF Já Cadastrado</h3>
                <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest">Cadastro Bloqueado</p>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <p className="text-navy-950 text-sm font-medium leading-relaxed">
                O CPF <span className="text-red-600 font-black">{formData.documento}</span> já está vinculado ao indivíduo abaixo. 
                Não é permitido duplicar cadastros por CPF.
              </p>

              <div 
                onClick={() => handleOpenHomonymForEdit(cpfDuplicate)}
                className="bg-navy-50 border border-navy-100 rounded-2xl p-4 flex items-center gap-4 hover:border-navy-900 group cursor-pointer transition-all"
              >
                <div className="w-16 h-16 bg-white rounded-xl overflow-hidden flex-shrink-0 border border-navy-100">
                  {cpfDuplicate.fotos_individuos?.find((f: any) => f.is_primary)?.path || cpfDuplicate.fotos_individuos?.[0]?.path ? 
                    <img src={cpfDuplicate.fotos_individuos?.find((f: any) => f.is_primary)?.path || cpfDuplicate.fotos_individuos?.[0]?.path} className="w-full h-full object-cover" /> : 
                    <i className="fas fa-user-secret text-navy-200 text-2xl flex items-center justify-center h-full"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-navy-950 font-black uppercase text-sm truncate">{cpfDuplicate.nome}</p>
                    <span className="text-navy-900 text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity">Visualizar Ficha <i className="fas fa-external-link-alt ml-1"></i></span>
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-navy-900 font-bold uppercase">Vulgo: {cpfDuplicate.alcunha || 'N/I'}</span>
                    <span className="text-[10px] text-navy-400 font-bold uppercase">Nascimento: {cpfDuplicate.data_nascimento ? new Date(cpfDuplicate.data_nascimento + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-navy-100">
                <button 
                  onClick={() => setShowCpfAlert(false)}
                  className="w-full bg-navy-900 hover:bg-navy-800 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-widest shadow-xl shadow-navy-900/20 transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DO HOMÔNIMO SELECIONADO */}
      {editingHomonym && (
        <EditIndividualModal 
          individual={editingHomonym}
          currentUser={currentUser}
          onClose={() => setEditingHomonym(null)}
          onSave={() => {
            setEditingHomonym(null);
            // Ao salvar o existente, podemos fechar o alerta de homônimo
            setShowHomonymAlert(false);
            // Recarrega lista de homônimos se necessário
            checkHomonyms(formData.nome);
          }}
        />
      )}
    </>
  );
};

export default AddIndividualModal;
