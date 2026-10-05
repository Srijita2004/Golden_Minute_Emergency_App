import React, { useState, useEffect } from 'react';
import { Camera, RefreshCw, AlertTriangle, Flame, ShieldAlert, MapPin, Eye } from 'lucide-react';
import { api, Device } from '../../services/api';
import { IncidentMap } from '../../components/IncidentMap';

export const CameraDetail: React.FC = () => {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const fetchDevice = async () => {
    try {
      setLoading(true);
      const devices = await api.getDevices();
      const cam = devices.find(d => d.device_type === 'ESP32_CAM');
      setDevice(cam || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevice();
  }, []);

  const triggerCameraTest = async (type: string) => {
    if (!device) return;
    try {
      setSimulating(true);
      await api.mockCameraAccident(device.device_id, type);
      fetchDevice();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading ESP32-CAM Stream...</div>;
  }

  if (!device) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <Camera className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-white">No External Camera Paired</h3>
        <p className="text-xs text-slate-400">Go to My Devices to pair your ESP32-CAM optical sensor.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            ESP32-CAM Optical Vision
          </span>
          <h2 className="text-xl font-extrabold text-white">{device.device_name}</h2>
        </div>
        <button
          onClick={fetchDevice}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Camera Live Snapshot Screen */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl relative">
        <div className="relative h-60 bg-black flex items-center justify-center overflow-hidden">
          <img
            src="/uploads/mock_accident_sample.jpg"
            alt="Camera Snapshot"
            className="w-full h-full object-cover opacity-85"
            onError={(e: any) => {
              e.target.style.display = 'none';
            }}
          />
          {/* Overlay HUD */}
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-mono text-white tracking-widest uppercase">
              LIVE OPTICAL STREAM
            </span>
          </div>

          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-300">
            FPS: 28.4 • YOLOv8n Native Inference
          </div>
        </div>

        <div className="p-4 flex items-center justify-between border-t border-slate-800">
          <div>
            <div className="text-xs font-bold text-slate-200">Optical Detection Model</div>
            <div className="text-[11px] text-slate-400 font-mono">road_expanded_best.pt</div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold">
            {device.connection_status}
          </span>
        </div>
      </div>

      {/* GPS Location Component */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          Camera GPS Fixed Location
        </h3>
        <IncidentMap
          latitude={device.last_latitude}
          longitude={device.last_longitude}
          locationStatus={device.last_latitude ? 'AVAILABLE' : 'LOCATION UNAVAILABLE'}
          incidentType="Highway Camera Location"
        />
      </div>

      {/* Simulation triggers */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Simulate Camera AI Hazard Triggers
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => triggerCameraTest('ROAD_ACCIDENT')}
            disabled={simulating}
            className="flex items-center justify-center gap-2 p-3 bg-red-600/30 hover:bg-red-600 border border-red-500/50 rounded-xl text-xs font-bold text-red-200 hover:text-white transition"
          >
            <AlertTriangle className="w-4 h-4" />
            Simulate Road Crash
          </button>
          <button
            onClick={() => triggerCameraTest('FIRE_ACCIDENT')}
            disabled={simulating}
            className="flex items-center justify-center gap-2 p-3 bg-amber-600/30 hover:bg-amber-600 border border-amber-500/50 rounded-xl text-xs font-bold text-amber-200 hover:text-white transition"
          >
            <Flame className="w-4 h-4" />
            Simulate Fire Detection
          </button>
        </div>
      </div>
    </div>
  );
};
