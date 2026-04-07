
import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { Unit, User } from '../types';

interface UnitFeaturesModalProps {
  unit: Unit;
  onClose: () => void;
  user: User | null;
}

const FEATURES = [
  { id: 'nova-abordagem', label: 'Nova Abordagem', icon: 'fa-file-signature' },
  { id: 'ocorrencias', label: 'Ocorrências', icon: 'fa-file-invoice' },
  { id: 'abordagens', label: 'Abordagens', icon: 'fa-history' },
  { id: 'individuos', label: 'Indivíduos', icon: 'fa-user-shield' },
  { id: 'galeria', label: 'Galeria', icon: 'fa-th' },
  { id: 'mapas', label: 'Mapas', icon: 'fa-map-location-dot' },
  { id: 'estatisticas', label: 'Estatísticas', icon: 'fa-chart-pie' },
  { id: 'manual', label: 'Manual do Usuário', icon: 'fa-book' },
];

const UnitFeaturesModal: React.FC<UnitFeaturesModalProps> = ({ unit, onClose, user }) => {
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>(unit.enabled_features || FEATURES.map(f => f.id));
  const [isSaving, setIsSaving] = useState(false);

  const toggleFeature = (featureId: string) => {
    setEnabledFeatures(prev => 
      prev.includes(featureId) 
        ? prev.filter(id => id !== featureId) 
        : [...prev, featureId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'units', unit.id), {
        enabled_features: enabledFeatures
      });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'UNIT_FEATURES_UPDATED',
        `Recursos da unidade "${unit.nome}" atualizados.`,
        { unitId: unit.id, unitName: unit.nome, enabledFeatures }
      );

      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `units/${unit.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-sm">
      <div className="bg-white border border-navy-100 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-navy-800 p-4 border-b border-navy-700 flex justify-between items-center">
          <div>
            <h3 className="text-white font-black uppercase tracking-tighter">Menu da Unidade</h3>
            <p className="text-navy-400 text-[10px] font-bold uppercase tracking-widest">{unit.nome}</p>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
          <p className="text-navy-500 text-[10px] font-black uppercase tracking-widest mb-4">Selecione os itens visíveis na Dashboard:</p>
          
          <div className="space-y-2">
            {FEATURES.map(feature => {
              const isEnabled = enabledFeatures.includes(feature.id);
              return (
                <div 
                  key={feature.id}
                  onClick={() => toggleFeature(feature.id)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                    isEnabled 
                      ? 'bg-navy-50 border-navy-200' 
                      : 'bg-white border-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-navy-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      <i className={`fas ${feature.icon} text-sm`}></i>
                    </div>
                    <span className={`font-bold text-sm ${isEnabled ? 'text-navy-950' : 'text-gray-400'}`}>{feature.label}</span>
                  </div>
                  
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isEnabled ? 'bg-forest-500' : 'bg-gray-200'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-navy-50 border-t border-navy-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 bg-white text-navy-900 font-black px-6 py-3 rounded-xl uppercase text-[10px] border border-navy-200 hover:bg-navy-100 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] bg-navy-900 hover:bg-navy-800 text-white font-black px-6 py-3 rounded-xl uppercase text-[10px] shadow-lg transition-all flex items-center justify-center"
          >
            {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
            Salvar Configuração
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitFeaturesModal;
