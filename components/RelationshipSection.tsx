
import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Individual, Relationship } from '../types';

interface RelationshipSectionProps {
  relationships: Relationship[];
  onAdd: (rel: Omit<Relationship, 'id' | 'created_at'>) => void;
  onRemove: (id: string) => void;
  isEditing?: boolean;
}

const RelationshipSection: React.FC<RelationshipSectionProps> = ({ relationships, onAdd, onRemove, isEditing = true }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Individual[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedType, setSelectedType] = useState<'COMPARSA' | 'FAMILIAR'>('COMPARSA');
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
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
        setShowSuggestions(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'individuals');
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelect = (ind: Individual) => {
    onAdd({
      individuo_id: '', // Will be filled by the parent
      relacionado_id: ind.id,
      tipo: selectedType,
      relacionado_nome: ind.nome,
      relacionado_alcunha: ind.alcunha
    });
    setSearchTerm('');
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4 pt-4 border-t border-navy-100">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-black text-navy-400 uppercase tracking-widest">Relacionamentos</h4>
      </div>

      {isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 relative" ref={suggestionsRef}>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Nome do Relacionado</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold uppercase text-xs"
                placeholder="BUSCAR INDIVÍDUO..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchTerm.length >= 3 && setShowSuggestions(true)}
              />
              {isSearching && <i className="fas fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-navy-500"></i>}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-navy-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {suggestions.map((ind) => (
                  <div
                    key={ind.id}
                    onClick={() => handleSelect(ind)}
                    className="p-4 hover:bg-navy-50 cursor-pointer border-b border-navy-50 last:border-0 flex items-center justify-between group transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-navy-950 font-black text-xs uppercase truncate group-hover:text-navy-600 transition-colors">{ind.nome}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] text-navy-500 font-bold uppercase">Vulgo: {ind.alcunha || 'N/I'}</span>
                      </div>
                    </div>
                    <i className="fas fa-plus text-navy-200 group-hover:text-navy-600 transition-all ml-4"></i>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-navy-400 uppercase tracking-widest mb-2">Relação</label>
            <select
              className="w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-navy-950 focus:ring-2 focus:ring-navy-500 outline-none font-bold text-xs appearance-none"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'COMPARSA' | 'FAMILIAR')}
            >
              <option value="COMPARSA">COMPARSA</option>
              <option value="FAMILIAR">FAMILIAR</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {relationships.map((rel) => (
          <div key={rel.id} className="bg-navy-50 border border-navy-100 rounded-xl p-3 flex items-center justify-between group">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center">
                <i className={`fas ${rel.tipo === 'COMPARSA' ? 'fa-user-friends' : 'fa-home'} text-navy-400 mr-2 text-xs`}></i>
                <span className="text-[10px] text-navy-900 font-black uppercase truncate">{rel.relacionado_nome}</span>
              </div>
              <div className="flex gap-2 mt-0.5 ml-5">
                <span className="text-[8px] text-navy-500 font-bold uppercase">{rel.tipo}</span>
                {rel.relacionado_alcunha && <span className="text-[8px] text-navy-400 font-bold uppercase">• {rel.relacionado_alcunha}</span>}
              </div>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => onRemove(rel.id)}
                className="text-navy-400 hover:text-red-500 ml-2 transition-colors"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
            )}
          </div>
        ))}
        {relationships.length === 0 && (
          <p className="text-[9px] text-navy-400 italic">Nenhum relacionamento registrado.</p>
        )}
      </div>
    </div>
  );
};

export default RelationshipSection;
