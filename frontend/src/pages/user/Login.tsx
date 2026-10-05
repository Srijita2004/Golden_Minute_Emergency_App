import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      await login({ email, password });
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-red-600/10 border border-red-500/20 rounded-2xl text-red-500 mb-2">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white">Welcome Back</h2>
          <p className="text-xs text-slate-400">Sign in to your emergency response dashboard</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@emergency.com"
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
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-600/30 flex items-center justify-center gap-1.5"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Credentials Helper */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
          <div className="font-bold text-slate-400">Quick Demo Accounts:</div>
          <div className="flex justify-between text-slate-300 font-mono">
            <span>Demo User:</span>
            <span className="text-cyan-400 cursor-pointer" onClick={() => { setEmail('user@emergency.com'); setPassword('User@123456'); }}>user@emergency.com / User@123456</span>
          </div>
          <div className="flex justify-between text-slate-300 font-mono">
            <span>Admin:</span>
            <span className="text-indigo-400 cursor-pointer" onClick={() => { setEmail('admin@emergency.com'); setPassword('Admin@123456'); }}>admin@emergency.com / Admin@123456</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center">
          Don't have an account?{' '}
          <Link to="/register" className="text-red-400 font-bold hover:underline">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
};
