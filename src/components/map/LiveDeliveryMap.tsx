import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, MapPin, Navigation, Thermometer, Droplets, Clock } from 'lucide-react';

const NIGERIAN_COORDINATES: Record<string, [number, number]> = {
  soba: [10.9858, 8.0583],
  kawo: [10.5847, 7.4526],
  kaduna: [10.5105, 7.4165],
  zaria: [11.0855, 7.7199],
  kano: [12.0022, 8.5920],
  lagos: [6.5244, 3.3792],
  ikeja: [6.5954, 3.3366],
  ogbomoso: [8.1333, 4.2500],
  ibadan: [7.3775, 3.9470],
  ilorin: [8.4966, 4.5421],
  kwara: [8.5000, 4.5500],
  abuja: [9.0765, 7.3986],
  fct: [9.0765, 7.3986],
  jos: [9.8965, 8.8583],
  plateau: [9.8965, 8.8583],
  makurdi: [7.7322, 8.5391],
  benue: [7.7322, 8.5391],
  sokoto: [13.0609, 5.2476],
  katsina: [12.9908, 7.6018],
  maiduguri: [11.8333, 13.1500],
  borno: [11.8333, 13.1500],
  bauchi: [10.3158, 9.8442],
  gombe: [10.2897, 11.1673],
  yola: [9.2094, 12.4818],
  adamawa: [9.2094, 12.4818],
  enugu: [6.4584, 7.5464],
  owerri: [5.4840, 7.0355],
  'port harcourt': [4.8156, 7.0498],
  rivers: [4.8156, 7.0498],
  calabar: [4.9757, 8.3417],
  benin: [6.3350, 5.6037],
  edo: [6.3350, 5.6037],
  asaba: [6.1984, 6.7329],
  delta: [6.1984, 6.7329],
  akure: [7.2571, 5.2058],
  ondo: [7.2571, 5.2058],
  osogbo: [7.7827, 4.5418],
  osun: [7.7827, 4.5418],
  abeokuta: [7.1475, 3.3619],
  ogun: [7.1475, 3.3619],
  minna: [9.6139, 6.5569],
  niger: [9.6139, 6.5569],
  oyo: [7.8430, 3.9368],
};

export function geocodeLocation(
  name?: string,
  fallback: [number, number] = [10.5105, 7.4165]
): [number, number] {
  if (!name) return fallback;
  const lower = name.toLowerCase();
  for (const [key, coords] of Object.entries(NIGERIAN_COORDINATES)) {
    if (lower.includes(key)) return coords;
  }
  return fallback;
}

interface LiveDeliveryMapProps {
  originName?: string;
  originCoords?: [number, number];
  destinationName?: string;
  destinationCoords?: [number, number];
  vehicleLocation?: [number, number];
  progressPercent?: number;
  temperature?: string;
  humidity?: string;
  eta?: string;
  speed?: string;
}

export function LiveDeliveryMap({
  originName = 'Soba, Kaduna',
  originCoords,
  destinationName = 'Kawo, Kaduna',
  destinationCoords,
  progressPercent = 65,
  temperature = '22.8°C',
  humidity = '14.2%',
  eta = '1h 15m',
  speed = '62 km/h',
}: LiveDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [mapLayer, setMapLayer] = useState<'carto' | 'satellite'>('carto');

  // Resolve dynamic coordinates from place names if not explicitly provided
  const resolvedOrigin: [number, number] =
    originCoords || geocodeLocation(originName, [10.9858, 8.0583]);
  const resolvedDestination: [number, number] =
    destinationCoords || geocodeLocation(destinationName, [10.5847, 7.4526]);

  // Calculate simulated truck position along route
  const currentLat =
    resolvedOrigin[0] + (resolvedDestination[0] - resolvedOrigin[0]) * (progressPercent / 100);
  const currentLng =
    resolvedOrigin[1] + (resolvedDestination[1] - resolvedOrigin[1]) * (progressPercent / 100);
  const truckPos: [number, number] = [currentLat, currentLng];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [7.3288, 3.8146], // Midpoint around Ibadan corridor
        zoom: 8,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing layers
    map.eachLayer((layer) => {
      map.removeLayer(layer);
    });

    // Base Tile Layer
    if (mapLayer === 'carto') {
      L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=cb1_3v91_1_61b640886fc868806f637e0a', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 18,
      }).addTo(map);
    }

    // Origin Marker
    const originIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white">
            📍
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(resolvedOrigin, { icon: originIcon })
      .addTo(map)
      .bindPopup(`<b>Pickup Location:</b><br/>${originName}`);

    // Destination Marker
    const destIcon = L.divIcon({
      className: 'custom-map-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white">
            🏁
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(resolvedDestination, { icon: destIcon })
      .addTo(map)
      .bindPopup(`<b>Delivery Destination:</b><br/>${destinationName}`);

    // Route Polyline
    const polyline = L.polyline([resolvedOrigin, resolvedDestination], {
      color: '#16a34a',
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 8',
    }).addTo(map);

    // Moving Vehicle Marker with pulsing radar ring
    const truckIcon = L.divIcon({
      className: 'truck-radar-icon',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-12 h-12 bg-emerald-500/30 rounded-full animate-ping"></span>
          <div class="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center text-lg shadow-xl border-2 border-white z-10">
            🚚
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker(truckPos, { icon: truckIcon })
      .addTo(map)
      .bindPopup(`<b>Active Transit:</b><br/>Speed: ${speed}<br/>ETA: ${eta}`);

    map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 13 });

    return () => {
      // clean up if unmounting
    };
  }, [mapLayer, resolvedOrigin, resolvedDestination, progressPercent, originName, destinationName, eta, speed]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Map Control Header */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold tracking-wide uppercase">Real-Time Telemetry &amp; GPS</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMapLayer(mapLayer === 'carto' ? 'satellite' : 'carto')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer text-white border border-white/10"
          >
            <Layers className="w-3.5 h-3.5" />
            {mapLayer === 'carto' ? 'Satellite Layer' : 'Voyager Street'}
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative">
        <div ref={mapContainerRef} className="w-full h-80 z-0" />

        {/* Floating Telemetry Stats Overlay */}
        <div className="absolute bottom-3 inset-x-3 z-10 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-gray-200/80 shadow-md">
            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-semibold">
              <Clock className="w-3 h-3 text-agri-600" /> ETA
            </div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">{eta}</div>
          </div>
          <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-gray-200/80 shadow-md">
            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-semibold">
              <Navigation className="w-3 h-3 text-blue-600" /> Velocity
            </div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">{speed}</div>
          </div>
          <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-gray-200/80 shadow-md">
            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-semibold">
              <Thermometer className="w-3 h-3 text-amber-600" /> Temp
            </div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">{temperature}</div>
          </div>
          <div className="bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-gray-200/80 shadow-md">
            <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-semibold">
              <Droplets className="w-3 h-3 text-cyan-600" /> Moisture
            </div>
            <div className="text-xs font-bold text-gray-900 mt-0.5">{humidity}</div>
          </div>
        </div>
      </div>

      {/* Bottom Progress details */}
      <div className="p-4 bg-slate-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
          <span><b>Route:</b> {originName} → {destinationName}</span>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="font-bold text-gray-900 whitespace-nowrap">{progressPercent}% complete</span>
        </div>
      </div>
    </div>
  );
}
