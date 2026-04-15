
import { User, UserRole } from '../types';

export const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const validateCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
};

export const allowedCities = [
  'COXIM',
  'SONORA',
  'ALCINÓPOLIS',
  'PEDRO GOMES',
  'SÃO GABRIEL DO OESTE',
  'RIO VERDE'
];

export const RIO_VERDE_VARIATIONS = [
  'RIO VERDE', 'RIO VERDE DE MATO GROSSO', 'RIO VERDE DE MT',
  'Rio Verde', 'Rio Verde de Mato Grosso', 'Rio Verde de MT',
  'rio verde', 'rio verde de mato grosso', 'rio verde de mt'
];

export const checkCity = (addressComponents: any[]) => {
  const cityComponent = addressComponents.find(c => 
    c.types.includes('locality') || 
    c.types.includes('administrative_area_level_2')
  );
  
  if (!cityComponent) return false;
  
  const cityName = cityComponent.long_name.toUpperCase();
  
  // Check if it matches any of the Rio Verde variations
  if (RIO_VERDE_VARIATIONS.some(v => cityName.includes(v.toUpperCase()))) return true;
  
  return allowedCities.some(city => cityName.includes(city));
};

export const getCityFromAddressComponents = (addressComponents: any[]) => {
  const cityComponent = addressComponents.find(c => 
    c.types.includes('locality') || 
    c.types.includes('administrative_area_level_2')
  );
  
  if (!cityComponent) return '';
  
  const cityName = cityComponent.long_name.toUpperCase();
  
  if (RIO_VERDE_VARIATIONS.some(v => cityName.includes(v.toUpperCase()))) return 'RIO VERDE';
  
  const matchedCity = allowedCities.find(city => cityName.includes(city));
  return matchedCity || '';
};

export const extractCityFromAddress = (address: string) => {
  if (!address) return '';
  
  // Normaliza o endereço para facilitar a busca
  const upperAddress = address.toUpperCase();
  
  // Mapeamento preciso de termos para cidades
  const cityMap: Record<string, string> = {
    'RIO VERDE': 'Rio Verde de MT',
    'RIO VERDE DE MT': 'Rio Verde de MT',
    '79480': 'Rio Verde de MT', // Código postal específico
    '2ª CIA/RIO VERDE': 'Rio Verde de MT',
    'COXIM': 'Coxim',
    'SONORA': 'Sonora',
    'ALCINÓPOLIS': 'Alcinópolis',
    'PEDRO GOMES': 'Pedro Gomes',
    'SÃO GABRIEL DO OESTE': 'São Gabriel do Oeste'
  };

  // Tenta encontrar a cidade diretamente no endereço completo
  for (const [key, value] of Object.entries(cityMap)) {
    // Verifica se o endereço contém o termo da cidade como uma palavra isolada ou parte de um termo conhecido
    // Isso evita falsos positivos com números de CEP
    if (upperAddress.includes(key)) {
      // Se for o código postal, garante que ele está associado a Rio Verde
      if (key === '79480') return 'Rio Verde de MT';
      return value;
    }
  }
  
  // Fallback: tenta extrair da forma antiga se não encontrar no mapeamento
  const parts = address.split(',');
  if (parts.length >= 2) {
    let cityPart = parts[parts.length - 2].trim();
    cityPart = cityPart.split('-')[0].trim();
    return cityPart.charAt(0).toUpperCase() + cityPart.slice(1).toLowerCase();
  }
  
  return '';
};

export const formatAddress = (address: string) => {
  const parts = (address || '')
    .replace(/BRASIL/gi, '')
    .replace(/\d{5}-\d{3}/g, '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  const city = parts.length > 1 ? parts.pop() : '';
  const street = parts.join(', ');
  
  return { street, city };
};

export const checkIsAdmin = (user: User | null) => {
  if (!user) return false;
  return (
    user.role === UserRole.ADMIN || 
    user.role === UserRole.MASTER || 
    user.unidade === 'FORÇA TÁTICA' ||
    (user.unidades_extras && user.unidades_extras.includes('FORÇA TÁTICA'))
  );
};
