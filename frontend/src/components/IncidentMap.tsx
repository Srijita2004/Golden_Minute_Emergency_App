import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, ExternalLink, AlertOctagon } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon paths
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface IncidentMapProps {
  latitude?: number | null;
  longitude?: number | null;
  locationStatus?: string;
  incidentType?: string;
}

export const IncidentMap: React.FC<IncidentMapProps> = ({
  latitude,
  longitude,
  locationStatus = 'AVAILABLE',
  incidentType = 'Incident'
}) => {
  const isAvailable = locationStatus === 'AVAILABLE' && latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  if (!isAvailable) {
    return (
      <div className="w-full h-64 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-full mb-3">
          <AlertOctagon className="w-8 h-8 text-amber-400" />
        </div>
        <h4 className="text-base font-bold text-slate-200 uppercase tracking-wider">
          LOCATION UNAVAILABLE
        </h4>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Historical GPS coordinates were not provided by the detection source at the time of the event.
        </p>
      </div>
    );
  }

  const position: [number, number] = [latitude!, longitude!];
  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
      <MapContainer center={position} zoom={15} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={position} icon={customIcon}>
          <Popup>
            <div className="text-slate-900 font-sans p-1">
              <p className="font-bold text-sm text-red-600">🚨 {incidentType}</p>
              <p className="text-xs font-mono mt-1">Lat: {latitude?.toFixed(6)}</p>
              <p className="text-xs font-mono">Lon: {longitude?.toFixed(6)}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating Google Maps Overlay */}
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-cyan-400 text-xs font-bold rounded-xl border border-cyan-500/30 shadow-lg backdrop-blur-md transition"
        >
          <MapPin className="w-3.5 h-3.5" />
          View on Google Maps
          <ExternalLink className="w-3 h-3 ml-0.5" />
        </a>
      </div>
    </div>
  );
};
