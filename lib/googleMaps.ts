
const GOOGLE_MAPS_API_KEY = 'AIzaSyCitBS_zUZ0485b8KS6G0dOzTFsWv1XH4s';

let loadPromise: Promise<void> | null = null;

export const loadGoogleMaps = (): Promise<void> => {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Se já estiver carregado globalmente
    if ((window as any).google && (window as any).google.maps) {
      resolve();
      return;
    }

    // Verifica se o script já existe no DOM (pode ter sido adicionado por outro componente antes desta refatoração)
    const existingScript = document.getElementById('google-maps-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Pequeno delay para garantir que todos os namespaces internos do Google Maps estejam prontos
      // Especialmente útil para evitar "Map is not a constructor" em carregamentos ultra-rápidos
      setTimeout(() => resolve(), 100);
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Erro ao carregar Google Maps. Verifique sua conexão ou chave API.'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
};
