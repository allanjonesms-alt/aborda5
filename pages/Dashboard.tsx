
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { User, UserRole, Shift, Unit, SystemVersion } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
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
  const [activeShifts, setActiveShifts] = useState<Shift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [unitFeatures, setUnitFeatures] = useState<string[] | null>(null);
  const [latestVersion, setLatestVersion] = useState<string>('V1.0');
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'system_versions'), orderBy('date', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const versionData = snapshot.docs[0].data() as SystemVersion;
        setLatestVersion(versionData.version);
      }
    }, (err) => {
      console.error('Erro ao buscar versão:', err);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.unidade) {
      setUnitFeatures(null);
      return;
    }

    const q = query(collection(db, 'units'), where('nome', '==', user.unidade));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const unitData = snapshot.docs[0].data() as Unit;
        setUnitFeatures(unitData.enabled_features || null);
      } else {
        setUnitFeatures(null);
      }
    });

    return () => unsubscribe();
  }, [user?.unidade]);

  useEffect(() => {
    const checkShifts = async () => {
      try {
        const shiftsRef = collection(db, 'vtr_services');
        const unitFilter = (user?.role !== 'ADMIN' && user?.unidade) ? where('unidade', '==', user.unidade) : null;
        
        let q = query(
          shiftsRef,
          where('status', '==', 'ATIVO'),
          orderBy('horario_inicio', 'desc')
        );

        if (unitFilter) {
          q = query(
            shiftsRef,
            where('status', '==', 'ATIVO'),
            unitFilter,
            orderBy('horario_inicio', 'desc')
          );
        }
        
        const querySnapshot = await getDocs(q);
        
        const shifts = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          horario_inicio: doc.data().horario_inicio?.toDate?.()?.toISOString() || doc.data().horario_inicio,
          horario_fim: doc.data().horario_fim?.toDate?.()?.toISOString() || doc.data().horario_fim
        } as Shift));
        
        setActiveShifts(shifts);
      } catch (err) {
        console.error('Erro ao verificar serviços:', err);
        handleFirestoreError(err, OperationType.LIST, 'vtr_services');
      } finally {
        setIsLoadingShifts(false);
      }
    };
    checkShifts();
    const interval = setInterval(checkShifts, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const isUserInAnyShift = (userName: string | undefined, shifts: Shift[]) => {
    if (!userName || shifts.length === 0) return false;
    const name = userName.toUpperCase();
    return shifts.some(shift => 
      shift.comandante?.toUpperCase() === name ||
      shift.motorista?.toUpperCase() === name ||
      shift.patrulheiro_1?.toUpperCase() === name ||
      shift.patrulheiro_2?.toUpperCase() === name
    );
  };

  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER;
  const inAnyShift = isUserInAnyShift(user?.nome, activeShifts);
  const canRegisterApproach = isAdmin || inAnyShift;

  const isFeatureEnabled = (featureId: string) => {
    if (isAdmin) return true; // Admins see everything
    if (!unitFeatures) return true; // Default to all enabled if not set
    return unitFeatures.includes(featureId);
  };

  const handleApproachClick = () => {
    if (isAdmin) {
      navigate('/nova-abordagem');
      return;
    }

    if (activeShifts.length === 0) {
      setAlertMessage('Não é possível registrar abordagem sem um SERVIÇO ATIVO. Inicie o serviço no cabeçalho.');
      return;
    }
    
    if (!inAnyShift) {
      setAlertMessage('Acesso Negado: Você não consta como integrante da guarnição de nenhum serviço ativo.');
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
        {isFeatureEnabled('nova-abordagem') && (
          <MenuButton
            onClick={handleApproachClick}
            icon="fa-file-signature"
            label="Nova Abordagem"
            colorClass="bg-navy-600"
            description="Registrar nova abordagem policial em campo."
            disabled={!canRegisterApproach && activeShifts.length > 0}
          />
        )}
        {isAdmin && isFeatureEnabled('ocorrencias') && (
          <MenuButton
            to="/ocorrencias"
            icon="fa-file-invoice"
            label="Ocorrências"
            colorClass="bg-red-700"
            description="SS e RO Realizados."
          />
        )}
        {isFeatureEnabled('abordagens') && (
          <MenuButton
            to="/abordagens"
            icon="fa-history"
            label="Abordagens"
            colorClass="bg-navy-700"
            description="Consultar histórico de registros realizados."
          />
        )}
        {isFeatureEnabled('individuos') && (
          <MenuButton
            to="/individuos"
            icon="fa-user-shield"
            label="Indivíduos"
            colorClass="bg-forest-600"
            description="Base de dados e cadastro de indivíduos."
          />
        )}
        {isFeatureEnabled('galeria') && (
          <MenuButton
            to="/galeria"
            icon="fa-th"
            label="Galeria"
            colorClass="bg-navy-500"
            description="Visualizar registros fotográficos do sistema."
          />
        )}
        {isFeatureEnabled('mapas') && (
          <MenuButton
            to="/mapas"
            icon="fa-map-location-dot"
            label="Mapas"
            colorClass="bg-forest-700"
            description="Visualização geográfica de ocorrências e endereços."
          />
        )}
        {isFeatureEnabled('estatisticas') && (
          <MenuButton
            to="/estatisticas"
            icon="fa-chart-pie"
            label="ESTATÍSTICAS"
            colorClass="bg-forest-500"
            description="Quantidade de SS e RO cadastrados."
          />
        )}
        {isFeatureEnabled('manual') && (
          <MenuButton
            to="/manual"
            icon="fa-book"
            label="Manual do Usuário"
            colorClass="bg-navy-800"
            description="Guia completo de utilização do sistema para operadores."
          />
        )}

        {(user?.role === UserRole.ADMIN || user?.role === UserRole.MASTER) && (
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

      {isLoadingShifts ? (
        <div className="mt-8 p-6 bg-navy-50 border border-navy-100 rounded-2xl flex items-center justify-center gap-4">
          <Siren className="w-5 h-5 text-navy-400 animate-pulse" />
          <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">CARREGANDO DADOS...</span>
        </div>
      ) : (
        <>
          {activeShifts.length === 0 && !isAdmin && (
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

          {activeShifts.length > 0 && !canRegisterApproach && (
            <div className="mt-8 p-6 bg-navy-50 border border-navy-100 rounded-2xl flex items-center gap-4">
              <div className="bg-navy-900 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fas fa-lock text-white text-xl"></i>
              </div>
              <div>
                <h4 className="text-navy-950 font-black uppercase text-xs tracking-widest">Acesso Limitado</h4>
                <p className="text-navy-500 text-[10px] mt-1 uppercase font-bold leading-relaxed">
                  Serviços em andamento. Como você não faz parte de nenhuma destas guarnições, seu acesso para novos registros está bloqueado por diretriz operacional.
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
            <h4 className="text-navy-900 font-bold uppercase text-xs tracking-widest">SGA5 {latestVersion}</h4>
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
