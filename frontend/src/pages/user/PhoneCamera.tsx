import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, Smartphone, MapPin, AlertTriangle, ShieldCheck, CheckCircle2, XCircle, Activity, Radio, AlertOctagon } from 'lucide-react';
import { api } from '../../services/api';
import { useEmergencyAlert } from '../../context/EmergencyAlertContext';

export const PhoneCamera: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [streamActive, setStreamActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [phoneGps, setPhoneGps] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isAutoMonitoring, setIsAutoMonitoring] = useState(false);
  
  // Real-time inference telemetry states
  const [mlStatus, setMlStatus] = useState<string>('IDLE');
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const [framesProcessed, setFramesProcessed] = useState<number>(0);
  const [lastDetection, setLastDetection] = useState<string>('None');
  const [lastIncidentId, setLastIncidentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { triggerLocalSiren } = useEmergencyAlert();

  const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'https://srij1-esp32-accident-brain.hf.space';

  const lastAlertTimeRef = useRef<number>(0);
  const monitoringTimerRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);

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

  // Start Camera Stream & automatically engage AI Scanning
  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      setErrorMessage(null);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamActive(true);
      setIsAutoMonitoring(true); // Automatically engage AI monitoring when camera starts!
      setCameraPermission('granted');
      setFacingMode(mode);
      requestPhoneLocation();
    } catch (e: any) {
      console.error('Camera access error:', e);
      setCameraPermission('denied');
      setErrorMessage(e.message || 'Unable to access camera device');
    }
  };

  const stopCamera = () => {
    setIsAutoMonitoring(false);
    if (monitoringTimerRef.current) {
      clearTimeout(monitoringTimerRef.current);
      monitoringTimerRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
    setMlStatus('IDLE');
    isProcessingRef.current = false;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Single inference frame capture and pipeline dispatch
  const runInferenceCycle = async () => {
    if (!videoRef.current || isProcessingRef.current) return;
    const video = videoRef.current;

    // Validate video readiness and non-zero dimensions
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    isProcessingRef.current = true;
    const startTime = performance.now();

    try {
      // 1. Maintain true camera aspect ratio (scale longest side to max 640px)
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const maxDim = 640;
      const scale = Math.min(maxDim / vw, maxDim / vh, 1.0);
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isProcessingRef.current = false;
        return;
      }

      ctx.drawImage(video, 0, 0, cw, ch);

      // 2. High-quality JPEG snapshot
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.85)
      );

      if (!blob) {
        isProcessingRef.current = false;
        return;
      }

      // 3. Post to deployed Central ML Service
      const predictUrl = `${ML_SERVICE_URL.replace(/\/+$/, '')}/predict`;

      // Use FormData (CORS-safelisted, avoids preflight overhead)
      const uploadForm = new FormData();
      uploadForm.append('image', blob, 'phone_frame.jpg');

      let response: Response;
      try {
        response = await fetch(predictUrl, {
          method: 'POST',
          body: uploadForm
        });
      } catch (postErr) {
        // Fallback to octet-stream body if needed
        response = await fetch(predictUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: blob
        });
      }

      const elapsed = Math.round(performance.now() - startTime);
      setLastLatency(elapsed);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`ML API returned HTTP ${response.status}:`, errText);
        setMlStatus(`ML ERROR (HTTP ${response.status})`);
        setErrorMessage(`ML Service error ${response.status}: ${errText.slice(0, 100)}`);
        isProcessingRef.current = false;
        return;
      }

      const data = await response.json();
      setFramesProcessed((prev) => prev + 1);
      setLastScore(data.score ?? 0);
      setErrorMessage(null);

      // 4. Non-Accident Case
      if (!data.accident) {
        const now = Date.now();
        const cooldownRemaining = Math.max(0, Math.round((30000 - (now - lastAlertTimeRef.current)) / 1000));
        if (cooldownRemaining > 0) {
          setMlStatus(`COOLDOWN (${cooldownRemaining}s)`);
        } else {
          setMlStatus('CLEAR: NORMAL');
        }
        setLastDetection('Normal Scene (No Emergency)');
        isProcessingRef.current = false;
        return;
      }

      // 5. POSITIVE DETECTION CONFIRMED
      const detectionDetail = data.result || data.type || 'Emergency Detected';
      const confPercent = Math.round((data.score || 0.85) * 100);
      setLastDetection(`${detectionDetail} (${confPercent}%)`);

      const now = Date.now();
      const timeSinceAlert = now - lastAlertTimeRef.current;

      // Cooldown check (30 seconds)
      if (timeSinceAlert < 30000) {
        const remaining = Math.round((30000 - timeSinceAlert) / 1000);
        setMlStatus(`COOLDOWN (${remaining}s) - ${detectionDetail}`);
        isProcessingRef.current = false;
        return;
      }

      // 6. Dispatch Incident to Render Backend
      setMlStatus(`🚨 DISPATCHING ALERT: ${detectionDetail}`);

      const textCheck = `${data.type || ''} ${data.result || ''}`.toLowerCase();
      const incType = textCheck.includes('fire')
        ? 'FIRE_ACCIDENT'
        : textCheck.includes('fall')
        ? 'FALL_ACCIDENT'
        : 'ROAD_ACCIDENT';

      const eventId = `EVENT-PHONE-${now}`;
      const incidentFormData = new FormData();
      incidentFormData.append('event_id', eventId);
      incidentFormData.append('incident_type', incType);
      incidentFormData.append('confidence', String(data.score || 0.85));

      if (phoneGps) {
        incidentFormData.append('latitude', phoneGps.lat.toString());
        incidentFormData.append('longitude', phoneGps.lon.toString());
        incidentFormData.append('location_accuracy', phoneGps.acc.toString());
      }

      incidentFormData.append('image', blob, 'phone_ai_snapshot.jpg');

      try {
        const incidentRes = await api.createMobileIncident(incidentFormData);
        lastAlertTimeRef.current = now; // Lock cooldown ONLY on confirmed success
        setLastIncidentId(incidentRes.incident_id);
        setMlStatus(`🚨 INCIDENT LOGGED: ${incidentRes.incident_id}`);
        triggerLocalSiren(); // Instant audio-visual alarm
      } catch (dispatchErr: any) {
        console.error('Failed to dispatch mobile incident to backend:', dispatchErr);
        setMlStatus(`DISPATCH FAILED: ${dispatchErr.message || 'Network error'}`);
        setErrorMessage(dispatchErr.message || 'Failed to submit incident to backend');
      }
    } catch (err: any) {
      console.error('Real-time AI monitoring loop exception:', err);
      setMlStatus(`AI ERROR: ${err.message || 'Loop error'}`);
      setErrorMessage(err.message || 'Error occurred during AI processing');
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Automated Real-Time ML Inference Loop with clean self-scheduling
  useEffect(() => {
    if (!isAutoMonitoring || !streamActive) {
      if (monitoringTimerRef.current) {
        clearTimeout(monitoringTimerRef.current);
        monitoringTimerRef.current = null;
      }
      return;
    }

    setMlStatus('AI SCANNING...');
    let isCancelled = false;

    const scheduleNext = () => {
      if (isCancelled) return;
      monitoringTimerRef.current = setTimeout(async () => {
        if (!isCancelled && isAutoMonitoring && streamActive) {
          await runInferenceCycle();
          scheduleNext();
        }
      }, 1500);
    };

    scheduleNext();

    return () => {
      isCancelled = true;
      if (monitoringTimerRef.current) {
        clearTimeout(monitoringTimerRef.current);
        monitoringTimerRef.current = null;
      }
    };
  }, [isAutoMonitoring, streamActive, ML_SERVICE_URL, phoneGps]);

  // Manual fallback simulation trigger
  const triggerMobileIncident = async (type: string) => {
    try {
      setIsDetecting(true);
      setErrorMessage(null);
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
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 640, 480);
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
          if (blob) {
            formData.append('image', blob, 'phone_snapshot.jpg');
          }
        }
      }

      const res = await api.createMobileIncident(formData);
      setLastIncidentId(res.incident_id);
      triggerLocalSiren();
    } catch (err: any) {
      console.error('Manual incident trigger error:', err);
      alert(err.message || 'Failed to simulate incident');
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-purple-400">
          Internal Mobile Vision
        </span>
        <h2 className="text-xl font-extrabold text-white">Mobile Phone AI Camera</h2>
        <p className="text-xs text-slate-400">
          Real-time AI monitoring directly from your phone camera feed.
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
            <div className="text-center p-6 space-y-3">
              <Smartphone className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">Camera stream is currently inactive.</p>
              <button
                onClick={() => startCamera('environment')}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 transition"
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

          {/* Live AI Status HUD Overlay */}
          {streamActive && (
            <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 backdrop-blur-md border ${
              mlStatus.includes('ALERT') || mlStatus.includes('INCIDENT')
                ? 'bg-red-600/90 border-red-400 text-white animate-pulse'
                : mlStatus.includes('COOLDOWN')
                ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                : isAutoMonitoring
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-black/60 border-white/10 text-slate-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                mlStatus.includes('ALERT') || mlStatus.includes('INCIDENT')
                  ? 'bg-red-400 animate-ping'
                  : isAutoMonitoring 
                  ? 'bg-emerald-400 animate-pulse' 
                  : 'bg-slate-500'
              }`} />
              <span>{mlStatus}</span>
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
          <div className="p-3 bg-slate-950 flex items-center justify-between border-t border-slate-800 gap-2">
            <button
              onClick={() => setIsAutoMonitoring(!isAutoMonitoring)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                isAutoMonitoring 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                  : 'bg-purple-600/30 text-purple-200 border border-purple-500/40 hover:bg-purple-600 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {isAutoMonitoring ? 'AI Scan Active' : 'Resume AI Scan'}
            </button>

            <button
              onClick={() => startCamera(facingMode === 'user' ? 'environment' : 'user')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Flip Cam
            </button>

            <button
              onClick={stopCamera}
              className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white text-xs font-bold rounded-xl transition"
            >
              Stop
            </button>
          </div>
        )}
      </div>

      {/* Live AI Telemetry & Diagnostics Card */}
      {streamActive && (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-400 border-b border-slate-800 pb-2">
            <span className="flex items-center gap-1.5 text-purple-300 font-bold">
              <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              AI INFERENCE TELEMETRY
            </span>
            <span>Frames: <strong className="text-white">{framesProcessed}</strong></span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            <div>
              <span className="text-slate-500">Last Detection:</span>
              <p className={`font-bold truncate ${lastDetection.includes('Normal') ? 'text-slate-300' : 'text-red-400'}`}>
                {lastDetection}
              </p>
            </div>
            <div>
              <span className="text-slate-500">ML Confidence:</span>
              <p className="font-bold text-slate-200">
                {lastScore !== null ? `${(lastScore * 100).toFixed(1)}%` : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">Inference Latency:</span>
              <p className="font-bold text-cyan-300">
                {lastLatency !== null ? `${lastLatency} ms` : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">ML Endpoint:</span>
              <p className="font-bold text-slate-400 truncate" title={ML_SERVICE_URL}>
                srij1-esp32-accident-brain.hf.space
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-[11px] flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
              <span className="font-mono">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Manual AI Incident Triggers for verification / simulation */}
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
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400 font-mono">
            Active Incident: <strong className="text-white">{lastIncidentId}</strong>
          </div>
        )}
      </div>
    </div>
  );
};
