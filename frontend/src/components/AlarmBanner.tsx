import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Volume2, VolumeX, ArrowRight, X } from 'lucide-react';
import { useEmergencyAlert } from '../context/EmergencyAlertContext';

export const AlarmBanner: React.FC = () => {
  const { activeAlert, dismissAlert, isSirenPlaying, stopSiren } = useEmergencyAlert();
  const navigate = useNavigate();

  if (!activeAlert) return null;

  const incidentId = activeAlert.data.incidentId;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-xl animate-bounce-short">
      <div className="bg-red-600/95 border-2 border-red-400 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-emergency">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl animate-pulse">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-widest uppercase bg-black/30 px-2 py-0.5 rounded-md">
                  PRIORITY 1 HIGH
                </span>
                <span className="text-xs text-red-100 font-mono">
                  {activeAlert.data.incidentId}
                </span>
              </div>
              <h3 className="text-lg font-extrabold mt-0.5">{activeAlert.title}</h3>
              <p className="text-sm text-red-100 mt-0.5 line-clamp-2">{activeAlert.body}</p>
            </div>
          </div>
          <button
            onClick={dismissAlert}
            className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-red-500/50 pt-3">
          <div className="flex items-center gap-2">
            {isSirenPlaying ? (
              <button
                onClick={stopSiren}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-xs font-semibold transition"
              >
                <VolumeX className="w-4 h-4 text-amber-300" />
                Mute Siren
              </button>
            ) : (
              <span className="text-xs text-red-200 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" /> Siren Silenced
              </span>
            )}
          </div>

          <button
            onClick={() => {
              dismissAlert();
              navigate(`/incidents/${incidentId}`);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-700 font-bold text-sm rounded-xl hover:bg-red-50 active:scale-95 transition shadow-lg"
          >
            Open Exact Incident
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
