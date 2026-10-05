import React, { useState, useEffect } from 'react';
import { Cpu, Activity, Camera, WifiOff, Bell, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { api, Device } from '../../services/api';
import { useEmergencyAlert } from '../../context/EmergencyAlertContext';

export const MockHardwareHub: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWristband, setSelectedWristband] = useState<string>('');
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [bpmInput, setBpmInput] = useState<number>(145);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const { triggerLocalSiren } = useEmergencyAlert();

  const addLog = (msg: string) => {
    setActionLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 15)]);
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      const list = await api.getDevices();
      setDevices(list);
      const wrist = list.find(d => d.device_type === 'WRISTBAND');
      if (wrist) setSelectedWristband(wrist.device_id);
      const cam = list.find(d => d.device_type === 'ESP32_CAM');
      if (cam) setSelectedCamera(cam.device_id);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleSimulateWristband = async (bpm: number) => {
    if (!selectedWristband) {
      alert('Please select or register a wristband first.');
      return;
    }
    try {
      const res = await api.mockWristband(selectedWristband, bpm);
      if (res.emergency_triggered) {
        addLog(`🚨 ABNORMAL BPM (${bpm}) triggered Incident: ${res.incident}`);
      } else {
        addLog(`Normal telemetry broadcast: ${bpm} BPM on ${selectedWristband}`);
      }
      loadDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSimulateCamera = async (type: string) => {
    if (!selectedCamera) {
      alert('Please select or register an ESP32-CAM first.');
      return;
    }
    try {
      const res = await api.mockCameraAccident(selectedCamera, type);
      addLog(`🚨 Camera AI (${type}) triggered Incident: ${res.incident}`);
      loadDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleOffline = async (devId: string) => {
    try {
      const res = await api.mockToggleOffline(devId);
      addLog(`Device ${devId} connection toggled to: ${res.new_status}`);
      loadDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Mock Hardware Studio</h2>
            <p className="text-xs text-slate-400">Simulate physical ESP32 boards & telemetry</p>
          </div>
        </div>
        <button
          onClick={loadDevices}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 1. ESP32 DevKit Wristband Simulator */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            ESP32 DevKit Pulse Simulator
          </div>
          <select
            value={selectedWristband}
            onChange={(e) => setSelectedWristband(e.target.value)}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
          >
            {devices.filter(d => d.device_type === 'WRISTBAND').map(d => (
              <option key={d.device_id} value={d.device_id}>{d.device_name} ({d.device_id})</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={bpmInput}
            onChange={(e) => setBpmInput(Number(e.target.value))}
            className="w-24 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white text-center"
            placeholder="BPM"
          />
          <button
            onClick={() => handleSimulateWristband(bpmInput)}
            className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-rose-600/20"
          >
            Broadcast Custom BPM ({bpmInput})
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSimulateWristband(72)}
            className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Normal (72 BPM)
          </button>
          <button
            onClick={() => handleSimulateWristband(152)}
            className="py-2 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-rose-300 hover:text-white rounded-xl text-xs font-bold"
          >
            🚨 Tachycardia (152 BPM)
          </button>
        </div>
      </div>

      {/* 2. ESP32-CAM Accident Simulator */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Camera className="w-4 h-4" />
            ESP32-CAM Hazard Simulator
          </div>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
          >
            {devices.filter(d => d.device_type === 'ESP32_CAM').map(d => (
              <option key={d.device_id} value={d.device_id}>{d.device_name} ({d.device_id})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSimulateCamera('ROAD_ACCIDENT')}
            className="py-2.5 bg-red-600/30 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white rounded-xl text-xs font-bold transition"
          >
            🚨 Car Crash Detected
          </button>
          <button
            onClick={() => handleSimulateCamera('FIRE_ACCIDENT')}
            className="py-2.5 bg-amber-600/30 hover:bg-amber-600 border border-amber-500/40 text-amber-200 hover:text-white rounded-xl text-xs font-bold transition"
          >
            🔥 Fire Detected
          </button>
        </div>
      </div>

      {/* 3. Hardware Offline State Simulation */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
          <WifiOff className="w-4 h-4" />
          Hardware Disconnect / Battery Drain Simulation
        </div>

        <div className="space-y-2">
          {devices.map(d => (
            <div key={d.device_id} className="p-2.5 bg-slate-950 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">{d.device_name}</span>
              <button
                onClick={() => handleToggleOffline(d.device_id)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] ${
                  d.connection_status === 'CONNECTED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                Toggle {d.connection_status === 'CONNECTED' ? 'Offline' : 'Online'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Live Simulation Action Log */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Real-time Event Dispatch Console
        </h4>
        <div className="bg-black/80 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[11px] text-emerald-400 space-y-1">
          {actionLog.length === 0 ? (
            <span className="text-slate-600">Waiting for mock events...</span>
          ) : (
            actionLog.map((log, i) => <div key={i}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
};
