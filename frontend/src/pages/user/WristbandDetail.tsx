import React, { useState, useEffect } from 'react';
import { Activity, Battery, MapPin, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api, Device } from '../../services/api';
import { IncidentMap } from '../../components/IncidentMap';

export const WristbandDetail: React.FC = () => {
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentBpm, setCurrentBpm] = useState(72);
  const [simulating, setSimulating] = useState(false);

  const fetchDevice = async () => {
    try {
      setLoading(true);
      const devices = await api.getDevices();
      const wrist = devices.find(d => d.device_type === 'WRISTBAND');
      setDevice(wrist || null);
      if (wrist?.last_bpm) setCurrentBpm(wrist.last_bpm);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevice();
  }, []);

  const triggerPulseTest = async (testBpm: number) => {
    if (!device) return;
    try {
      setSimulating(true);
      setCurrentBpm(testBpm);
      await api.mockWristband(device.device_id, testBpm, device.last_latitude, device.last_longitude);
      fetchDevice();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading Wristband Telemetry...</div>;
  }

  if (!device) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <Activity className="w-12 h-12 text-slate-600 mx-auto" />
        <h3 className="text-base font-bold text-white">No Wristband Paired</h3>
        <p className="text-xs text-slate-400">Go to My Devices to pair your ESP32 DevKit Wristband.</p>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400">
            ESP32 DevKit Peripheral
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

      {/* BPM Hero Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-rose-950/60 to-slate-900 border border-rose-500/30 text-center relative overflow-hidden">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-rose-500 animate-bounce" />
          <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
            Live Heart Rate Telemetry
          </span>
        </div>

        <div className="flex items-baseline justify-center gap-2">
          <span className="text-6xl font-black font-mono text-white tracking-tight">
            {currentBpm}
          </span>
          <span className="text-lg font-bold text-rose-400 font-mono">BPM</span>
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 text-xs font-mono text-slate-300">
          <span className="flex items-center gap-1">
            <Battery className="w-4 h-4 text-emerald-400" />
            {device.battery_level || 94}% Battery
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {device.connection_status}
          </span>
        </div>
      </div>

      {/* GPS Location Component */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          Wristband GPS Locked Coordinates
        </h3>
        <IncidentMap
          latitude={device.last_latitude}
          longitude={device.last_longitude}
          locationStatus={device.last_latitude ? 'AVAILABLE' : 'LOCATION UNAVAILABLE'}
          incidentType="Wristband Location"
        />
      </div>

      {/* Abnormal Pulse Testing Trigger */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Simulate Wristband Sensor Trigger
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => triggerPulseTest(72)}
            disabled={simulating}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-200 transition"
          >
            Normal (72 BPM)
          </button>
          <button
            onClick={() => triggerPulseTest(150)}
            disabled={simulating}
            className="p-2.5 bg-rose-600/30 hover:bg-rose-600 border border-rose-500/50 rounded-xl text-xs font-bold text-rose-200 hover:text-white transition"
          >
            Tachycardia (150 BPM)
          </button>
          <button
            onClick={() => triggerPulseTest(38)}
            disabled={simulating}
            className="p-2.5 bg-purple-600/30 hover:bg-purple-600 border border-purple-500/50 rounded-xl text-xs font-bold text-purple-200 hover:text-white transition"
          >
            Bradycardia (38 BPM)
          </button>
        </div>
        <p className="text-[11px] text-slate-500 text-center">
          Abnormal thresholds (&lt;45 or &gt;130 BPM) trigger the full Emergency Alert pipeline.
        </p>
      </div>
    </div>
  );
};
