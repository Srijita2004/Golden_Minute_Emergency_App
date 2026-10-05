import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Cpu, Bluetooth, Wifi, Trash2, Power, Battery, Activity } from 'lucide-react';
import { api, Device } from '../../services/api';

export const MyDevices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form for manual or discovery device add
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState('WRISTBAND');
  const [newConnType, setNewConnType] = useState('BLE');
  const [newHardwareId, setNewHardwareId] = useState('');
  const [newPairingCode, setNewPairingCode] = useState('123456');

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await api.getDevices();
      setDevices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startScan = async () => {
    try {
      setScanning(true);
      const res = await api.discoverNearbyDevices();
      setDiscovered(res.devices || []);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handlePairDiscovered = async (item: any) => {
    try {
      await api.registerDevice({
        device_name: item.name,
        device_type: item.type,
        connection_type: item.connectionType,
        hardware_identifier: item.hardwareId,
        pairing_code: '123456'
      });
      setShowAddModal(false);
      fetchDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.registerDevice({
        device_name: newDeviceName,
        device_type: newDeviceType,
        connection_type: newConnType,
        hardware_identifier: newHardwareId || `DEV-${Date.now()}`,
        pairing_code: newPairingCode
      });
      setShowAddModal(false);
      setNewDeviceName('');
      fetchDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleConnection = async (dev: Device) => {
    try {
      if (dev.connection_status === 'CONNECTED') {
        await api.disconnectDevice(dev.device_id);
      } else {
        await api.connectDevice(dev.device_id);
      }
      fetchDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemove = async (devId: string) => {
    if (!confirm('Are you sure you want to unpair and remove this device?')) return;
    try {
      await api.removeDevice(devId);
      fetchDevices();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md md:max-w-xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-white">My Registered Devices</h2>
          <p className="text-xs text-slate-400">Manage paired ESP32 wristbands & cameras</p>
        </div>
        <button
          onClick={() => {
            setShowAddModal(true);
            startScan();
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-red-600/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>

      {/* Device List */}
      {devices.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <Cpu className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-200">No Devices Paired</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Pair your ESP32 Wristband or ESP32-CAM to enable live emergency monitoring.
          </p>
          <button
            onClick={() => {
              setShowAddModal(true);
              startScan();
            }}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl"
          >
            Discover Devices Now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((dev) => (
            <div
              key={dev.device_id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    dev.device_type === 'WRISTBAND' ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {dev.device_type === 'WRISTBAND' ? <Activity className="w-6 h-6" /> : <Cpu className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">{dev.device_name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-mono text-slate-400">{dev.device_id}</span>
                      <span className="text-[10px] text-slate-500">•</span>
                      <span className="text-[10px] flex items-center gap-1 text-slate-400">
                        {dev.connection_type === 'BLE' ? <Bluetooth className="w-3 h-3 text-cyan-400" /> : <Wifi className="w-3 h-3 text-blue-400" />}
                        {dev.connection_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Pill */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                    dev.connection_status === 'CONNECTED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : dev.connection_status === 'OFFLINE'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      dev.connection_status === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                    }`} />
                    {dev.connection_status}
                  </span>
                </div>
              </div>

              {/* Telemetry info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 font-mono">
                {dev.battery_level !== null && dev.battery_level !== undefined && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Battery: {dev.battery_level}%</span>
                  </div>
                )}
                {dev.last_bpm && (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pulse: {dev.last_bpm} BPM</span>
                  </div>
                )}
                <div className="col-span-2 text-[10px] text-slate-500">
                  Last seen: {dev.last_seen ? new Date(dev.last_seen).toLocaleTimeString() : 'Never'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <button
                  onClick={() => toggleConnection(dev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dev.connection_status === 'CONNECTED'
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {dev.connection_status === 'CONNECTED' ? 'Disconnect' : 'Connect'}
                </button>

                <button
                  onClick={() => handleRemove(dev.device_id)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition"
                  title="Unpair and remove device"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Unpair
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD DEVICE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Pair New Hardware Device</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            {/* Nearby Discovery Scan Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nearby Devices Found
                </span>
                <button
                  onClick={startScan}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
              </div>

              {discovered.length === 0 ? (
                <div className="p-3 bg-slate-950 rounded-xl text-center text-xs text-slate-500">
                  {scanning ? 'Scanning BLE & Local Wi-Fi...' : 'No unbonded peripherals in range.'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {discovered.map((d) => (
                    <div
                      key={d.hardwareId}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200">{d.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{d.connectionType} • {d.hardwareId}</div>
                      </div>
                      <button
                        onClick={() => handlePairDiscovered(d)}
                        className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition"
                      >
                        Pair
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Or Register Manually
              </span>
              <form onSubmit={handleManualAdd} className="space-y-3">
                <input
                  type="text"
                  placeholder="Device Name (e.g. My Smart Wristband)"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newDeviceType}
                    onChange={(e) => setNewDeviceType(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="WRISTBAND">WRISTBAND</option>
                    <option value="ESP32_CAM">ESP32-CAM</option>
                  </select>
                  <select
                    value={newConnType}
                    onChange={(e) => setNewConnType(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="BLE">BLE</option>
                    <option value="WIFI">Wi-Fi</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Hardware Serial / MAC (Optional)"
                  value={newHardwareId}
                  onChange={(e) => setNewHardwareId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition"
                >
                  Confirm & Claim Device
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
