
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { DBApproach, Individual } from '../types';

import { loadGoogleMaps } from '../lib/googleMaps';

interface MapMarker {
  lat: number;
  lng: number;
  title: string;
  type: 'abordagem' | 'residencia';
  id: string;
  details?: string;
}

const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markersCount, setMarkersCount] = useState({ abordagens: 0, residencias: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const googleMap = useRef<any>(null);
  const geocoder = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [approachesSnap, individualsSnap] = await Promise.all([
          getDocs(collection(db, 'approaches')),
          getDocs(collection(db, 'individuals'))
        ]);

        const approaches = approachesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DBApproach)).filter(a => !!a.local);
        const individuals = individualsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Individual)).filter(i => !!i.endereco);

        return { approaches, individuals };
      } catch (err: any) {
        console.error("Erro ao buscar dados para o mapa:", err);
        handleFirestoreError(err, OperationType.LIST, 'approaches/individuals');
        setError("Falha ao carregar dados do banco.");
        return null;
      }
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const geocodeWithRetry = async (address: string, retries = 3): Promise<{ lat: number, lng: number } | null> => {
      for (let i = 0; i < retries; i++) {
        try {
          const result = await new Promise<{ lat: number, lng: number } | null>((resolve, reject) => {
            geocoder.current.geocode({ address }, (results: any, status: any) => {
              if (status === 'OK' && results[0]) {
                resolve({
                  lat: results[0].geometry.location.lat(),
                  lng: results[0].geometry.location.lng()
                });
              } else if (status === 'OVER_QUERY_LIMIT') {
                reject(new Error('OVER_QUERY_LIMIT'));
              } else {
                resolve(null);
              }
            });
          });
          return result;
        } catch (err: any) {
          if (err.message === 'OVER_QUERY_LIMIT') {
            await delay(500 * (i + 1));
            continue;
          }
          return null;
        }
      }
      return null;
    };

    const initMap = async () => {
      if (!mapRef.current || !(window as any).google || !(window as any).google.maps) return;

      const data = await fetchData();
      if (!data) {
        setIsLoading(false);
        return;
      }

      const totalItems = data.approaches.length + data.individuals.length;
      setProgress({ current: 0, total: totalItems });

      const google = (window as any).google;
      const defaultPos = { lat: -18.4485, lng: -54.7592 }; // Coxim, MS

      googleMap.current = new google.maps.Map(mapRef.current, {
        center: defaultPos,
        zoom: 13,
        disableDefaultUI: false,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
          { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
          { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
          { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
          { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
          { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
          { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
          { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
          { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
          { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
          { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
          { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
        ],
      });

      // Tentar obter localização do usuário
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userPos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            googleMap.current.setCenter(userPos);
            googleMap.current.setZoom(17); // Visão tática detalhada (nível 17)

            // Adicionar marcador da posição atual do usuário
            new google.maps.Marker({
              position: userPos,
              map: googleMap.current,
              title: "Sua Localização",
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#10b981', // Emerald-500
                fillOpacity: 1,
                strokeWeight: 3,
                strokeColor: '#ffffff',
                scale: 8,
              }
            });
          },
          (error) => {
            console.warn("Erro ao obter geolocalização:", error);
          }
        );
      }

      geocoder.current = new google.maps.Geocoder();

      let abordagensCount = 0;
      let residenciasCount = 0;
      let processed = 0;

      // Processar em lotes para não travar e respeitar limites
      const processBatch = async (items: any[], type: 'abordagem' | 'residencia') => {
        for (const item of items) {
          const address = type === 'abordagem' ? item.local : item.endereco;
          const pos = await geocodeWithRetry(address);
          if (pos) {
            if (type === 'abordagem') {
              addMarker(pos, `Abordagem: ${item.individuo_nome || 'N/I'}`, 'abordagem', item.id, `${item.data} ${item.horario}`);
              abordagensCount++;
            } else {
              addMarker(pos, `Residência: ${item.nome}`, 'residencia', item.id, item.alcunha ? `Vulgo: ${item.alcunha}` : undefined);
              residenciasCount++;
            }
          }
          processed++;
          setProgress(prev => ({ ...prev, current: processed }));
          // Pequeno intervalo entre requisições para evitar OVER_QUERY_LIMIT
          await delay(100);
        }
      };

      await processBatch(data.approaches, 'abordagem');
      await processBatch(data.individuals, 'residencia');

      setMarkersCount({ abordagens: abordagensCount, residencias: residenciasCount });
      setIsLoading(false);
    };

    const addMarker = (pos: { lat: number, lng: number }, title: string, type: 'abordagem' | 'residencia', id: string, details?: string) => {
      const google = (window as any).google;
      const color = type === 'abordagem' ? '#0033cc' : '#228B22'; 
      
      const marker = new google.maps.Marker({
        position: pos,
        map: googleMap.current,
        title: title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 0.9,
          strokeWeight: 2,
          strokeColor: '#ffffff',
          scale: 7,
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="color: #1e293b; padding: 12px; min-width: 150px; font-family: sans-serif;">
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
              <div style="width: 10px; height: 10px; border-radius: 50%; background: ${color}; margin-right: 8px;"></div>
              <h3 style="margin: 0; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">${type === 'abordagem' ? 'Registro de Abordagem' : 'Endereço Residencial'}</h3>
            </div>
            <p style="margin: 0 0 4px 0; font-weight: 700; font-size: 13px; color: #0f172a;">${title.split(': ')[1]}</p>
            ${details ? `<p style="margin: 0; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">${details}</p>` : ''}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(googleMap.current, marker);
      });
    };

    const startMap = async () => {
      try {
        await loadGoogleMaps();
        await initMap();
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar Google Maps.');
        setIsLoading(false);
      }
    };

    startMap();
  }, []);

  return (
    <div className="flex flex-col h-screen -m-4 md:-m-6">
      <div className="bg-white p-4 border-b border-navy-100 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="bg-gray-50 hover:bg-gray-100 text-navy-900 w-10 h-10 rounded-xl flex items-center justify-center transition-all border border-navy-100"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="text-navy-950 font-black uppercase tracking-tighter text-xl leading-none">Mapa Tático</h2>
            <div className="flex gap-3 mt-1">
              <span className="text-[8px] font-black text-navy-600 uppercase tracking-widest flex items-center">
                <i className="fas fa-circle mr-1 text-[6px]"></i> {markersCount.abordagens} Abordagens
              </span>
              <span className="text-[8px] font-black text-forest-600 uppercase tracking-widest flex items-center">
                <i className="fas fa-circle mr-1 text-[6px]"></i> {markersCount.residencias} Residências
              </span>
            </div>
          </div>
        </div>
        <div className="bg-navy-50 px-4 py-2 rounded-xl border border-navy-100 hidden sm:block">
           <span className="text-[8px] font-black text-forest-600 uppercase tracking-widest">Monitoramento Ativo</span>
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full"></div>
        
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-20">
            <Siren className="w-12 h-12 text-navy-600 mb-6 animate-pulse" />
            <h3 className="text-navy-950 font-black uppercase tracking-[0.3em] text-xs">CARREGANDO DADOS...</h3>
            <div className="w-64 h-1 bg-gray-100 rounded-full mt-6 overflow-hidden">
              <div 
                className="h-full bg-navy-600 transition-all duration-300" 
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-navy-400 text-[10px] mt-4 uppercase font-bold">
              Processando {progress.current} de {progress.total} registros táticos
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center p-8 text-center z-30">
            <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-2xl max-w-md">
              <i className="fas fa-exclamation-triangle text-red-500 text-5xl mb-6"></i>
              <h3 className="text-navy-950 font-black uppercase mb-2">Falha Crítica no Mapeamento</h3>
              <p className="text-navy-500 text-sm mb-8 leading-relaxed">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-lg"
              >
                Tentar Reconectar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
