
import React, { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, orderBy } from 'firebase/firestore';
import { Individual, User, PhotoRecord, Relationship, Attachment, DBApproach } from '../types';
import { maskCPF, validateCPF, allowedCities, checkCity, formatAddress } from '../lib/utils';
import { loadGoogleMaps } from '../lib/googleMaps';
import RelationshipSection from './RelationshipSection';

interface AttachmentViewerModalProps {
  attachment: Attachment;
  onClose: () => void;
}

const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({ attachment, onClose }) => {
  const isImage = attachment.tipo_mime.startsWith('image/');
  const isPdf = attachment.tipo_mime === 'application/pdf';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/95 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="bg-white border border-navy-100 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-navy-50 p-4 border-b border-navy-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <i className={`fas ${isImage ? 'fa-image' : 'fa-file-pdf'} text-navy-600`}></i>
            <h3 className="text-sm font-black text-navy-950 uppercase tracking-tighter truncate max-w-xs">{attachment.nome_arquivo}</h3>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors"><i className="fas fa-times text-xl"></i></button>
        </div>
        
        <div className="flex-1 overflow-auto bg-white p-4 flex items-center justify-center">
          {isImage ? (
            <img src={attachment.path} className="max-w-full max-h-full object-contain" alt={attachment.nome_arquivo} />
          ) : isPdf ? (
            <iframe src={attachment.path} className="w-full h-[60vh]" title={attachment.nome_arquivo}></iframe>
          ) : (
            <div className="text-center py-20">
              <i className="fas fa-file-download text-5xl text-navy-200 mb-4"></i>
              <p className="text-navy-600 font-bold">Visualização não disponível para este formato.</p>
              <a href={attachment.path} download={attachment.nome_arquivo} className="mt-4 inline-block bg-navy-900 text-white px-6 py-2 rounded-xl font-black uppercase text-xs">Baixar Arquivo</a>
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-navy-100">
          <h4 className="text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Legenda / Descrição do Documento</h4>
          <p className="text-navy-900 text-sm font-medium leading-relaxed italic">
            {attachment.legenda || 'Sem legenda cadastrada.'}
          </p>
          <div className="mt-4 pt-4 border-t border-navy-100 flex justify-between items-center">
             <span className="text-[9px] text-navy-400 font-bold uppercase">Anexado por: {attachment.created_by}</span>
             <span className="text-[9px] text-navy-400 font-bold uppercase">{new Date(attachment.created_at).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface EditIndividualModalProps {
  individual: Individual;
  onClose: () => void;
  onSave: (updated: Individual) => void;
  currentUser: User | null;
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

const EditIndividualModal: React.FC<EditIndividualModalProps> = ({ individual, onClose, onSave, currentUser }) => {
  const [formData, setFormData] = useState<Individual>({ ...individual });
  const [isSaving, setIsSaving] = useState(false);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [approachesHistory, setApproachesHistory] = useState<DBApproach[]>([]);
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);
  const [cpfError, setCpfError] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  
  const photos = individual.fotos_individuos || [];
  const initialIndex = photos.findIndex(p => p.is_primary);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialIndex !== -1 ? initialIndex : 0);
  
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteInstance = useRef<any>(null);

  const initAutocomplete = () => {
    if (!isEditing || !addressInputRef.current || !(window as any).google || !(window as any).google.maps || !(window as any).google.maps.places) return;

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

        setFormData(prev => ({ ...prev, endereco: place.formatted_address }));
      });
    } catch (err) {
      console.error("Erro no Autocomplete:", err);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    fetchRelationships();
    fetchAttachments();
    fetchApproachesHistory();

    const setup = async () => {
      try {
        await loadGoogleMaps();
        if (isEditing) initAutocomplete();
      } catch (err) {
        console.error("Erro ao carregar Google Maps no EditIndividualModal:", err);
      }
    };

    setup();
    const timer = setTimeout(() => { if (isEditing) initAutocomplete(); }, 1000);
    return () => {
      document.body.style.overflow = 'unset';
      clearTimeout(timer);
    };
  }, [individual.id]);

  const fetchRelationships = async () => {
    try {
      const q = query(collection(db, 'individual_relationships'), where('individuo_id', '==', individual.id));
      const querySnapshot = await getDocs(q);
      const rels = await Promise.all(querySnapshot.docs.map(async (docSnap) => {
        try {
          const data = docSnap.data();
          const relIndSnap = await getDoc(doc(db, 'individuals', data.relacionado_id));
          const relIndData = relIndSnap.data();
          return { 
            id: docSnap.id, 
            ...data, 
            relacionado_nome: relIndData?.nome, 
            relacionado_alcunha: relIndData?.alcunha 
          } as Relationship;
        } catch (err) {
          console.error(`Erro ao buscar indivíduo relacionado ${docSnap.id}:`, err);
          return { id: docSnap.id, ...docSnap.data() } as Relationship;
        }
      }));
      setRelationships(rels);
    } catch (err) {
      console.error("Erro ao buscar relacionamentos:", err);
      handleFirestoreError(err, OperationType.LIST, 'individual_relationships');
    }
  };

  const fetchAttachments = async () => {
    try {
      const q = query(
        collection(db, 'individual_attachments'), 
        where('individuo_id', '==', individual.id),
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Attachment));
      setAttachments(data);
    } catch (err) {
      console.error("Erro ao buscar anexos:", err);
      handleFirestoreError(err, OperationType.LIST, 'individual_attachments');
    }
  };

  const fetchApproachesHistory = async () => {
    try {
      const q = query(
        collection(db, 'approaches'), 
        where('individuo_id', '==', individual.id),
        orderBy('data', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DBApproach));
      setApproachesHistory(data);
    } catch (err) {
      console.error("Erro ao buscar histórico de abordagens:", err);
      handleFirestoreError(err, OperationType.LIST, 'approaches');
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCPF(e.target.value);
    setFormData({ ...formData, documento: masked });
    if (masked.length === 14) setCpfError(!validateCPF(masked));
    else setCpfError(false);
  };

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const legenda = window.prompt(`Informe uma LEGENDA para o arquivo: ${file.name}`);
      
      if (legenda === null) {
        if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          await addDoc(collection(db, 'individual_attachments'), {
            individuo_id: individual.id,
            nome_arquivo: file.name,
            tipo_mime: file.type,
            path: base64String,
            legenda: legenda || '',
            created_by: currentUser?.nome || 'Sistema',
            created_at: new Date().toISOString()
          });
          fetchAttachments();
        } catch (err) {
          console.error("Erro ao adicionar anexo:", err);
          handleFirestoreError(err, OperationType.WRITE, 'individual_attachments');
        }
      };
      reader.readAsDataURL(file);
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleEditLegenda = async (attachment: Attachment) => {
    const novaLegenda = window.prompt(`Editar legenda para: ${attachment.nome_arquivo}`, attachment.legenda || '');
    if (novaLegenda !== null) {
      try {
        await updateDoc(doc(db, 'individual_attachments', attachment.id), {
          legenda: novaLegenda
        });
        fetchAttachments();
      } catch (err) {
        console.error("Erro ao atualizar legenda:", err);
        handleFirestoreError(err, OperationType.UPDATE, `individual_attachments/${attachment.id}`);
        alert('Erro ao atualizar legenda.');
      }
    }
  };

  const handleAddRelationship = async (rel: Omit<Relationship, 'id' | 'created_at'>) => {
    try {
      await addDoc(collection(db, 'individual_relationships'), {
        individuo_id: individual.id,
        relacionado_id: rel.relacionado_id,
        tipo: rel.tipo,
        created_by: currentUser?.nome || 'Sistema',
        created_at: new Date().toISOString()
      });
      fetchRelationships();
    } catch (err) {
      console.error("Erro ao adicionar relacionamento:", err);
      handleFirestoreError(err, OperationType.WRITE, 'individual_relationships');
    }
  };

  const removeRelationship = async (id: string) => {
    if (!confirm('Excluir este relacionamento?')) return;
    try {
      await deleteDoc(doc(db, 'individual_relationships', id));
      fetchRelationships();
    } catch (err) {
      console.error("Erro ao excluir relacionamento:", err);
      handleFirestoreError(err, OperationType.DELETE, `individual_relationships/${id}`);
    }
  };

  const removeAttachment = async (id: string) => {
    if (!confirm('Excluir este anexo permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'individual_attachments', id));
      fetchAttachments();
    } catch (err) {
      console.error("Erro ao excluir anexo:", err);
      handleFirestoreError(err, OperationType.DELETE, `individual_attachments/${id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.documento && !validateCPF(formData.documento)) {
      alert('CPF inválido detectado. Verifique os dados antes de salvar.');
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'individuals', individual.id), {
        nome: formData.nome.toUpperCase(), 
        alcunha: formData.alcunha || '', 
        faccao: formData.faccao || '', 
        documento: formData.documento || '',
        mae: formData.mae?.toUpperCase() || '',
        endereco: formData.endereco || '',
        data_nascimento: formData.data_nascimento || '', 
        updated_at: new Date().toISOString()
      });

      await logAction(
        currentUser?.id || '',
        currentUser?.nome || 'Sistema',
        'INDIVIDUAL_EDITED',
        `Cadastro de indivíduo editado: ${formData.nome.toUpperCase()}`,
        { individualId: individual.id }
      );

      onSave(formData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `individuals/${individual.id}`);
      alert('Erro ao salvar alterações.');
    } finally { setIsSaving(false); }
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-white border border-navy-100 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto max-h-[90vh] flex flex-col">
          <div className="bg-navy-50 p-6 border-b border-navy-100 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="bg-navy-900 p-2 rounded-lg"><i className="fas fa-user text-white"></i></div>
              <h3 className="text-xl font-black text-navy-950 uppercase tracking-tighter">PERFIL DO INDIVÍDUO</h3>
            </div>
            <div className="flex items-center gap-3">
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-navy-600 hover:text-navy-900 transition-colors font-black uppercase text-xs">
                  <i className="fas fa-edit mr-2"></i> Editar
                </button>
              )}
              <button onClick={onClose} className="text-navy-400 hover:text-navy-900 transition-colors"><i className="fas fa-times text-xl"></i></button>
            </div>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            <div className="relative group bg-navy-50 rounded-xl border border-navy-100 overflow-hidden aspect-video flex items-center justify-center">
              {photos.length > 0 ? (
                <>
                  <img src={photos[currentPhotoIndex].path} className="w-full h-full object-contain animate-in fade-in duration-300" alt={`Foto ${currentPhotoIndex + 1}`} />
                  {photos[currentPhotoIndex].is_primary && (
                    <div className="absolute top-3 left-3 bg-navy-900 text-[10px] font-black text-white px-2 py-1 rounded-lg uppercase shadow-lg border border-navy-800/30">
                      <i className="fas fa-star mr-1"></i> Foto de Capa
                    </div>
                  )}
                  {photos.length > 1 && (
                    <div className="absolute top-3 right-3 bg-navy-900/60 backdrop-blur-md text-[10px] font-black text-white px-3 py-1 rounded-full border border-white/10 uppercase tracking-widest">
                      {currentPhotoIndex + 1} / {photos.length}
                    </div>
                  )}
                  {photos.length > 1 && (
                    <>
                      <button type="button" onClick={prevPhoto} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-navy-900 text-navy-900 hover:text-white w-10 h-10 rounded-full flex items-center justify-center transition-all border border-navy-100 shadow-xl opacity-0 group-hover:opacity-100"><i className="fas fa-chevron-left"></i></button>
                      <button type="button" onClick={nextPhoto} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-navy-900 text-navy-900 hover:text-white w-10 h-10 rounded-full flex items-center justify-center transition-all border border-navy-100 shadow-xl opacity-0 group-hover:opacity-100"><i className="fas fa-chevron-right"></i></button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center opacity-20">
                  <i className="fas fa-user-secret text-6xl text-navy-200"></i>
                  <span className="text-[10px] font-black uppercase mt-4 text-navy-950">Sem mídia registrada</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Nome Completo</label>
                      <input type="text" readOnly={!isEditing} className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase`} value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value.toUpperCase()})} />
                  </div>
                  
                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Alcunha (Vulgo)</label>
                      <input type="text" readOnly={!isEditing} className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold`} value={formData.alcunha || ''} onChange={e => setFormData({...formData, alcunha: e.target.value})} />
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Facção / Organização</label>
                      <select disabled={!isEditing} className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all appearance-none font-bold`} value={formData.faccao || ''} onChange={e => setFormData({...formData, faccao: e.target.value})}>
                        {FACCOES_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">CPF (Documento)</label>
                      <input 
                        type="text" 
                        readOnly={!isEditing}
                        className={`w-full bg-white border ${isEditing ? (cpfError ? 'border-red-500' : 'border-navy-200') : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold`} 
                        value={formData.documento || ''} 
                        onChange={handleCpfChange} 
                        maxLength={14}
                      />
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Data de Nascimento</label>
                      <input type="date" readOnly={!isEditing} className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold`} value={formData.data_nascimento || ''} onChange={e => setFormData({...formData, data_nascimento: e.target.value})} />
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Filiação Materna (Mãe)</label>
                      <input type="text" readOnly={!isEditing} className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold uppercase`} value={formData.mae || ''} onChange={e => setFormData({...formData, mae: e.target.value.toUpperCase()})} />
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Endereço Residencial</label>
                      <div className="relative group">
                        <input 
                          type="text" 
                          ref={addressInputRef}
                          readOnly={!isEditing}
                          className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl pl-10 pr-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold`} 
                          defaultValue={formData.endereco || ''} 
                          placeholder="Rua, Número, Bairro, Cidade" 
                        />
                        {isEditing && <i className="fas fa-search-location absolute left-3 top-1/2 -translate-y-1/2 text-navy-300 group-focus-within:text-navy-900"></i>}
                      </div>
                  </div>

                  <div>
                      <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-1">Observações / Histórico Relevante</label>
                      <textarea 
                        readOnly={!isEditing}
                        className={`w-full bg-white border ${isEditing ? 'border-navy-200' : 'border-transparent'} rounded-xl px-4 py-2 text-navy-950 outline-none focus:ring-2 focus:ring-navy-900 transition-all font-bold min-h-[100px] resize-none`} 
                        value={formData.observacao || ''} 
                        onChange={e => setFormData({...formData, observacao: e.target.value})}
                        placeholder="Informações adicionais sobre o abordado..."
                      />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-3 pt-4 border-t border-navy-100 sticky bottom-0 bg-white pb-2">
                    <button type="button" onClick={() => { setIsEditing(false); setFormData({...individual}); }} className="flex-1 bg-navy-50 text-navy-900 font-black py-3 rounded-xl uppercase text-xs hover:bg-navy-100 transition-colors border border-navy-100">Cancelar</button>
                    <button type="submit" disabled={isSaving} className="flex-1 bg-navy-900 text-white font-black py-3 rounded-xl uppercase text-xs hover:bg-navy-800 transition-colors shadow-lg shadow-navy-900/20">
                        {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>} Salvar Alterações
                    </button>
                  </div>
                )}

                <RelationshipSection 
                  relationships={relationships}
                  onAdd={handleAddRelationship}
                  onRemove={removeRelationship}
                  isEditing={isEditing}
                />

                <div className="space-y-4 pt-4 border-t border-navy-100">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Documentos em Anexo</h4>
                    {isEditing && (
                      <button type="button" onClick={() => attachmentInputRef.current?.click()} className="text-[9px] font-black uppercase text-navy-900 border border-navy-200 px-3 py-1.5 rounded-lg bg-navy-50 hover:bg-navy-100 transition-colors">
                        <i className="fas fa-paperclip mr-2"></i> Anexar Doc
                      </button>
                    )}
                    <input type="file" ref={attachmentInputRef} onChange={handleAddAttachment} className="hidden" />
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                    {attachments.map(att => (
                    <div key={att.id} className="bg-navy-50 border border-navy-100 rounded-lg p-2 flex items-center justify-between group">
                        <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center min-w-0">
                            <i className={`fas ${att.tipo_mime.startsWith('image/') ? 'fa-image' : 'fa-file-pdf'} text-navy-400 mr-2 text-xs flex-shrink-0`}></i>
                            <span className="text-[10px] text-navy-900 font-bold uppercase truncate">{att.nome_arquivo}</span>
                        </div>
                        {att.legenda && <span className="text-[8px] text-navy-400 font-bold uppercase truncate mt-0.5 ml-5">{att.legenda}</span>}
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-2">
                        <button type="button" onClick={() => setViewingAttachment(att)} className="text-navy-400 hover:text-navy-900 transition-all w-7 h-7 flex items-center justify-center rounded-full hover:bg-navy-100" title="Visualizar"><i className="fas fa-eye text-xs"></i></button>
                        {isEditing && (
                          <>
                            <button type="button" onClick={() => handleEditLegenda(att)} className="text-navy-400 hover:text-navy-900 transition-all w-7 h-7 flex items-center justify-center rounded-full hover:bg-navy-100" title="Editar Legenda"><i className="fas fa-pencil-alt text-xs"></i></button>
                            <button type="button" onClick={() => removeAttachment(att.id)} className="text-navy-400 hover:text-red-500 transition-all w-7 h-7 flex items-center justify-center rounded-full hover:bg-navy-100" title="Excluir"><i className="fas fa-trash-alt text-xs"></i></button>
                          </>
                        )}
                        </div>
                    </div>
                    ))}
                    {attachments.length === 0 && <p className="text-[9px] text-navy-400 italic">Nenhum documento anexo.</p>}
                </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-navy-100">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Histórico de Abordagens</h4>
                    <span className="text-[9px] font-black text-navy-400 uppercase bg-navy-50 px-2 py-1 rounded border border-navy-100">{approachesHistory.length} Registros</span>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                    {approachesHistory.map(app => (
                    <div key={app.id} className="bg-navy-50 border border-navy-100 rounded-lg p-3 flex flex-col gap-1.5 hover:bg-navy-100 transition-colors">
                        <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-history text-navy-600 text-[10px]"></i>
                            <span className="text-[10px] text-navy-900 font-black uppercase tracking-tighter">
                            {new Date(app.data).toLocaleDateString('pt-BR')} às {app.horario}
                            </span>
                        </div>
                        <span className="text-[9px] text-navy-500 font-bold uppercase truncate max-w-[100px]">
                            {app.criado_por || 'N/A'}
                        </span>
                        </div>
                        <div className="flex items-start gap-2">
                        <i className="fas fa-map-marker-alt text-red-500 text-[9px] mt-0.5"></i>
                        <div className="flex flex-col">
                          <p className="text-[10px] text-navy-600 font-bold uppercase truncate leading-tight">{formatAddress(app.local).street}</p>
                          {formatAddress(app.local).city && <p className="text-[10px] text-navy-600 font-bold uppercase truncate leading-tight">{formatAddress(app.local).city}</p>}
                        </div>
                        </div>
                    </div>
                    ))}
                    {approachesHistory.length === 0 && <p className="text-[9px] text-navy-400 italic">Sem histórico de abordagens registrado.</p>}
                </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-navy-100 sticky bottom-0 bg-white pb-2">
                <button type="button" onClick={onClose} className="flex-1 bg-navy-50 text-navy-900 font-black py-3 rounded-xl uppercase text-xs hover:bg-navy-100 transition-colors border border-navy-100">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-navy-900 text-white font-black py-3 rounded-xl uppercase text-xs hover:bg-navy-800 transition-colors shadow-lg shadow-navy-900/20">
                    {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>} Salvar Alterações
                </button>
                </div>
            </form>
          </div>
        </div>
      </div>

      {viewingAttachment && <AttachmentViewerModal attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />}
    </>
  );
};

export default EditIndividualModal;
