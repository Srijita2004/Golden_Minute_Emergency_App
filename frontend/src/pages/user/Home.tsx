import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert, ShieldCheck, Camera, Activity, Smartphone,
  MapPin, Bell, AlertTriangle, ArrowRight, RefreshCw, Cpu
} from 'lucide-react';
import { api, Device, Incident } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useEmergencyAlert } from '../../context/EmergencyAlertContext';

export const Home: React.FC = () => {
  const { user } = useAuth();
  const { activeAlert, triggerLocalSiren } = useEmergencyAlert();
  const [devices, setDevices] = useState<Device[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<string>('Detecting GPS...');
  const [notifPermission, setNotifPermission] = useState<string>('default');

  const loadData = async () => {
    try {
      setLoading(true);
      const [devList, incList] = await Promise.all([
        api.getDevices(),
        api.getIncidents()
      ]);
      setDevices(devList);
      setIncidents(incList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Check Phone Location Status
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus('GPS Locked (High Accuracy)'),
        () => setLocationStatus('Location Unavailable'),
        { timeout: 5000 }
      );
    } else {
      setLocationStatus('GPS Hardware Not Supported');
    }

    // Check Notification status
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const wristband = devices.find(d => d.device_type === 'WRISTBAND');
  const camera = devices.find(d => d.device_type === 'ESP32_CAM');

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      {/* 1. EMERGENCY STATUS HERO BANNER */}
      {activeAlert ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-xl animate-pulse">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
              CRITICAL EMERGENCY ACTIVE
            </span>
            <span className="text-xs font-mono">{activeAlert.data.incidentId}</span>
          </div>
          <h2 className="text-xl font-extrabold mt-2 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            {activeAlert.title}
          </h2>
          <p className="text-xs text-red-100 mt-1">{activeAlert.body}</p>
          <div className="mt-3 flex gap-2">
            <Link
              to={`/incidents/${activeAlert.data.incidentId}`}
              className="px-4 py-2 bg-white text-red-700 text-xs font-bold rounded-xl shadow"
            >
              Open Incident View
            </Link>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Emergency Status
              </div>
              <div className="text-base font-extrabold text-slate-100 flex items-center gap-2">
                All Clear • Standing By
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* 2. DETECTION SOURCE STATUS CARDS */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
          Detection Engines & Peripherals
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* External Camera */}
          <Link
            to="/camera-detail"
            className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-400">
                <Camera className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                camera?.connection_status === 'CONNECTED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {camera?.connection_status || 'NOT PAIRED'}
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-sm font-bold text-slate-200">ESP32-CAM</h4>
              <p className="text-[11px] text-slate-400 truncate">
                {camera ? camera.device_name : 'Tap to register camera'}
              </p>
            </div>
          </Link>

          {/* Wristband */}
          <Link
            to="/wristband-detail"
            className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-rose-500/10 rounded-xl text-rose-400">
                <Activity className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                wristband?.connection_status === 'CONNECTED'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {wristband ? (wristband.last_bpm ? `${wristband.last_bpm} BPM` : wristband.connection_status) : 'NOT PAIRED'}
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-sm font-bold text-slate-200">Wristband</h4>
              <p className="text-[11px] text-slate-400 truncate">
                {wristband ? `${wristband.battery_level || 90}% Battery` : 'Tap to connect BLE'}
              </p>
            </div>
          </Link>

          {/* Mobile Camera */}
          <Link
            to="/phone-camera"
            className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-purple-500/10 rounded-xl text-purple-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                READY
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-sm font-bold text-slate-200">Phone AI Camera</h4>
              <p className="text-[11px] text-slate-400">Front / Rear YOLO Cam</p>
            </div>
          </Link>

          {/* Mock Simulation Studio */}
          <Link
            to="/mock-studio"
            className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/20 hover:border-amber-500/40 transition flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DEV TEST
              </span>
            </div>
            <div className="mt-3">
              <h4 className="text-sm font-bold text-amber-200">Mock Hardware</h4>
              <p className="text-[11px] text-amber-400/80">Trigger live emergencies</p>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. SYSTEM & PERMISSION TELEMETRY */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Device Readiness & Permissions
        </h4>

        {/* Location Status */}
        <div className="flex items-center justify-between text-xs py-1 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>Location Services</span>
          </div>
          <span className="font-mono text-cyan-400 font-medium">{locationStatus}</span>
        </div>

        {/* Notification Status */}
        <div className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-2 text-slate-300">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Emergency Notification Channel</span>
          </div>
          <span className={`font-mono font-medium ${
            notifPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {notifPermission === 'granted' ? 'High-Priority Active' : 'Permission Required'}
          </span>
        </div>
      </div>

      {/* 4. RECENT INCIDENTS */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recent Emergency Incidents
          </h3>
          <Link to="/incidents" className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
            View All ({incidents.length}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {incidents.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <p className="text-xs text-slate-400">No emergency incidents recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {incidents.slice(0, 3).map((inc) => (
              <Link
                key={inc.incident_id}
                to={`/incidents/${inc.incident_id}`}
                className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    inc.incident_type === 'ROAD_ACCIDENT'
                      ? 'bg-red-500/10 text-red-400'
                      : inc.incident_type === 'FIRE_ACCIDENT'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold text-slate-200">
                      {inc.incident_type.replace('_', ' ')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {inc.incident_id} • {new Date(inc.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    inc.status === 'ACTIVE'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {inc.status}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
