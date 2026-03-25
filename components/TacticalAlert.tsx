
import React, { useEffect } from 'react';

interface TacticalAlertProps {
  message: string;
  onClose: () => void;
}

const TacticalAlert: React.FC<TacticalAlertProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-navy-100 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        <div className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-gray-50 text-navy-900 rounded-full flex items-center justify-center mx-auto border border-navy-100 animate-pulse">
            <i className="fas fa-exclamation-triangle text-2xl"></i>
          </div>
          <h3 className="text-navy-950 font-black uppercase tracking-widest text-sm">Alerta Operacional</h3>
          <p className="text-navy-400 text-xs font-bold uppercase leading-relaxed">
            {message}
          </p>
        </div>
        
        {/* Barra de progresso regressiva */}
        <div className="h-1 bg-gray-50 w-full">
          <div 
            className="h-full bg-navy-600 animate-[progress_3s_linear_forwards]"
            style={{ width: '100%' }}
          ></div>
        </div>
      </div>
      
      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default TacticalAlert;
