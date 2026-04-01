
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { User, UserRole, Shift } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import TacticalLogo from '../components/TacticalLogo';
import TacticalAlert from '../components/TacticalAlert';

interface DashboardProps {
  user: User | null;
}

const MenuButton: React.FC<{
  to?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  colorClass: string;
  description: string;
  disabled?: boolean;
}> = ({ to, onClick, icon, label, colorClass, description, disabled }) => {
  const content = (
    <div className={`w-16 h-16 ${disabled ? 'bg-navy-700 grayscale' : colorClass} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-6 shadow-lg`}>
      <i className={`fas ${icon} text-3xl text-white`}></i>
    </div>
  );

  const cardClasses = `group relative overflow-hidden bg-white border ${disabled ? 'border-navy-100 opacity-60 cursor-not-allowed' : 'border-navy-100 hover:scale-[1.02] hover:shadow-2xl hover:border-navy-300 cursor-pointer'} rounded-2xl p-6 transition-all flex flex-col items-center text-center shadow-sm`;

  if (disabled) {
    return (
      <div className={cardClasses} onClick={onClick}>
        {content}
        <h3 className="text-xl font-black text-navy-400 mb-2 uppercase tracking-tight">{label}</h3>
        <p className="text-navy-500 text-sm leading-relaxed">{description}</p>
        <div className="absolute top-4 right-4 text-[8px] font-black text-red-500 uppercase tracking-widest border border-red-500/20 px-2 py-0.5 rounded bg-red-500/5">Bloqueado</div>
      </div>
    );
  }

  if (to) {
    return (
      <Link to={to} className={cardClasses}>
        {content}
        <h3 className="text-xl font-black text-navy-950 mb-2 uppercase tracking-tight">{label}</h3>
        <p className="text-navy-500 text-sm leading-relaxed">{description}</p>
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <i className="fas fa-chevron-right text-navy-400"></i>
        </div>
      </Link>
    );
  }

  return (
    <div onClick={onClick} className={cardClasses}>
      {content}
      <h3 className="text-xl font-black text-navy-950 mb-2 uppercase tracking-tight">{label}</h3>
      <p className="text-navy-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkShift = async () => {
      try {
        const shiftsRef = collection(db, 'vtr_services');
        const unitFilter = (user?.role !== 'ADMIN' && user?.unidade) ? where('unidade', '==', user.unidade) : null;
        
        let q = query(
          shiftsRef,
          where('status', '==', 'ATIVO'),
          orderBy('horario_inicio', 'desc'),
          limit(1)
        );

        if (unitFilter) {
          q = query(
            shiftsRef,
            where('status', '==', 'ATIVO'),
            unitFilter,
            orderBy('horario_inicio', 'desc'),
            limit(1)
          );
        }
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          const data = doc.data();
          setActiveShift({ 
            id: doc.id, 
            ...data,
            horario_inicio: data.horario_inicio?.toDate?.()?.toISOString() || data.horario_inicio,
            horario_fim: data.horario_fim?.toDate?.()?.toISOString() || data.horario_fim
          } as Shift);
        } else {
          setActiveShift(null);
        }
      } catch (err) {
        console.error('Erro ao verificar serviço:', err);
        handleFirestoreError(err, OperationType.LIST, 'vtr_services');
      } finally {
        setIsLoadingShift(false);
      }
    };
    checkShift();
    const interval = setInterval(checkShift, 10000);
    return () => clearInterval(interval);
  }, []);

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

  const isAdmin = user?.role === UserRole.ADMIN;
  const inShift = isUserInShift(user?.nome, activeShift);
  const canRegisterApproach = isAdmin || inShift;

  const handleApproachClick = () => {
    if (isAdmin) {
      navigate('/nova-abordagem');
      return;
    }

    if (!activeShift) {
      setAlertMessage('Não é possível registrar abordagem sem um SERVIÇO ATIVO. Inicie o serviço no cabeçalho.');
      return;
    }
    
    if (!inShift) {
      setAlertMessage('Acesso Negado: Você não consta como integrante da guarnição deste serviço ativo.');
      return;
    }

    navigate('/nova-abordagem');
  };

  return (
    <div className="max-w-5xl mx-auto py-8">
      {alertMessage && (
        <TacticalAlert 
          message={alertMessage} 
          onClose={() => setAlertMessage(null)} 
        />
      )}

      <div className="mb-10 animate-fade-in flex items-center justify-between">
          <div>
            <h2 className="text-navy-950 text-3xl font-black uppercase tracking-tighter">Terminal de Operações</h2>
            <p className="text-navy-500 mt-1">Bem-vindo, <span className="text-navy-900 font-bold">{user?.nome}</span></p>
          </div>
          <div className="hidden sm:block">
             <div className="bg-navy-50 px-4 py-2 rounded-xl border border-navy-100 text-[10px] font-black uppercase text-navy-400 tracking-widest">
                Perfil: {user?.role}
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
        <MenuButton
          onClick={handleApproachClick}
          icon="fa-file-signature"
          label="Nova Abordagem"
          colorClass="bg-navy-600"
          description="Registrar nova abordagem policial em campo."
          disabled={!canRegisterApproach && !!activeShift}
        />
        {isAdmin && (
          <MenuButton
            to="/ocorrencias"
            icon="fa-file-invoice"
            label="Ocorrências"
            colorClass="bg-red-700"
            description="SS e RO Realizados."
          />
        )}
        <MenuButton
          to="/abordagens"
          icon="fa-history"
          label="Abordagens"
          colorClass="bg-navy-700"
          description="Consultar histórico de registros realizados."
        />
        <MenuButton
          to="/individuos"
          icon="fa-user-shield"
          label="Indivíduos"
          colorClass="bg-forest-600"
          description="Base de dados e cadastro de indivíduos."
        />
        <MenuButton
          to="/galeria"
          icon="fa-th"
          label="Galeria"
          colorClass="bg-navy-500"
          description="Visualizar registros fotográficos do sistema."
        />
        <MenuButton
          to="/mapas"
          icon="fa-map-location-dot"
          label="Mapas"
          colorClass="bg-forest-700"
          description="Visualização geográfica de ocorrências e endereços."
        />
        <MenuButton
          to="/manual"
          icon="fa-book"
          label="Manual do Usuário"
          colorClass="bg-navy-800"
          description="Guia completo de utilização do sistema para operadores."
        />

        {user?.role === UserRole.ADMIN && (
          <div className="sm:col-span-2">
            <MenuButton
              to="/configuracoes"
              icon="fa-gears"
              label="Configurações do Sistema"
              colorClass="bg-red-900"
              description="Gerenciamento de usuários, logs e importação de dados."
            />
          </div>
        )}
      </div>

      {isLoadingShift ? (
        <div className="mt-8 p-6 bg-navy-50 border border-navy-100 rounded-2xl flex items-center justify-center gap-4">
          <Siren className="w-5 h-5 text-navy-400 animate-pulse" />
          <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">CARREGANDO DADOS...</span>
        </div>
      ) : (
        <>
          {!activeShift && !isAdmin && (
            <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4">
              <div className="bg-red-600 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 animate-pulse">
                <i className="fas fa-exclamation-triangle text-white text-xl"></i>
              </div>
              <div>
                <h4 className="text-red-600 font-black uppercase text-xs tracking-widest">Aviso Operacional</h4>
                <p className="text-navy-500 text-[10px] mt-1 uppercase font-bold leading-relaxed">
                  Sistema em modo de consulta apenas. Para realizar novos registros, você deve <span className="text-navy-900">INICIAR O SERVIÇO</span> no topo da página.
                </p>
              </div>
            </div>
          )}

          {activeShift && !canRegisterApproach && (
            <div className="mt-8 p-6 bg-navy-50 border border-navy-100 rounded-2xl flex items-center gap-4">
              <div className="bg-navy-900 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fas fa-lock text-white text-xl"></i>
              </div>
              <div>
                <h4 className="text-navy-950 font-black uppercase text-xs tracking-widest">Acesso Limitado</h4>
                <p className="text-navy-500 text-[10px] mt-1 uppercase font-bold leading-relaxed">
                  Serviço em andamento. Como você não faz parte desta guarnição, seu acesso para novos registros está bloqueado por diretriz operacional.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-8 p-6 bg-navy-50 rounded-2xl border border-navy-100 border-dashed">
        <div className="flex items-center space-x-4">
          <TacticalLogo size="md" className="opacity-80" />
          <div>
            <h4 className="text-navy-900 font-bold uppercase text-xs tracking-widest">SGA5 V1.0</h4>
            <p className="text-navy-400 text-[10px] mt-1 uppercase font-black tracking-[0.2em]">
              CREATED BY SGT JONES • MONITORAMENTO OPERACIONAL ATIVO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
