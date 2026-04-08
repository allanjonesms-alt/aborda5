
import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, logAction } from '../firebase';
import { collection, query, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { User, Shift } from '../types';

interface StartShiftModalProps {
  user: User | null;
  onClose: () => void;
  onStarted: () => void;
}

interface SeatAssignment {
  comandante: string;
  motorista: string;
  patrulheiro_1: string;
  patrulheiro_2: string;
}

const ViaturaDiagram = ({ assignments, onDrop, activeRole, onRoleSelect }: { 
  assignments: SeatAssignment, 
  onDrop: (role: keyof SeatAssignment, name: string) => void,
  activeRole?: keyof SeatAssignment | null,
  onRoleSelect?: (role: keyof SeatAssignment) => void
}) => {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent, role: string) => {
    e.preventDefault();
    setDragOver(role);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, role: keyof SeatAssignment) => {
    e.preventDefault();
    const name = e.dataTransfer.getData('operatorName');
    if (name) {
      onDrop(role, name);
    }
    setDragOver(null);
  };

  const renderSeat = (role: keyof SeatAssignment, label: string, x: string, y: string) => {
    const isOccupied = !!assignments[role];
    const isOver = dragOver === role;
    const isSelected = activeRole === role;

    return (
      <div 
        onClick={() => onRoleSelect?.(role)}
        className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-1.5 rounded-xl transition-all duration-300 border-2 
          ${isSelected ? 'ring-2 ring-yellow-500 border-yellow-500 bg-white scale-105 z-20' : isOver ? 'bg-navy-100 border-navy-500 scale-105' : isOccupied ? 'bg-white border-navy-200 shadow-lg border-solid' : 'bg-white border-navy-100 border-dashed'}
          cursor-pointer
        `}
        style={{ left: x, top: y, width: '140px', height: '90px' }}
        onDragOver={(e) => handleDragOver(e, role)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, role)}
      >
        <div className={`flex items-center gap-1.5 mb-1 ${isOccupied ? 'text-navy-900' : isSelected ? 'text-yellow-600' : 'text-navy-300'}`}>
          <i className={`fas ${isOccupied ? 'fa-user-ninja' : isSelected ? 'fa-crosshairs' : 'fa-user-plus'} text-sm`}></i>
          <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
        </div>
        <div className="text-center w-full px-1">
          {isOccupied ? (
            <span className="text-[11px] font-black text-navy-950 uppercase leading-none block truncate">{assignments[role]}</span>
          ) : (
            <span className="text-[8px] font-bold text-navy-200 uppercase italic leading-none">{isSelected ? 'Selecionar' : 'Vazio'}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full sm:aspect-[2/3] max-w-[320px] mx-auto sm:scale-110 h-[260px] sm:h-auto bg-navy-950/20 rounded-3xl border border-navy-700/30 sm:border-none">
      {/* VTR VECTOR - TOP VIEW */}
      <svg viewBox="0 0 400 600" className="hidden sm:block w-full h-full text-navy-400 drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="carBody" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#000033', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#00001a', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#000033', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        
        {/* Chassis Bold Outer line */}
        <path 
          d="M100,60 Q100,30 200,30 Q300,30 300,60 L330,520 Q330,570 200,570 Q70,570 70,520 Z" 
          fill="url(#carBody)" 
          stroke="#000080" 
          strokeWidth="10" 
        />
        
        {/* Detail Inner lines */}
        <path d="M90,70 Q90,50 200,50 Q310,50 310,70 L320,510 Q320,550 200,550 Q80,550 80,510 Z" fill="none" stroke="#f8fafc" strokeWidth="2" opacity="0.4" />
        
        {/* Roof line */}
        <rect x="105" y="180" width="190" height="260" rx="30" fill="none" stroke="#f8fafc" strokeWidth="6" />
        
        {/* Front Glass */}
        <path d="M110,170 Q200,140 290,170" fill="none" stroke="#f8fafc" strokeWidth="6" />
        
        {/* Back Glass */}
        <path d="M120,450 Q200,470 280,450" fill="none" stroke="#f8fafc" strokeWidth="6" />

        {/* Siren Bar */}
        <rect x="130" y="240" width="140" height="18" rx="4" fill="#1e293b" />
        <rect x="135" y="243" width="60" height="12" rx="2" fill="#ef4444" />
        <rect x="205" y="243" width="60" height="12" rx="2" fill="#3b82f6" />
      </svg>

      {/* SEATS DROP ZONES - Positioned relative to car diagram */}
      {renderSeat('motorista', 'Motorista', '26%', '35%')}
      {renderSeat('comandante', 'Comandante', '74%', '35%')}
      {renderSeat('patrulheiro_1', 'Patrulheiro 1', '26%', '65%')}
      {renderSeat('patrulheiro_2', 'Patrulheiro 2', '74%', '65%')}
    </div>
  );
};

const StartShiftModal: React.FC<StartShiftModalProps> = ({ user, onClose, onStarted }) => {
  const [allOperators, setAllOperators] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<keyof SeatAssignment | null>('motorista');
  const [assignments, setAssignments] = useState<SeatAssignment>({
    comandante: '',
    motorista: '',
    patrulheiro_1: '',
    patrulheiro_2: ''
  });

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('ord', 'asc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as User));
        setAllOperators(data);
      } catch (err) {
        console.error("Erro ao buscar operadores:", err);
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    };
    fetchOperators();
  }, []);

  const handleDropAssignment = (role: keyof SeatAssignment, name: string) => {
    const newAssignments = { ...assignments };
    (Object.keys(newAssignments) as Array<keyof SeatAssignment>).forEach(key => {
      if (newAssignments[key] === name) newAssignments[key] = '';
    });
    newAssignments[role] = name;
    setAssignments(newAssignments);
    
    // Auto-advance to next empty seat on mobile
    if (window.innerWidth < 640) {
      const roles: Array<keyof SeatAssignment> = ['motorista', 'comandante', 'patrulheiro_1', 'patrulheiro_2'];
      const nextEmpty = roles.find(r => !newAssignments[r]);
      if (nextEmpty) setActiveRole(nextEmpty);
    }
  };

  const handleDragStart = (e: React.DragEvent, name: string) => {
    e.dataTransfer.setData('operatorName', name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignments.comandante || !assignments.motorista) {
      return alert('Postos de Comando e Motorista são obrigatórios.');
    }

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'vtr_services'), {
        comandante: assignments.comandante,
        motorista: assignments.motorista,
        patrulheiro_1: assignments.patrulheiro_1,
        patrulheiro_2: assignments.patrulheiro_2,
        criado_por: user?.id || '',
        status: 'ATIVO',
        unidade: user?.unidade || '',
        horario_inicio: new Date().toISOString()
      });

      await logAction(
        user?.id || '',
        user?.nome || 'Sistema',
        'SHIFT_STARTED',
        `Início de serviço: VTR com CMD ${assignments.comandante} e MOT ${assignments.motorista}`,
        { assignments }
      );

      onStarted();
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'vtr_services');
      alert('Erro ao sincronizar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredOperators = allOperators.filter(op =>
    op.matricula !== '133613021' && ( // Filtro para ocultar matrícula específica
      op.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.matricula.includes(searchTerm)
    )
  );

  const clearSeats = () => {
    setAssignments({ comandante: '', motorista: '', patrulheiro_1: '', patrulheiro_2: '' });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 bg-navy-950/80 backdrop-blur-md overflow-hidden">
      <div className="bg-white border border-navy-100 w-full max-w-6xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[95vh] md:h-full md:max-h-[580px]">
        
        {/* LEFT SIDEBAR: OPERATORS LIST (3 COLUMNS) */}
        <div className="w-full md:w-[480px] bg-navy-50 border-r border-navy-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-navy-100 shrink-0">
            <h3 className="text-navy-950 font-black uppercase tracking-tighter text-sm mb-3">Efetivo Disponível</h3>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Filtrar operador..." 
                className="w-full bg-white border border-navy-200 rounded-lg px-3 py-2 text-[10px] font-bold text-navy-950 outline-none focus:ring-1 focus:ring-navy-500 transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-navy-300 text-[10px]"></i>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {/* Desktop View: Grid of Cards */}
            <div className="hidden sm:grid grid-cols-3 gap-1.5 w-full">
              {filteredOperators.map(op => {
                const isAssigned = Object.values(assignments).includes(op.nome.toUpperCase());
                return (
                  <div 
                    key={op.id}
                    draggable={!isAssigned}
                    onDragStart={(e) => handleDragStart(e, op.nome.toUpperCase())}
                    className={`p-0 rounded-xl border transition-all flex items-center gap-1.5 cursor-grab active:cursor-grabbing group min-w-0 h-14
                      ${isAssigned ? 'bg-navy-100 border-navy-200 opacity-30 cursor-not-allowed' : 'bg-forest-600 border-forest-500 hover:border-forest-400 hover:bg-forest-500 shadow-sm'}
                    `}
                  >
                    <div className={`w-8 h-full flex items-center justify-center flex-shrink-0 rounded-l-xl ${isAssigned ? 'bg-navy-200 text-navy-400' : 'bg-forest-700 text-white'}`}>
                      <i className="fas fa-id-badge text-xs"></i>
                    </div>
                    <div className="flex-1 min-w-0 pr-1">
                      <p className="text-[10px] font-black text-white uppercase truncate leading-none mb-0.5">{op.nome}</p>
                      <p className="text-[8px] font-bold text-navy-400 uppercase tracking-tighter leading-none">ID: {op.matricula}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile View: Simple List (Only when searching) */}
            <div className="sm:hidden flex flex-col gap-1 w-full">
              {searchTerm && filteredOperators.map(op => {
                const isAssigned = Object.values(assignments).includes(op.nome.toUpperCase());
                return (
                  <button 
                    key={op.id}
                    disabled={isAssigned}
                    onClick={() => activeRole && handleDropAssignment(activeRole, op.nome.toUpperCase())}
                    className={`flex items-center justify-between px-6 py-4 rounded-xl border transition-all w-full
                      ${isAssigned ? 'bg-navy-50 border-navy-100 text-navy-300' : 'bg-forest-50 border-forest-200 text-navy-950 active:bg-forest-100 active:border-forest-300'}
                    `}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-black uppercase">{op.nome}</span>
                      <span className="text-[10px] text-navy-400 font-bold uppercase">ID: {op.matricula}</span>
                    </div>
                    {isAssigned ? (
                      <i className="fas fa-check text-navy-900 text-sm"></i>
                    ) : (
                      <i className="fas fa-plus text-navy-200 text-sm"></i>
                    )}
                  </button>
                );
              })}
              {!searchTerm && (
                <div className="flex flex-col items-center justify-center py-4 opacity-30">
                  <i className="fas fa-search text-xl mb-1 text-navy-300"></i>
                  <p className="text-[8px] font-black uppercase tracking-widest text-navy-400">Pesquise para selecionar</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MAIN AREA: VTR DIAGRAM */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="bg-navy-900 p-4 border-b border-navy-800 flex justify-between items-center backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-navy-800 p-2 rounded-lg">
                <i className="fas fa-users-rays text-white text-xs"></i>
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter leading-none">Distribuição de Postos</h3>
                <p className="text-[8px] text-navy-400 font-bold uppercase mt-1 tracking-widest sm:block hidden">Arraste para os assentos</p>
                <p className="text-[8px] text-yellow-500 font-bold uppercase mt-1 tracking-widest sm:hidden">Clique no posto e pesquise</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearSeats} className="text-navy-400 hover:text-white transition-colors p-1.5" title="Limpar">
                <i className="fas fa-rotate-left text-xs"></i>
              </button>
              <button onClick={onClose} className="text-navy-400 hover:text-white transition-colors p-1.5">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-hidden flex items-center justify-center bg-navy-50/50">
            <ViaturaDiagram 
              assignments={assignments} 
              onDrop={handleDropAssignment} 
              activeRole={activeRole}
              onRoleSelect={setActiveRole}
            />
          </div>

          <div className="p-4 border-t border-navy-100 bg-white flex items-center justify-between shrink-0">
            <div className="flex flex-col">
              <span className="text-[7px] font-black text-navy-300 uppercase tracking-widest">Status Guarnição</span>
              <div className="flex gap-1 mt-1">
                <div className={`w-4 h-1 rounded-full ${assignments.motorista ? 'bg-navy-900' : 'bg-navy-100'}`}></div>
                <div className={`w-4 h-1 rounded-full ${assignments.comandante ? 'bg-navy-900' : 'bg-navy-100'}`}></div>
                <div className={`w-4 h-1 rounded-full ${assignments.patrulheiro_1 ? 'bg-navy-900' : 'bg-navy-100'}`}></div>
                <div className={`w-4 h-1 rounded-full ${assignments.patrulheiro_2 ? 'bg-navy-900' : 'bg-navy-100'}`}></div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 bg-navy-50 hover:bg-navy-100 text-navy-900 font-black py-2.5 rounded-xl uppercase text-[9px] transition-all border border-navy-100">Sair</button>
              <button 
                onClick={handleSubmit} 
                disabled={isSaving} 
                className={`px-8 font-black py-2.5 rounded-xl uppercase text-[9px] shadow-xl transition-all active:scale-95 flex items-center justify-center
                  ${assignments.motorista && assignments.comandante ? 'bg-navy-900 hover:bg-navy-800 text-white shadow-navy-900/20' : 'bg-navy-100 text-navy-300 cursor-not-allowed'}
                `}
              >
                {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-bolt mr-2"></i>}
                {isSaving ? 'Gravando' : 'Sincronizar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StartShiftModal;
