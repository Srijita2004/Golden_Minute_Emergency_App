import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, VolumeX, ArrowRight, X, MapPin, HeartPulse, Camera, CheckCircle2 } from 'lucide-react';
import { useEmergencyAlert } from '../context/EmergencyAlertContext';

export const AlarmBanner: React.FC = () => {
  const { activeAlert, dismissAlert, isSirenPlaying, stopSiren, acknowledgeAlert } = useEmergencyAlert();
  const navigate = useNavigate();

  if (!activeAlert) return null;

  const incidentId = activeAlert.incidentId;
  const isWristband = (activeAlert.sourceType || '').toUpperCase().includes('WRIST');
  const hasCoords = activeAlert.latitude !== undefined && activeAlert.longitude !== undefined && activeAlert.latitude !== '';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl animate-bounce-short">
      <div className="bg-red-600/95 border-2 border-red-300 text-white rounded-3xl p-5 shadow-2xl backdrop-blur-xl animate-emergency">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-white/20 rounded-2xl animate-pulse flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-[11px] tracking-widest uppercase bg-black/40 px-2.5 py-0.5 rounded-lg border border-red-300/40">
                  PRIORITY 1 EMERGENCY
                </span>
                <span className="text-xs text-red-100 font-mono font-bold bg-white/10 px-2 py-0.5 rounded-lg">
                  {incidentId}
                </span>
                <span className="text-[11px] uppercase font-mono tracking-wider bg-black/30 px-2 py-0.5 rounded-lg">
                  {activeAlert.sourceType.replace(/_/g, ' ')}
                </span>
              </div>

              <h2 className="text-xl font-black mt-1.5 tracking-tight text-white flex items-center gap-2">
                🚨 {activeAlert.incidentType.replace(/_/g, ' ')}
              </h2>

              <p className="text-xs text-red-100 mt-0.5">
                {activeAlert.body || 'Immediate response and emergency dispatch required.'}
              </p>
            </div>
          </div>

          <button
            onClick={dismissAlert}
            className="text-red-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition flex-shrink-0"
            title="Dismiss banner"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Evidence & Telemetry Section */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-black/25 rounded-2xl p-3 border border-red-400/30 text-xs">
          {/* Location */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <span className="truncate">
              {hasCoords
                ? `GPS: ${Number(activeAlert.latitude).toFixed(4)}, ${Number(activeAlert.longitude).toFixed(4)}`
                : 'GPS Location Unavailable'}
            </span>
            {hasCoords && (
              <a
                href={`https://maps.google.com/?q=${activeAlert.latitude},${activeAlert.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="underline text-amber-200 hover:text-white font-bold ml-auto text-[11px]"
              >
                Map ↗
              </a>
            )}
          </div>

          {/* Sensor Evidence: Wristband vs Camera */}
          {isWristband ? (
            <div className="flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-emerald-300 flex-shrink-0 animate-pulse" />
              <span className="font-bold text-emerald-200">
                Pulse: {activeAlert.bpm || '142'} BPM (Abnormal Pulse Alarm)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-300 flex-shrink-0" />
              <span>
                {activeAlert.confidence
                  ? `AI Confidence: ${(Number(activeAlert.confidence) * 100).toFixed(1)}%`
                  : 'Optical AI Detection'}
              </span>
              {activeAlert.imageUrl && (
                <span className="text-[10px] bg-cyan-900/60 text-cyan-200 px-1.5 py-0.5 rounded font-mono ml-auto">
                  Snapshot Available
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-red-400/40 pt-3.5">
          <div className="flex items-center gap-2">
            {/* Primary Acknowledge Button */}
            <button
              onClick={() => acknowledgeAlert(incidentId)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black transition active:scale-95 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              ACKNOWLEDGE ALARM
            </button>

            {isSirenPlaying && (
              <button
                onClick={stopSiren}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-xs font-bold transition"
              >
                <VolumeX className="w-4 h-4 text-amber-300" />
                Mute
              </button>
            )}
          </div>

          <button
            onClick={() => {
              acknowledgeAlert(incidentId);
              navigate(`/incidents/${incidentId}`);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-700 font-extrabold text-xs sm:text-sm rounded-xl hover:bg-red-50 active:scale-95 transition shadow-lg ml-auto"
          >
            Open Exact Incident
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
