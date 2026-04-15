
import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ConfidentialInfo } from '../types';

interface ConfidentialHistoryModalProps {
  individualId: string;
  individualNome: string;
  onClose: () => void;
}

const ConfidentialHistoryModal: React.FC<ConfidentialHistoryModalProps> = ({ individualId, individualNome, onClose }) => {
  const [history, setHistory] = useState<ConfidentialInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'confidential_info'),
          where('individuo_id', '==', individualId),
          limit(100)
        );
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConfidentialInfo));
        
        // Ordenação em memória para evitar a necessidade de índice composto no Firestore
        const sortedData = data.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 50);

        setHistory(sortedData);
      } catch (err) {
        console.error("Erro ao buscar histórico sigiloso:", err);
        handleFirestoreError(err, OperationType.LIST, 'confidential_info');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [individualId]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-navy-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border-2 border-red-600 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="bg-red-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <i className="fas fa-user-secret text-white text-3xl"></i>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Relatório de Informações Sigilosas</h3>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest">{individualNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-red-100 transition-colors"><i className="fas fa-times text-2xl"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <i className="fas fa-spinner fa-spin text-red-600 text-4xl"></i>
              <p className="text-navy-400 font-black uppercase text-[10px] tracking-widest">Consultando Inteligência...</p>
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-start border-b border-red-200 pb-2">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Operador</span>
                      <span className="text-xs font-black text-navy-950 uppercase">{item.operador_nome}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Data/Hora</span>
                      <span className="text-xs font-bold text-navy-700">{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <p className="text-sm text-navy-900 font-medium leading-relaxed whitespace-pre-wrap">
                    {item.conteudo}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <i className="fas fa-folder-open text-6xl text-navy-200 mb-4"></i>
              <p className="text-navy-950 font-black uppercase text-xs tracking-widest">Nenhum registro encontrado</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-navy-100">
          <button onClick={onClose} className="w-full bg-navy-900 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest hover:bg-navy-800 transition-all shadow-xl">Fechar Relatório</button>
        </div>
      </div>
    </div>
  );
};

export default ConfidentialHistoryModal;
