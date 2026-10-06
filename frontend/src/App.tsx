import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EmergencyAlertProvider } from './context/EmergencyAlertContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AlarmBanner } from './components/AlarmBanner';

// Pages
import { Home } from './pages/user/Home';
import { MyDevices } from './pages/user/MyDevices';
import { WristbandDetail } from './pages/user/WristbandDetail';
import { CameraDetail } from './pages/user/CameraDetail';
import { PhoneCamera } from './pages/user/PhoneCamera';
import { Incidents } from './pages/user/Incidents';
import { IncidentDetail } from './pages/user/IncidentDetail';
import { Profile } from './pages/user/Profile';
import { MockHardwareHub } from './pages/user/MockHardwareHub';
import { Login } from './pages/user/Login';
import { Register } from './pages/user/Register';
import { AdminDashboard } from './pages/admin/AdminDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-slate-500 font-mono">Restoring session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-slate-500 font-mono">Restoring session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const UserHomeRoute: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-xs text-slate-500 font-mono">Restoring session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return <Home />;
};

export const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white">
      <Navbar />
      <AlarmBanner />

      <main className="flex-1">
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* User Route with Auto-Redirect for Admin */}
          <Route path="/" element={<UserHomeRoute />} />

          {/* Protected User Routes */}
          <Route path="/devices" element={<ProtectedRoute><MyDevices /></ProtectedRoute>} />
          <Route path="/wristband-detail" element={<ProtectedRoute><WristbandDetail /></ProtectedRoute>} />
          <Route path="/camera-detail" element={<ProtectedRoute><CameraDetail /></ProtectedRoute>} />
          <Route path="/phone-camera" element={<ProtectedRoute><PhoneCamera /></ProtectedRoute>} />
          <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
          <Route path="/incidents/:id" element={<ProtectedRoute><IncidentDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/mock-studio" element={<ProtectedRoute><MockHardwareHub /></ProtectedRoute>} />

          {/* Admin Protected Route */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {user && <BottomNav />}
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <EmergencyAlertProvider>
          <AppContent />
        </EmergencyAlertProvider>
      </AuthProvider>
    </Router>
  );
}
