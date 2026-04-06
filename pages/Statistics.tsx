import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileDigit } from 'lucide-react';
import { User } from '../types';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

interface StatisticsProps {
  user: User | null;
}

const Statistics: React.FC<StatisticsProps> = ({ user }) => {
  const [counts, setCounts] = useState({ ss: 0, ro: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const ssSnapshot = await getDocs(collection(db, 'occurrences'));
        const roSnapshot = await getDocs(collection(db, 'occurrences_ro'));
        setCounts({ ss: ssSnapshot.size, ro: roSnapshot.size });
      } catch (err) {
        console.error('Erro ao buscar estatísticas:', err);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-navy-500 hover:text-navy-900 mb-6 font-bold uppercase text-xs">
        <ArrowLeft size={16} /> Voltar para Dashboard
      </button>
      <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter mb-10">Estatísticas</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white border border-navy-100 p-8 rounded-3xl shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-navy-700 rounded-2xl flex items-center justify-center">
            <ClipboardList size={32} className="text-white" />
          </div>
          <div>
            <p className="text-navy-500 text-sm font-bold uppercase tracking-widest">Total de SS</p>
            <p className="text-4xl font-black text-navy-950">{counts.ss}</p>
          </div>
        </div>
        <div className="bg-white border border-navy-100 p-8 rounded-3xl shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 bg-red-700 rounded-2xl flex items-center justify-center">
            <FileDigit size={32} className="text-white" />
          </div>
          <div>
            <p className="text-navy-500 text-sm font-bold uppercase tracking-widest">Total de R.O</p>
            <p className="text-4xl font-black text-navy-950">{counts.ro}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
