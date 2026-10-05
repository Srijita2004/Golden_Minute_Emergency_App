import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Cpu, AlertTriangle, Activity, Search,
  RefreshCw, CheckCircle, Clock, Eye, FileText, Bell
} from 'lucide-react';
import { api, AdminStats } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'devices' | 'incidents' | 'logs'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab data states
  const [userList, setUserList] = useState<any[]>([]);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [incidentList, setIncidentList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
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
        const inc = await api.getAdminIncidents(page);
        setIncidentList(inc.incidents || []);
        setTotalPages(Math.ceil((inc.total || 1) / 20));
      } else if (activeTab === 'logs') {
        const l = await api.getAdminAuditLogs(page);
        setAuditLogs(l.logs || []);
        setTotalPages(Math.ceil((l.total || 1) / 50));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, page, searchTerm]);

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
                ADMINISTRATIVE SURVEILLANCE
              </span>
              <span className="text-xs text-slate-500 font-mono">ROLE: ADMIN</span>
            </div>
            <h1 className="text-2xl font-black text-white">Central Admin Dashboard</h1>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Users className="w-4 h-4 text-cyan-400" /> Total Users
          </div>
          <div className="text-2xl font-black text-white">{stats?.total_users || 0}</div>
          <div className="text-[11px] text-emerald-400">{stats?.active_users || 0} Active Accounts</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-blue-400" /> Total Devices
          </div>
          <div className="text-2xl font-black text-white">{stats?.total_devices || 0}</div>
          <div className="text-[11px] text-emerald-400 font-mono">
            {stats?.connected_devices || 0} Connected • {stats?.offline_devices || 0} Offline
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Total Incidents
          </div>
          <div className="text-2xl font-black text-white">{stats?.total_incidents || 0}</div>
          <div className="text-[11px] text-red-400 font-bold">
            {stats?.active_incidents || 0} Active Critical
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" /> System Status
          </div>
          <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
            {stats?.system_status || 'ONLINE'}
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="text-[11px] text-slate-400">All Pipeline Engines Active</div>
        </div>
      </div>

      {/* ADMIN NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2 text-xs font-bold">
        {[
          { key: 'overview', label: 'System Overview', icon: Activity },
          { key: 'users', label: 'User Directory', icon: Users },
          { key: 'devices', label: 'Device Inventory', icon: Cpu },
          { key: 'incidents', label: 'Emergency Incidents', icon: AlertTriangle },
          { key: 'logs', label: 'Audit Logs', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key as any); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition ${
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

      {/* TAB 1: OVERVIEW */}
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

      {/* TAB 2: USERS */}
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

      {/* TAB 3: DEVICES */}
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

      {/* TAB 4: INCIDENTS */}
      {activeTab === 'incidents' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Incident ID</th>
                <th className="p-3">Owner User ID</th>
                <th className="p-3">Incident Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
              {incidentList.map((inc) => (
                <tr key={inc.incident_id} className="hover:bg-slate-800/40">
                  <td className="p-3 text-red-400 font-bold">{inc.incident_id}</td>
                  <td className="p-3 text-cyan-400">{inc.owner_user_id}</td>
                  <td className="p-3 font-sans font-bold text-white">{inc.incident_type}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{new Date(inc.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
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
