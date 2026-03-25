
import React from 'react';

interface TacticalLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const TacticalLogo: React.FC<TacticalLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  };

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-full bg-transparent p-1 ${sizeClasses[size]} ${className}`}>
      {/* 
          Aplicamos um clip-path circular para remover os cantos azuis da imagem quadrada.
          A maioria dos brasões da Força Tática são escudos centrais.
      */}
      <img 
        src="https://lh3.googleusercontent.com/d/1mMEB81-W8s9aTgY1UFmQ8tZ7MeNAKqqB" 
        alt="Logo Força Tática"
        className="w-full h-full object-contain scale-110"
        style={{ 
          clipPath: 'circle(48% at 50% 50%)',
          filter: 'drop-shadow(0 0 8px rgba(0, 51, 204, 0.3))'
        }}
        loading="eager"
      />
    </div>
  );
};

export default TacticalLogo;
