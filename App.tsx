
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthState, User } from './types';
import { STORAGE_KEYS } from './constants';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewApproach from './pages/NewApproach';
import ApproachesList from './pages/ApproachesList';
import IndividualsList from './pages/IndividualsList';
import Gallery from './pages/Gallery';
import Settings from './pages/Settings';
import FirstAccess from './pages/FirstAccess';
import MapPage from './pages/Map';
import { auth as firebaseAuth } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "{}");
        if (parsedError.error) {
          errorMessage = `Erro no Firestore: ${parsedError.error} (${parsedError.operationType} em ${parsedError.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="bg-white border border-red-100 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl">
            <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-6"></i>
            <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter mb-4">Erro Crítico</h2>
            <p className="text-navy-400 text-sm mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-2xl uppercase text-xs transition-all shadow-lg shadow-red-600/20"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
  });
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        signInAnonymously(firebaseAuth).catch(console.error);
      }
      setIsFirebaseReady(true);
    });

    const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        setAuth(parsed);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    }

    return () => unsubscribe();
  }, []);

  const handleLogin = (user: User) => {
    const newAuth = { user, isAuthenticated: true };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuth));
    navigate('/', { replace: true });
  };

  const handleLogout = () => {
    setAuth({ user: null, isAuthenticated: false });
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    navigate('/', { replace: true });
  };

  const handlePasswordChanged = (updatedUser: User) => {
    const newAuth = { user: updatedUser, isAuthenticated: true };
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuth));
    navigate('/', { replace: true });
  };

  if (!isFirebaseReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-navy-950 font-black uppercase tracking-widest text-[10px]">Iniciando Sistemas...</p>
        </div>
      </div>
    );
  }

  console.log("App auth state:", auth);
  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (auth.user?.primeiro_acesso === false) {
    return <FirstAccess user={auth.user} onPasswordChanged={handlePasswordChanged} />;
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-white">
        <Header user={auth.user} onLogout={handleLogout} />
        <main className="flex-1 container mx-auto p-4 md:p-6 pb-24">
          <Routes>
            <Route path="/" element={<Dashboard user={auth.user} />} />
            <Route path="/nova-abordagem" element={<NewApproach user={auth.user} />} />
            <Route path="/abordagens" element={<ApproachesList />} />
            <Route path="/individuos" element={<IndividualsList user={auth.user} />} />
            <Route path="/galeria" element={<Gallery />} />
            <Route path="/mapas" element={<MapPage />} />
            <Route path="/configuracoes" element={<Settings user={auth.user} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
