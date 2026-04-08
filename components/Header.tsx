
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, Shift } from '../types';
import { BookOpen } from 'lucide-react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import ChangePasswordModal from './ChangePasswordModal';
import StartShiftModal from './StartShiftModal';
import TacticalLogo from './TacticalLogo';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [showEndShiftConfirm, setShowEndShiftConfirm] = useState(false);

  const [isEndingShift, setIsEndingShift] = useState(false);

  const fetchActiveShifts = useCallback(async () => {
    try {
      const shiftsRef = collection(db, 'vtr_services');
      const q = query(
        shiftsRef,
        where('status', '==', 'ATIVO'),
        orderBy('horario_inicio', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      
      const shifts = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        horario_inicio: doc.data().horario_inicio?.toDate?.()?.toISOString() || doc.data().horario_inicio,
        horario_fim: doc.data().horario_fim?.toDate?.()?.toISOString() || doc.data().horario_fim
      } as Shift));
      
      setActiveShifts(shifts);
    } catch (err) {
      console.error('Erro inesperado ao buscar serviços:', err);
      handleFirestoreError(err, OperationType.LIST, 'vtr_services');
    }
  }, []);

  useEffect(() => {
    fetchActiveShifts();
    const interval = setInterval(fetchActiveShifts, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveShifts]);

  const handleEndShift = async (shiftId?: string) => {
    if (isEndingShift) return;
    
    setIsEndingShift(true);
    try {
      console.log('Iniciando encerramento de serviços ativos...');
      
      if (shiftId) {
        await updateDoc(doc(db, 'vtr_services', shiftId), {
          status: 'ENCERRADO',
          horario_fim: new Date(),
          encerrado_por_nome: user?.nome || 'Sistema (Manual)'
        });
        await logAction(
          user?.id || '',
          user?.nome || 'Sistema',
          'SHIFT_ENDED',
          `Encerramento de serviço específico: ${shiftId}`,
          { shiftId }
        );
      } else {
        const shiftsRef = collection(db, 'vtr_services');
        const q = query(shiftsRef, where('status', '==', 'ATIVO'));
        const querySnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((document) => {
          batch.update(document.ref, {
            status: 'ENCERRADO',
            horario_fim: new Date(),
            encerrado_por_nome: user?.nome || 'Sistema (Manual)'
          });
        });
        await batch.commit();
        await logAction(
          user?.id || '',
          user?.nome || 'Sistema',
          'SHIFT_ENDED',
          `Encerramento de todos os serviços ativos.`,
          {}
        );
      }

      console.log('Serviços encerrados');
      setActiveShifts([]);
      setShowEndShiftConfirm(false);
      
      // Recarrega para garantir sincronismo total
      window.location.reload();
    } catch (err: any) {
      console.error('Falha operacional ao encerrar serviço:', err);
      handleFirestoreError(err, OperationType.WRITE, 'vtr_services');
      console.error('ERRO OPERACIONAL: Não foi possível encerrar o serviço.\nDetalhes: ' + (err.message || 'Sem resposta do servidor.'));
    } finally {
      setIsEndingShift(false);
    }
  };

  const handleBack = () => {
    if (location.pathname !== '/') {
      navigate(-1);
    }
  };

  const isHome = location.pathname === '/';

  return (
    <>
      <header className="bg-white border-b border-navy-100 p-2 sm:p-4 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={handleBack}
              className={`p-2 hover:bg-navy-50 rounded-full transition-all ${isHome ? 'opacity-30 cursor-not-allowed' : 'active:scale-90'}`}
              disabled={isHome}
            >
              <i className="fas fa-arrow-left text-lg sm:text-xl text-navy-400"></i>
            </button>
            
            <Link to="/" className="flex items-center space-x-2 group">
              <TacticalLogo size="md" className="group-hover:scale-110 transition-transform" />
              <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-navy-950">ARGOS</h1>
            </Link>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-4">
            {activeShifts.length > 0 ? (
              <div className="flex items-center bg-navy-50 rounded-xl border border-navy-100 px-2 sm:px-3 py-1.5 gap-2 sm:gap-3">
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[8px] font-black text-navy-900 uppercase tracking-widest animate-pulse">{activeShifts.length} Serviço(s) Ativo(s)</span>
                </div>
                <button 
                  onClick={() => setShowEndShiftConfirm(true)}
                  disabled={isEndingShift}
                  className={`${isEndingShift ? 'bg-navy-200' : 'bg-red-600 hover:bg-red-500'} text-white w-8 h-8 sm:w-10 sm:h-10 rounded-lg shadow-lg flex items-center justify-center transition-all active:scale-95`}
                  title="Encerrar Todos os Serviços"
                >
                  {isEndingShift ? (
                    <i className="fas fa-spinner fa-spin text-sm"></i>
                  ) : (
                    <i className="fas fa-square text-sm"></i>
                  )}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsStartShiftModalOpen(true)}
                className="bg-navy-900 hover:bg-navy-800 text-white px-3 sm:px-4 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
              >
                <i className="fas fa-play text-[10px]"></i>
                <span className="hidden sm:inline">Iniciar</span>
              </button>
            )}

            <div className="h-8 w-px bg-navy-100 mx-1"></div>

            <Link 
              to="/" 
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${isHome ? 'bg-navy-900/10 text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
            >
              <i className="fas fa-home text-base sm:text-lg"></i>
            </Link>

            <Link 
              to="/manual" 
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${location.pathname === '/manual' ? 'bg-navy-900/10 text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
              title="Manual do Usuário"
            >
              <BookOpen size={18} />
            </Link>

            {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) && (
              <Link 
                to="/configuracoes" 
                className={`p-2 rounded-lg transition-all flex items-center justify-center ${location.pathname === '/configuracoes' ? 'bg-navy-900/10 text-navy-900' : 'text-navy-400 hover:bg-navy-50 hover:text-navy-900'}`}
              >
                <i className="fas fa-cog text-base sm:text-lg"></i>
              </Link>
            )}

            <button 
              onClick={onLogout}
              className="flex items-center bg-navy-50 border border-navy-100 hover:bg-navy-100 text-navy-900 px-2 sm:px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              <i className="fas fa-sign-out-alt text-red-500 text-base"></i>
            </button>
          </div>
        </div>
      </header>

      {isStartShiftModalOpen && (
        <StartShiftModal 
          user={user} 
          onClose={() => setIsStartShiftModalOpen(false)} 
          onStarted={fetchActiveShifts} 
        />
      )}

      {isPasswordModalOpen && (
        <ChangePasswordModal 
          user={user} 
          onClose={() => setIsPasswordModalOpen(false)} 
        />
      )}

      {showEndShiftConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md">
          <div className="bg-white border border-navy-100 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
              </div>
              <h3 className="text-navy-950 font-black uppercase tracking-tighter text-xl mb-4">Encerrar Serviço?</h3>
              <p className="text-navy-400 text-xs font-bold uppercase leading-relaxed mb-8">
                Esta ação registrará o horário de término para toda a guarnição e liberará o terminal para novos serviços.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleEndShift()}
                  disabled={isEndingShift}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-xs shadow-xl shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isEndingShift ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
                  {isEndingShift ? 'Processando...' : 'Sim, Encerrar Agora'}
                </button>
                <button 
                  onClick={() => setShowEndShiftConfirm(false)}
                  disabled={isEndingShift}
                  className="w-full bg-navy-50 hover:bg-navy-100 text-navy-900 font-black py-4 rounded-2xl uppercase text-xs transition-all active:scale-95 border border-navy-100"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
