import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, Shield, Mail, Lock, ArrowRight, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('type') === 'hospital' ? 'hospital' : 'user';
  const [authRole, setAuthRole] = useState<'user' | 'hospital'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to appropriate portal
  useEffect(() => {
    if (user) {
      const isHospitalOrAdmin = user.role?.toUpperCase() === 'ADMIN' || user.role?.toUpperCase() === 'HOSPITAL';
      if (isHospitalOrAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const loggedIn = await login({ email, password });
      const isHospitalOrAdmin = loggedIn?.role?.toUpperCase() === 'ADMIN' || loggedIn?.role?.toUpperCase() === 'HOSPITAL';
      if (isHospitalOrAdmin) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
        
        {/* Role Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setAuthRole('user');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              authRole === 'user'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Personal User</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthRole('hospital');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              authRole === 'hospital'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Hospital / Admin</span>
          </button>
        </div>

        {/* Portal Header */}
        <div className="text-center space-y-1">
          <div className={`inline-flex p-3 rounded-2xl mb-2 ${
            authRole === 'user'
              ? 'bg-red-600/10 border border-red-500/20 text-red-500'
              : 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400'
          }`}>
            {authRole === 'user' ? (
              <ShieldAlert className="w-8 h-8" />
            ) : (
              <Shield className="w-8 h-8" />
            )}
          </div>
          <h2 className="text-2xl font-black text-white">
            {authRole === 'user' ? 'Personal User Portal' : 'Hospital & Trauma Portal'}
          </h2>
          <p className="text-xs text-slate-400">
            {authRole === 'user'
              ? 'Sign in to access personal AI detection and emergency devices'
              : 'Authorized access for hospital dispatchers and emergency monitoring'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {authRole === 'user' ? 'Personal Email' : 'Hospital Operator Email'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={authRole === 'user' ? 'user@emergency.com' : 'admin@emergency.com'}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 text-white font-bold text-xs rounded-xl transition shadow-lg flex items-center justify-center gap-1.5 ${
              authRole === 'user'
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
            }`}
          >
            {loading ? 'Authenticating...' : authRole === 'user' ? 'Sign In as Personal User' : 'Sign In to Hospital Portal'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Credentials Autofill */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Quick Demo Credentials (Tap to fill):</span>
          </div>
          {authRole === 'user' ? (
            <div
              onClick={() => { setEmail('user@emergency.com'); setPassword('User@123456'); }}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer flex justify-between items-center text-xs font-mono text-cyan-400 transition"
            >
              <span>Personal User:</span>
              <span className="font-bold">user@emergency.com / User@123456</span>
            </div>
          ) : (
            <div
              onClick={() => { setEmail('admin@emergency.com'); setPassword('Admin@123456'); }}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer flex justify-between items-center text-xs font-mono text-indigo-400 transition"
            >
              <span>Hospital Admin:</span>
              <span className="font-bold">admin@emergency.com / Admin@123456</span>
            </div>
          )}
        </div>

        {/* Onboarding / Registration Links */}
        <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
          {authRole === 'user' ? (
            <p className="text-xs text-slate-400">
              Don't have a personal account?{' '}
              <Link to="/register?type=personal" className="text-red-400 font-bold hover:underline">
                Create Personal Account
              </Link>
            </p>
          ) : (
            <p className="text-xs text-slate-400">
              New Hospital / Emergency Center?{' '}
              <Link to="/register?type=hospital" className="text-indigo-400 font-bold hover:underline">
                Register Hospital / Emergency Center
              </Link>
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={() => {
                setAuthRole(authRole === 'user' ? 'hospital' : 'user');
                setError('');
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition underline underline-offset-2"
            >
              {authRole === 'user'
                ? 'Switch to Hospital / Emergency Center Login'
                : 'Switch to Personal User Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
