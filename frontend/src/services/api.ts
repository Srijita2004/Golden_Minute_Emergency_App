const API_BASE = '/api';

export interface User {
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

export interface Device {
  device_id: string;
  device_name: string;
  device_type: string;
  owner_user_id: string;
  connection_type: string;
  hardware_identifier?: string;
  registration_status: string;
  connection_status: string;
  battery_level?: number;
  last_bpm?: number;
  last_latitude?: number;
  last_longitude?: number;
  last_seen?: string;
  created_at: string;
}

export interface DetectionEvent {
  event_id: string;
  incident_id: string;
  source_type: string;
  source_device_id?: string;
  image_url?: string;
  bpm?: number;
  confidence?: number;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  location_status: string;
  alert_status: string;
  detected_at: string;
  received_at: string;
}

export interface Incident {
  incident_id: string;
  owner_user_id: string;
  incident_type: string;
  status: string;
  summary?: string;
  created_at: string;
  updated_at?: string;
  events: DetectionEvent[];
}

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_devices: number;
  connected_devices: number;
  offline_devices: number;
  total_incidents: number;
  active_incidents: number;
  system_status: string;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export const api = {
  // Auth
  async register(data: any) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Registration failed');
    return res.json();
  },

  async login(data: any) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Login failed');
    return res.json();
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  // Devices
  async getDevices(): Promise<Device[]> {
    const res = await fetch(`${API_BASE}/devices`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch devices');
    return res.json();
  },

  async getDevice(id: string): Promise<Device> {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Failed to fetch device');
    return res.json();
  },

  async registerDevice(data: any): Promise<Device> {
    const res = await fetch(`${API_BASE}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'Device registration failed');
    return res.json();
  },

  async connectDevice(id: string): Promise<Device> {
    const res = await fetch(`${API_BASE}/devices/${id}/connect`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async disconnectDevice(id: string): Promise<Device> {
    const res = await fetch(`${API_BASE}/devices/${id}/disconnect`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async removeDevice(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/devices/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async discoverNearbyDevices() {
    const res = await fetch(`${API_BASE}/devices/discovery`);
    return res.json();
  },

  // Incidents
  async getIncidents(): Promise<Incident[]> {
    const res = await fetch(`${API_BASE}/incidents`, {
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async getIncident(id: string): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/${id}`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Incident not found');
    return res.json();
  },

  async createMobileIncident(formData: FormData): Promise<Incident> {
    const res = await fetch(`${API_BASE}/incidents/mobile-camera`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      body: formData
    });
    if (!res.ok) throw new Error('Failed to submit mobile incident');
    return res.json();
  },

  // Notifications
  async getActiveAlerts() {
    const res = await fetch(`${API_BASE}/notifications/active-alerts`, {
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async registerFcmToken(token: string, deviceName: string) {
    const res = await fetch(`${API_BASE}/notifications/register-device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ platform: 'WEB', fcm_token: token, device_name: deviceName })
    });
    return res.json();
  },

  // Mock Hardware
  async mockWristband(deviceId: string, bpm: number, lat?: number, lon?: number) {
    const res = await fetch(`${API_BASE}/mock/wristband/trigger?device_id=${deviceId}&bpm=${bpm}&latitude=${lat || 22.572645}&longitude=${lon || 88.363892}`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async mockCameraAccident(deviceId: string, type = 'ROAD_ACCIDENT') {
    const res = await fetch(`${API_BASE}/mock/camera/trigger?device_id=${deviceId}&detection_type=${type}`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async mockToggleOffline(deviceId: string) {
    const res = await fetch(`${API_BASE}/mock/device/toggle-offline?device_id=${deviceId}`, {
      method: 'POST',
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  // Admin
  async getAdminStats(): Promise<AdminStats> {
    const res = await fetch(`${API_BASE}/admin/system-status`, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error('Admin authorization required');
    return res.json();
  },

  async getAdminUsers(search?: string, page = 1) {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/admin/users?page=${page}${q}`, {
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async getAdminDevices(search?: string, page = 1) {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/admin/devices?page=${page}${q}`, {
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async getAdminIncidents(page = 1) {
    const res = await fetch(`${API_BASE}/admin/incidents?page=${page}`, {
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  },

  async getAdminAuditLogs(page = 1) {
    const res = await fetch(`${API_BASE}/admin/audit-logs?page=${page}`, {
      headers: { ...getAuthHeaders() }
    });
    return res.json();
  }
};
