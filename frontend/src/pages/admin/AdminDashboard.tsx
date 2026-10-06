import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Cpu, AlertTriangle, Activity, Search,
  RefreshCw, CheckCircle, Clock, Eye, FileText, Bell,
  MapPin, ExternalLink, Filter, CheckCircle2, XCircle, X,
  Radio, Smartphone, Flame, HeartPulse, Check
} from 'lucide-react';
import { api, AdminStats, getAssetUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'devices' | 'incidents' | 'logs'>('incidents');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Tab data states
  const [userList, setUserList] = useState<any[]>([]);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [incidentList, setIncidentList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Detail Modal & Action states
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user]);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const st = await api.getAdminStats();
      setStats(st);

      if (activeTab === 'users') {
        const u = await api.getAdminUsers(searchTerm, page);
        setUserList(u.users || []);
        setTotalPages(Math.ceil((u.total || 1) / 20));
      } else if (activeTab === 'devices') {
        const d = await api.getAdminDevices(searchTerm, page);
        setDeviceList(d.devices || []);
        setTotalPages(Math.ceil((d.total || 1) / 20));
      } else if (activeTab === 'incidents') {
        const inc = await api.getAdminIncidents({
          status: incidentStatusFilter,
          incident_type: incidentTypeFilter,
          search: searchTerm,
          page
        });
        setIncidentList(inc.incidents || []);
        setTotalPages(Math.ceil((inc.total || 1) / 20));
      } else if (activeTab === 'logs') {
        const l = await api.getAdminAuditLogs(page);
        setAuditLogs(l.logs || []);
        setTotalPages(Math.ceil((l.total || 1) / 50));
      }
    } catch (e) {
      console.error('Failed to load admin data:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial and reactive load
  useEffect(() => {
    loadData(false);
  }, [activeTab, page, searchTerm, incidentStatusFilter, incidentTypeFilter]);

  // Real-time auto-refresh polling (every 4 seconds for emergency monitoring)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, page, searchTerm, incidentStatusFilter, incidentTypeFilter]);

  const handleStatusChange = async (incidentId: string, newStatus: string) => {
    try {
      setUpdatingStatusId(incidentId);
      await api.updateIncidentStatus(incidentId, newStatus);
      // Optimistic update
      setIncidentList((prev) =>
        prev.map((inc) => (inc.incident_id === incidentId ? { ...inc, status: newStatus } : inc))
      );
      if (selectedIncident?.incident_id === incidentId) {
        setSelectedIncident((prev: any) => ({ ...prev, status: newStatus }));
      }
      // Refresh stats
      const st = await api.getAdminStats();
      setStats(st);
    } catch (err: any) {
      alert(`Status update failed: ${err.message || 'Server error'}`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const getSourceBadge = (inc: any) => {
    const firstEvent = inc.events?.[0];
    const src = (firstEvent?.source_type || '').toUpperCase();
    if (src.includes('PHONE') || src.includes('MOBILE')) {
      return {
        label: 'PHONE AI CAMERA',
        icon: Smartphone,
        color: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      };
    }
    if (src.includes('ESP32') || src.includes('CAM')) {
      return {
        label: 'ESP32-CAM',
        icon: Radio,
        color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
      };
    }
    if (src.includes('WRIST')) {
      return {
        label: 'WRISTBAND',
        icon: HeartPulse,
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
      };
    }
    return {
      label: src || 'MANUAL',
      icon: AlertTriangle,
      color: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  };

  const displayedIncidents = incidentList.filter((inc) => {
    if (sourceFilter === 'ALL') return true;
    const firstEvent = inc.events?.[0];
    const src = (firstEvent?.source_type || '').toUpperCase();
    if (sourceFilter === 'PHONE') return src.includes('PHONE') || src.includes('MOBILE');
    if (sourceFilter === 'ESP32_CAM') return src.includes('ESP32') || src.includes('CAM');
    if (sourceFilter === 'WRISTBAND') return src.includes('WRIST');
    return true;
  });

  return (
    <div className="min-h-screen pb-20 pt-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                HOSPITAL & EMERGENCY SURVEILLANCE
              </span>
              <span className="text-xs text-slate-500 font-mono">ROLE: ADMIN</span>
            </div>
            <h1 className="text-2xl font-black text-white">Hospital Emergency Monitoring Center</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-Time Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold font-mono transition border ${
              autoRefresh
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle 4-second real-time emergency feed polling"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'}`} />
            {autoRefresh ? 'LIVE FEED (4s)' : 'PAUSED'}
          </button>

          <button
            onClick={() => loadData(false)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Active Emergencies
          </div>
          <div className="text-2xl font-black text-red-400 flex items-center gap-2">
            {stats?.active_incidents || 0}
            {(stats?.active_incidents || 0) > 0 && <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />}
          </div>
          <div className="text-[11px] text-slate-400">Total Logged: {stats?.total_incidents || 0}</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-cyan-400" /> Connected Devices
          </div>
          <div className="text-2xl font-black text-white">{stats?.connected_devices || 0}</div>
          <div className="text-[11px] text-slate-400 font-mono">
            {stats?.total_devices || 0} Registered • {stats?.offline_devices || 0} Offline
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" /> Monitored Citizens
          </div>
          <div className="text-2xl font-black text-white">{stats?.total_users || 0}</div>
          <div className="text-[11px] text-emerald-400">{stats?.active_users || 0} Active Accounts</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> System Status
          </div>
          <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
            {stats?.system_status || 'OPERATIONAL'}
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-[11px] text-slate-400">HF Vision Brain Online</div>
        </div>
      </div>

      {/* ADMIN NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2 text-xs font-bold">
        {[
          { key: 'incidents', label: 'Emergency Monitoring Feed', icon: AlertTriangle },
          { key: 'overview', label: 'Surveillance Topology', icon: Activity },
          { key: 'users', label: 'Citizen Directory', icon: Users },
          { key: 'devices', label: 'Device Inventory', icon: Cpu },
          { key: 'logs', label: 'Audit Trail Logs', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as any); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REAL-TIME EMERGENCY MONITORING FEED (DESKTOP-FIRST) */}
      {/* ========================================================================= */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          {/* Multi-Filter Bar */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search incident ID, owner user, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Status:</span>
                {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setIncidentStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition border ${
                      incidentStatusFilter === st
                        ? st === 'ACTIVE'
                          ? 'bg-red-600 text-white border-red-500'
                          : st === 'ACKNOWLEDGED'
                          ? 'bg-amber-600 text-white border-amber-500'
                          : st === 'RESOLVED'
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Second Filter Row: Incident Type & Device Source */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/60 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Hazard Type:</span>
                <select
                  value={incidentTypeFilter}
                  onChange={(e) => setIncidentTypeFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-mono focus:outline-none"
                >
                  <option value="ALL">All Hazard Types</option>
                  <option value="ROAD_ACCIDENT">Road Vehicle Crash</option>
                  <option value="FALL_ACCIDENT">Human Fall Accident</option>
                  <option value="FIRE_ACCIDENT">Fire Combustion</option>
                  <option value="ABNORMAL_PULSE">Abnormal Pulse (Cardiac)</option>
                  <option value="MANUAL_SOS">Manual Distress SOS</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Source Stream:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs font-mono focus:outline-none"
                >
                  <option value="ALL">All Hardware & Sensors</option>
                  <option value="PHONE">Phone AI Camera</option>
                  <option value="ESP32_CAM">ESP32-CAM (External)</option>
                  <option value="WRISTBAND">Wristband (IoT Pulse)</option>
                </select>
              </div>

              <div className="ml-auto text-[11px] font-mono text-slate-400">
                Showing <strong>{displayedIncidents.length}</strong> incidents (Newest First)
              </div>
            </div>
          </div>

          {/* Incident Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Incident ID</th>
                    <th className="p-3">Source Channel</th>
                    <th className="p-3">Emergency Type</th>
                    <th className="p-3">Citizen Owner</th>
                    <th className="p-3">GPS Location</th>
                    <th className="p-3">Detection Time</th>
                    <th className="p-3">Status Workflow</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                  {displayedIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                        No emergencies found matching the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedIncidents.map((inc) => {
                      const badge = getSourceBadge(inc);
                      const BadgeIcon = badge.icon;
                      const firstEvent = inc.events?.[0];
                      const lat = firstEvent?.latitude;
                      const lon = firstEvent?.longitude;
                      const isUpdating = updatingStatusId === inc.incident_id;

                      return (
                        <tr
                          key={inc.incident_id}
                          className={`hover:bg-slate-800/40 transition ${
                            inc.status === 'ACTIVE' ? 'bg-red-950/10' : ''
                          }`}
                        >
                          {/* Incident ID */}
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedIncident(inc)}
                              className="font-bold text-red-400 hover:text-red-300 hover:underline flex items-center gap-1.5"
                            >
                              {inc.status === 'ACTIVE' && (
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                              )}
                              {inc.incident_id}
                            </button>
                          </td>

                          {/* Source Channel Badge */}
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badge.color}`}
                            >
                              <BadgeIcon className="w-3 h-3" />
                              {badge.label}
                            </span>
                          </td>

                          {/* Emergency Type */}
                          <td className="p-3">
                            <div className="font-sans font-bold text-white flex items-center gap-1.5">
                              {inc.incident_type.includes('FIRE') && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                              {inc.incident_type.includes('PULSE') && <HeartPulse className="w-3.5 h-3.5 text-pink-400" />}
                              {inc.incident_type.includes('ROAD') && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                              {inc.incident_type.includes('FALL') && <Activity className="w-3.5 h-3.5 text-rose-400" />}
                              <span>{inc.incident_type.replace(/_/g, ' ')}</span>
                            </div>
                            {firstEvent?.confidence && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Conf: {(firstEvent.confidence * 100).toFixed(0)}%
                              </span>
                            )}
                          </td>

                          {/* Citizen Owner */}
                          <td className="p-3">
                            <span className="text-cyan-400">{inc.owner_user_id}</span>
                          </td>

                          {/* GPS Location */}
                          <td className="p-3 font-sans">
                            {lat && lon ? (
                              <a
                                href={`https://maps.google.com/?q=${lat},${lon}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                              >
                                <MapPin className="w-3 h-3 text-red-400" />
                                {lat.toFixed(4)}, {lon.toFixed(4)}
                                <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">No GPS Tag</span>
                            )}
                          </td>

                          {/* Time */}
                          <td className="p-3 text-slate-400 text-[11px]">
                            {inc.created_at ? new Date(inc.created_at).toLocaleString() : 'N/A'}
                          </td>

                          {/* Status Workflow Dropdown */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <select
                                value={inc.status}
                                disabled={isUpdating}
                                onChange={(e) => handleStatusChange(inc.incident_id, e.target.value)}
                                className={`text-[10px] font-bold font-mono px-2 py-1 rounded-lg border focus:outline-none transition ${
                                  inc.status === 'ACTIVE'
                                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                    : inc.status === 'ACKNOWLEDGED'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                }`}
                              >
                                <option value="ACTIVE" className="bg-slate-900 text-red-400 font-bold">ACTIVE (Critical)</option>
                                <option value="ACKNOWLEDGED" className="bg-slate-900 text-amber-400 font-bold">ACKNOWLEDGED</option>
                                <option value="RESOLVED" className="bg-slate-900 text-emerald-400 font-bold">RESOLVED</option>
                              </select>
                              {isUpdating && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedIncident(inc)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                              Review
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INCIDENT DETAIL REVIEW MODAL */}
      {/* ========================================================================= */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 p-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-red-400 font-bold">
                    {selectedIncident.incident_id}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      selectedIncident.status === 'ACTIVE'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : selectedIncident.status === 'ACKNOWLEDGED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {selectedIncident.status}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mt-1">
                  {selectedIncident.incident_type.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Reported at: {selectedIncident.created_at ? new Date(selectedIncident.created_at).toLocaleString() : 'N/A'}
                </p>
              </div>

              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Snapshot Image if available */}
            {selectedIncident.events?.[0]?.image_url && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  Incident Vision Snapshot
                </span>
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-black h-56 flex items-center justify-center relative">
                  <img
                    src={getAssetUrl(selectedIncident.events[0].image_url)}
                    alt="Incident Capture"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/uploads/mock_accident_sample.jpg';
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-slate-300">
                    Source: {selectedIncident.events[0].source_type}
                  </div>
                </div>
              </div>
            )}

            {/* Incident Summary & Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">OWNER USER ID</span>
                <span className="font-bold text-cyan-400">{selectedIncident.owner_user_id}</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">AI CONFIDENCE</span>
                <span className="font-bold text-white">
                  {selectedIncident.events?.[0]?.confidence
                    ? `${(selectedIncident.events[0].confidence * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">HEART RATE (BPM)</span>
                <span className="font-bold text-pink-400">
                  {selectedIncident.events?.[0]?.bpm ? `${selectedIncident.events[0].bpm} BPM` : 'N/A'}
                </span>
              </div>
            </div>

            {/* GPS Location details */}
            {selectedIncident.events?.[0]?.latitude && selectedIncident.events?.[0]?.longitude && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-400" />
                  <span className="font-mono text-slate-300">
                    Lat: {selectedIncident.events[0].latitude}, Lon: {selectedIncident.events[0].longitude}
                  </span>
                </div>
                <a
                  href={`https://maps.google.com/?q=${selectedIncident.events[0].latitude},${selectedIncident.events[0].longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Google Maps
                </a>
              </div>
            )}

            {/* Summary description */}
            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300">
              <span className="font-bold text-slate-400 block mb-1">EVENT SUMMARY</span>
              {selectedIncident.summary || 'Automated multi-hazard emergency incident logged by Golden Minute pipeline.'}
            </div>

            {/* Quick Status Workflow Action Buttons */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-400">Triage Action:</span>
              <div className="flex items-center gap-2">
                {selectedIncident.status !== 'ACKNOWLEDGED' && (
                  <button
                    onClick={() => handleStatusChange(selectedIncident.incident_id, 'ACKNOWLEDGED')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Acknowledge Alert
                  </button>
                )}
                {selectedIncident.status !== 'RESOLVED' && (
                  <button
                    onClick={() => handleStatusChange(selectedIncident.incident_id, 'RESOLVED')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Mark Resolved
                  </button>
                )}
                {selectedIncident.status !== 'ACTIVE' && (
                  <button
                    onClick={() => handleStatusChange(selectedIncident.incident_id, 'ACTIVE')}
                    className="px-3 py-1.5 bg-red-600/30 hover:bg-red-600 text-red-200 hover:text-white rounded-xl text-xs font-bold transition"
                  >
                    Re-open Case
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Security Compliance & RBAC Notice
            </h3>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-emerald-400 font-bold block mb-1">
                  ✓ ZERO SECRETS EXPOSURE ENFORCED
                </span>
                User bcrypt password hashes, reset tokens, and physical device pairing secrets are mathematically filtered out of all administrative API serializer models.
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                <span className="text-cyan-400 font-bold block mb-1">
                  ✓ AUDIT TRAIL LOGGING
                </span>
                Every user registration, authentication attempt, device claiming, and status update is logged with immutable timestamps.
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Hardware Adapter Registry
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">ESP32-CAM Vision Engine:</span>
                <span className="text-emerald-400">road_expanded_best.pt (Active)</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">Fall Detection AI:</span>
                <span className="text-emerald-400">fall_expanded_best.pt (Active)</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">Combustion Physics Engine:</span>
                <span className="text-emerald-400">HSV + RGB + YCrCb (Active)</span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400">FCM Push Service:</span>
                <span className="text-amber-400">Configured / In-App Bus Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: USERS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search user name, email, or User ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Devices</th>
                  <th className="p-3">Incidents</th>
                  <th className="p-3">Registered At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                {userList.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-cyan-400 font-bold">{u.user_id}</td>
                    <td className="p-3 font-sans font-semibold text-white">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3 uppercase font-bold text-[10px]">{u.role}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3">{u.device_count}</td>
                    <td className="p-3">{u.incident_count}</td>
                    <td className="p-3 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DEVICES */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search device ID, name, or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Device ID</th>
                  <th className="p-3">Device Name</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Owner User ID</th>
                  <th className="p-3">Connection</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                {deviceList.map((d) => (
                  <tr key={d.device_id} className="hover:bg-slate-800/40">
                    <td className="p-3 text-blue-400 font-bold">{d.device_id}</td>
                    <td className="p-3 font-sans font-semibold text-white">{d.device_name}</td>
                    <td className="p-3 text-[10px] uppercase font-bold">{d.device_type}</td>
                    <td className="p-3 text-cyan-400">{d.owner_user_id}</td>
                    <td className="p-3">{d.connection_type}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.connection_status === 'CONNECTED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {d.connection_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">
                      {d.last_seen ? new Date(d.last_seen).toLocaleTimeString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Resource</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
              {auditLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-800/40">
                  <td className="p-3 text-slate-500">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="p-3 text-cyan-400">{l.actor_user_id || 'SYSTEM'}</td>
                  <td className="p-3 text-amber-400 font-bold">{l.action}</td>
                  <td className="p-3 text-slate-400">{l.resource_type}: {l.resource_id}</td>
                  <td className="p-3 font-sans text-slate-300 max-w-sm truncate">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
