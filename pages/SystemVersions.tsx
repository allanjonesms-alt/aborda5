import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SystemVersion, User } from '../types';
import VersionModal from '../components/VersionModal';
import { useNavigate } from 'react-router-dom';

interface SystemVersionsProps {
  user: User | null;
}

const SystemVersions: React.FC<SystemVersionsProps> = ({ user }) => {
  const [versions, setVersions] = useState<SystemVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'system_versions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemVersion));
      setVersions(data);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'system_versions');
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="bg-navy-600 p-3 rounded-2xl shadow-xl">
            <i className="fas fa-code-branch text-white text-2xl"></i>
          </div>
          <div>
            <h2 className="text-3xl font-black text-navy-950 uppercase tracking-tighter">Histórico de Versões</h2>
            <p className="text-[10px] text-navy-400 font-black uppercase tracking-widest mt-1">Atualizações e Reparos</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-navy-600 hover:bg-navy-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95"
        >
          <i className="fas fa-plus mr-2"></i> Nova Versão
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-navy-400 font-black uppercase text-[10px] tracking-widest">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {versions.map(v => (
            <div key={v.id} className="bg-white border border-navy-100 p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-navy-950 font-black uppercase text-lg">{v.version}</h4>
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${v.type === 'ATUALIZAÇÃO' ? 'bg-forest-50 text-forest-600' : 'bg-yellow-50 text-yellow-600'}`}>
                  {v.type}
                </span>
              </div>
              <p className="text-navy-600 text-sm font-medium mb-2">{v.description}</p>
              <p className="text-navy-400 text-[10px] font-black uppercase tracking-widest">{v.date.split('-').reverse().join('/')}</p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <VersionModal 
          onClose={() => setIsModalOpen(false)} 
          user={user}
          lastVersion={versions.length > 0 ? versions[0].version : ''}
        />
      )}
    </div>
  );
};

export default SystemVersions;
