import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Smartphone, MapPin, AlertTriangle, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../services/api';

export const PhoneCamera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [streamActive, setStreamActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [phoneGps, setPhoneGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastIncidentId, setLastIncidentId] = useState<string | null>(null);

  // Request Phone GPS
  const requestPhoneLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationPermission('denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationPermission('granted');
        setPhoneGps({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          acc: pos.coords.accuracy
        });
      },
      () => setLocationPermission('denied'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Start Camera Stream
  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);
      setCameraPermission('granted');
      setFacingMode(mode);
      requestPhoneLocation();
    } catch (e) {
      console.error(e);
      setCameraPermission('denied');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const triggerMobileIncident = async (type: string) => {
    try {
      setIsDetecting(true);
      const eventId = `EVENT-PHONE-${Date.now()}`;
      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('incident_type', type);
      formData.append('confidence', '0.895');

      if (phoneGps) {
        formData.append('latitude', phoneGps.lat.toString());
        formData.append('longitude', phoneGps.lon.toString());
        formData.append('location_accuracy', phoneGps.acc.toString());
      }

      // Capture frame snapshot if video is active
      if (videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg'));
          if (blob) {
            formData.append('image', blob, 'phone_snapshot.jpg');
          }
        }
      }

      const res = await api.createMobileIncident(formData);
      setLastIncidentId(res.incident_id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400">
          Internal Mobile Vision
        </span>
        <h2 className="text-xl font-extrabold text-white">Mobile Phone AI Camera</h2>
        <p className="text-xs text-slate-400">
          Standalone AI monitoring using your phone's camera and location services.
        </p>
      </div>

      {/* Permissions Status Row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <span className="text-slate-300">Camera</span>
          <span className={`font-bold flex items-center gap-1 ${
            cameraPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {cameraPermission === 'granted' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {cameraPermission.toUpperCase()}
          </span>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
          <span className="text-slate-300">Phone GPS</span>
          <span className={`font-bold flex items-center gap-1 ${
            phoneGps ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {phoneGps ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {phoneGps ? 'LOCKED' : 'PENDING'}
          </span>
        </div>
      </div>

      {/* Viewport Card */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl relative">
        <div className="relative h-64 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`}
          />
          {!streamActive && (
            <div className="text-center p-6 space-y-2">
              <Smartphone className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">Camera stream is currently inactive.</p>
              <button
                onClick={() => startCamera('environment')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition"
              >
                Enable AI Camera
              </button>
            </div>
          )}

          {/* Facing mode badge */}
          {streamActive && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-white">
              {facingMode === 'user' ? 'FRONT CAMERA' : 'REAR CAMERA'}
            </div>
          )}

          {/* GPS telemetry watermark */}
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono text-cyan-300">
            {phoneGps ? (
              <span>GPS: {phoneGps.lat.toFixed(4)}, {phoneGps.lon.toFixed(4)} (±{phoneGps.acc.toFixed(0)}m)</span>
            ) : (
              <span className="text-amber-400">LOCATION UNAVAILABLE</span>
            )}
          </div>
        </div>

        {/* Camera Control Bar */}
        {streamActive && (
          <div className="p-3 bg-slate-950 flex items-center justify-between border-t border-slate-800">
            <button
              onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
            >
              Flip: {facingMode === 'user' ? 'Rear Cam' : 'Front Cam'}
            </button>

            <button
              onClick={stopCamera}
              className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white text-xs font-bold rounded-xl transition"
            >
              Stop Stream
            </button>
          </div>
        )}
      </div>

      {/* Manual AI Incident Triggers */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Simulate Phone AI Detection Trigger
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => triggerMobileIncident('ROAD_ACCIDENT')}
            disabled={isDetecting}
            className="p-3 bg-red-600/30 hover:bg-red-600 border border-red-500/50 rounded-xl text-xs font-bold text-red-200 hover:text-white transition"
          >
            Detect Road Accident
          </button>
          <button
            onClick={() => triggerMobileIncident('FALL_ACCIDENT')}
            disabled={isDetecting}
            className="p-3 bg-rose-600/30 hover:bg-rose-600 border border-rose-500/50 rounded-xl text-xs font-bold text-rose-200 hover:text-white transition"
          >
            Detect Human Fall
          </button>
        </div>

        {lastIncidentId && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400">
            Incident dispatched successfully: <span className="font-mono font-bold">{lastIncidentId}</span>
          </div>
        )}
      </div>
    </div>
  );
};
