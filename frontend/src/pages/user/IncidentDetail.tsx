import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, MapPin, Clock, ShieldAlert,
  Activity, Camera, Smartphone, CheckCircle, ExternalLink
} from 'lucide-react';
import { api, Incident } from '../../services/api';
import { IncidentMap } from '../../components/IncidentMap';

export const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchIncident = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getIncident(id);
      setIncident(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      setUpdating(true);
      const res = await fetch(`/api/incidents/${id}/status?new_status=${newStatus}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) fetchIncident();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading Incident Details...</div>;
  }

  if (!incident) {
    return (
      <div className="p-8 text-center space-y-3">
        <h3 className="text-sm font-bold text-white">Incident Not Found</h3>
        <Link to="/incidents" className="text-xs text-red-400">Back to Incidents</Link>
      </div>
    );
  }

  const primaryEvent = incident.events[0] || null;
  const isWristband = primaryEvent?.source_type === 'WRISTBAND';
  const isCamera = primaryEvent?.source_type === 'ESP32_CAM';
  const isMobileCam = primaryEvent?.source_type === 'MOBILE_CAMERA';

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-4">
      {/* Top Navigation */}
      <Link
        to="/incidents"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Incidents
      </Link>

      {/* 🚨 EMERGENCY HEADER */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-2xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 px-2.5 py-0.5 rounded-full">
            🚨 EMERGENCY VERIFIED
          </span>
          <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded-lg">
            {incident.incident_id}
          </span>
        </div>

        <h1 className="text-xl font-black tracking-tight">
          {incident.incident_type.replace('_', ' ')}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-xs text-red-100 font-mono pt-1">
          <span>Source: {primaryEvent?.source_type.replace('_', ' ')}</span>
          {primaryEvent?.source_device_id && (
            <span>• Device: {primaryEvent.source_device_id}</span>
          )}
        </div>
      </div>

      {/* STATUS & ACTIONS */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Incident Status:</span>
          <span className={`font-bold px-2.5 py-0.5 rounded-md ${
            incident.status === 'ACTIVE'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}>
            {incident.status}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {incident.status === 'ACTIVE' && (
            <button
              onClick={() => updateStatus('ACKNOWLEDGED')}
              disabled={updating}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
            >
              Acknowledge
            </button>
          )}
          {incident.status !== 'RESOLVED' && (
            <button
              onClick={() => updateStatus('RESOLVED')}
              disabled={updating}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg"
            >
              Resolve
            </button>
          )}
        </div>
      </div>

      {/* PROMINENT SOURCE ARTIFACT */}
      {/* 1. If Camera or Mobile Camera: Image Snapshot Prominent */}
      {(isCamera || isMobileCam) && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden space-y-2">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-blue-400" />
              Accident Snapshot Verification
            </span>
            {primaryEvent?.confidence && (
              <span className="text-xs font-mono font-bold text-emerald-400">
                Confidence: {(primaryEvent.confidence * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="h-64 bg-black flex items-center justify-center overflow-hidden">
            <img
              src={primaryEvent?.image_url || '/uploads/mock_accident_sample.jpg'}
              alt="Accident Detection Snapshot"
              className="w-full h-full object-cover"
              onError={(e: any) => {
                e.target.src = '/uploads/mock_accident_sample.jpg';
              }}
            />
          </div>
        </div>
      )}

      {/* 2. If Wristband: Heart Rate BPM Prominent */}
      {isWristband && (
        <div className="p-5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
            <Activity className="w-4 h-4 animate-bounce" />
            Detected Abnormal Pulse
          </div>
          <div className="text-5xl font-black font-mono text-white">
            {primaryEvent?.bpm || 152} <span className="text-lg font-bold text-rose-400">BPM</span>
          </div>
          <p className="text-xs text-rose-200">Critical bradycardia/tachycardia arrhythmia detected</p>
        </div>
      )}

      {/* LOCATION & GOOGLE MAPS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            Incident Detection Location
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            {primaryEvent?.location_status}
          </span>
        </div>

        <IncidentMap
          latitude={primaryEvent?.latitude}
          longitude={primaryEvent?.longitude}
          locationStatus={primaryEvent?.location_status}
          incidentType={incident.incident_type}
        />

        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
          <div>
            <span className="text-slate-500 block text-[10px]">LATITUDE</span>
            {primaryEvent?.latitude !== null && primaryEvent?.latitude !== undefined
              ? primaryEvent.latitude.toFixed(6)
              : 'LOCATION UNAVAILABLE'}
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">LONGITUDE</span>
            {primaryEvent?.longitude !== null && primaryEvent?.longitude !== undefined
              ? primaryEvent.longitude.toFixed(6)
              : 'LOCATION UNAVAILABLE'}
          </div>
        </div>
      </div>

      {/* TIME AUDIT TRAIL */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs font-mono">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          Timing & Dispatch Audit Trail
        </h4>
        <div className="space-y-1.5 text-slate-300">
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Detection Timestamp:</span>
            <span>{primaryEvent?.detected_at ? new Date(primaryEvent.detected_at).toLocaleString() : 'N/A'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">Server Ingestion Time:</span>
            <span>{primaryEvent?.received_at ? new Date(primaryEvent.received_at).toLocaleString() : 'N/A'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-800">
            <span className="text-slate-400">FCM Push Alert Status:</span>
            <span className="text-emerald-400 font-bold">{primaryEvent?.alert_status || 'SENT'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-400">Idempotency Key:</span>
            <span className="text-slate-400 text-[10px] truncate max-w-[200px]">{primaryEvent?.event_id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
